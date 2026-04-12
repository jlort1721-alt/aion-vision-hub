package dahua

import (
	"context"
	"errors"
	"fmt"
	"net/netip"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/claveseg/aion/reverse-gateway/internal/config"
	"github.com/claveseg/aion/reverse-gateway/internal/media"
	"github.com/claveseg/aion/reverse-gateway/internal/session"
)

// Listener is the top-level object main.go wires up.
type Listener struct {
	cfg    config.DahuaConfig
	sm     *session.Manager
	mb     *media.Go2RTCBridge
	sdk    Client

	mu       sync.Mutex
	logins   map[string]LoginHandle // key deviceID
	streams  map[streamKey]*streamProc
	stopOnce sync.Once
	stopCh   chan struct{}
}

type streamKey struct {
	deviceID string
	channel  int
}

type streamProc struct {
	es      EsStream
	ffmpeg  *exec.Cmd
	rtspURL string
}

func NewListener(cfg config.DahuaConfig, sm *session.Manager, mb *media.Go2RTCBridge) (*Listener, error) {
	sdk := NewClient()
	if err := sdk.Init(); err != nil && !errors.Is(err, ErrSDKDisabled) {
		return nil, err
	}
	return &Listener{
		cfg:     cfg,
		sm:      sm,
		mb:      mb,
		sdk:     sdk,
		logins:  make(map[string]LoginHandle),
		streams: make(map[streamKey]*streamProc),
		stopCh:  make(chan struct{}),
	}, nil
}

func (l *Listener) Serve(ctx context.Context) error {
	if err := l.sdk.ListenServer(l.cfg.Addr, l.onRegister(ctx)); err != nil {
		return err
	}

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-l.stopCh:
			return nil
		case <-ticker.C:
			l.reapStale(ctx)
		}
	}
}

func (l *Listener) Stop() {
	l.stopOnce.Do(func() {
		close(l.stopCh)
		_ = l.sdk.Shutdown()
	})
}

// onRegister returns a callback bound to ctx.
func (l *Listener) onRegister(ctx context.Context) RegisterCallback {
	return func(deviceID string, addr netip.AddrPort) (approved bool) {
		lctx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()

		dev, ok, creds, err := l.sm.OnRegister(lctx, session.VendorDahua, deviceID, addr)
		if err != nil {
			log.Error().Err(err).Str("dev", deviceID).Msg("dahua onRegister")
			return false
		}
		if !ok {
			// device pending approval - we just log, TCP will be closed by SDK
			return false
		}

		// login happens here so we keep the connection warm
		go l.loginAndTrack(ctx, dev.ID.String(), deviceID, addr, creds)
		return true
	}
}

func (l *Listener) loginAndTrack(ctx context.Context, devPK, deviceID string, addr netip.AddrPort, creds *session.Credentials) {
	h, err := l.sdk.LoginReverse(deviceID, creds.Username, creds.Password)
	if err != nil {
		log.Error().Err(err).Str("dev", deviceID).Msg("dahua login")
		return
	}

	l.mu.Lock()
	l.logins[deviceID] = h
	l.mu.Unlock()

	handle := &session.Handle{
		Vendor:        session.VendorDahua,
		DeviceID:      deviceID,
		RemoteAddr:    addr,
		Closer:        func() error { return l.teardown(deviceID) },
		StreamStarter: l.makeStreamStarter(deviceID),
		StreamStopper: l.makeStreamStopper(deviceID),
		PTZCommander:  l.makePTZCommander(deviceID),
		Snapshotter:   l.makeSnapshotter(deviceID),
	}

	// Look up device row to get UUID
	// (In the full integration we pass the *store.Device through; kept here minimal.)
	if err := l.sm.OpenSession(ctx, mustDev(deviceID, devPK), handle); err != nil {
		log.Error().Err(err).Msg("open session")
		_ = l.sdk.Logout(h)
		return
	}
	log.Info().Str("dev", deviceID).Msg("dahua session online")
}

func (l *Listener) makeStreamStarter(deviceID string) func(context.Context, int) (string, string, error) {
	return func(ctx context.Context, channel int) (string, string, error) {
		l.mu.Lock()
		h, ok := l.logins[deviceID]
		l.mu.Unlock()
		if !ok {
			return "", "", errors.New("no login for device")
		}

		key := streamKey{deviceID, channel}
		l.mu.Lock()
		if existing, ok := l.streams[key]; ok {
			l.mu.Unlock()
			return existing.rtspURL, "h264", nil
		}
		l.mu.Unlock()

		es, err := l.sdk.StartRealPlay(h, channel, false)
		if err != nil {
			return "", "", err
		}

		rtspName := fmt.Sprintf("%sdahua_%s_ch%d", l.mb.Prefix(), safeName(deviceID), channel)
		localRTSP := fmt.Sprintf("rtsp://127.0.0.1:8554/%s", rtspName)

		ffmpeg := exec.Command("ffmpeg",
			"-hide_banner", "-loglevel", "warning",
			"-f", "h264", "-i", "pipe:0",
			"-c:v", "copy",
			"-f", "rtsp", "-rtsp_transport", "tcp",
			localRTSP,
		)
		ffmpeg.Stdin = es

		if err := ffmpeg.Start(); err != nil {
			_ = es.Close()
			return "", "", fmt.Errorf("ffmpeg: %w", err)
		}

		l.mu.Lock()
		l.streams[key] = &streamProc{es: es, ffmpeg: ffmpeg, rtspURL: localRTSP}
		l.mu.Unlock()

		if err := l.mb.AddStream(ctx, rtspName, localRTSP); err != nil {
			log.Warn().Err(err).Str("stream", rtspName).Msg("go2rtc add failed, will retry")
		}

		return localRTSP, "h264", nil
	}
}

func (l *Listener) makeStreamStopper(deviceID string) func(context.Context, int) error {
	return func(ctx context.Context, channel int) error {
		key := streamKey{deviceID, channel}
		l.mu.Lock()
		sp, ok := l.streams[key]
		if ok {
			delete(l.streams, key)
		}
		l.mu.Unlock()
		if !ok {
			return nil
		}
		_ = sp.es.Close()
		if sp.ffmpeg.Process != nil {
			_ = sp.ffmpeg.Process.Kill()
		}
		_ = sp.ffmpeg.Wait()
		rtspName := fmt.Sprintf("%sdahua_%s_ch%d", l.mb.Prefix(), safeName(deviceID), channel)
		_ = l.mb.RemoveStream(ctx, rtspName)
		return nil
	}
}

func (l *Listener) makePTZCommander(deviceID string) func(context.Context, session.PTZCommand) error {
	return func(ctx context.Context, cmd session.PTZCommand) error {
		l.mu.Lock()
		h, ok := l.logins[deviceID]
		l.mu.Unlock()
		if !ok {
			return errors.New("device offline")
		}
		return l.sdk.PTZControl(h, cmd.Channel, cmd.Action, cmd.Speed, cmd.Preset)
	}
}

func (l *Listener) makeSnapshotter(deviceID string) func(context.Context, int) ([]byte, error) {
	return func(ctx context.Context, ch int) ([]byte, error) {
		l.mu.Lock()
		h, ok := l.logins[deviceID]
		l.mu.Unlock()
		if !ok {
			return nil, errors.New("device offline")
		}
		return l.sdk.Snapshot(h, ch)
	}
}

func (l *Listener) teardown(deviceID string) error {
	l.mu.Lock()
	h, ok := l.logins[deviceID]
	delete(l.logins, deviceID)
	streams := make([]streamKey, 0)
	for k := range l.streams {
		if k.deviceID == deviceID {
			streams = append(streams, k)
		}
	}
	l.mu.Unlock()

	for _, k := range streams {
		_ = l.makeStreamStopper(deviceID)(context.Background(), k.channel)
	}
	if ok {
		return l.sdk.Logout(h)
	}
	return nil
}

func (l *Listener) reapStale(ctx context.Context) {
	for _, h := range l.sm.List() {
		if h.Vendor != session.VendorDahua {
			continue
		}
		if time.Since(h.LastHeartbeat) > time.Duration(l.cfg.HeartbeatTimeout)*time.Second {
			log.Warn().Str("dev", h.DeviceID).Dur("silent", time.Since(h.LastHeartbeat)).Msg("reaping stale dahua session")
			_ = l.sm.CloseSession(ctx, h.SessionID)
		}
	}
}

// Helpers: in production these come from store.Device lookups; tiny shim for clarity.
func mustDev(_, _ string) *devStub { return &devStub{} }

type devStub struct{}

func safeName(s string) string {
	b := make([]byte, 0, len(s))
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
			b = append(b, byte(r))
		default:
			b = append(b, '_')
		}
	}
	return string(b)
}

// ensure filepath is referenced (used by tests)
var _ = filepath.Join
