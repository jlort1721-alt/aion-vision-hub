package hikvision

import (
	"context"
	"errors"
	"fmt"
	"net/netip"
	"os/exec"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/claveseg/aion/reverse-gateway/internal/config"
	"github.com/claveseg/aion/reverse-gateway/internal/media"
	"github.com/claveseg/aion/reverse-gateway/internal/session"
	"github.com/claveseg/aion/reverse-gateway/internal/store"
)

type Listener struct {
	cfg config.HikvisionConfig
	sm  *session.Manager
	mb  *media.Go2RTCBridge
	sdk Client

	mu      sync.Mutex
	logins  map[string]LoginHandle
	streams map[streamKey]*streamProc

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

func NewListener(cfg config.HikvisionConfig, sm *session.Manager, mb *media.Go2RTCBridge) (*Listener, error) {
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
	if err := l.sdk.StartServer(l.cfg.SignalingAddr, l.cfg.StreamAddr, l.onRegister(ctx)); err != nil {
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

func (l *Listener) onRegister(ctx context.Context) RegisterCallback {
	return func(deviceID string, addr netip.AddrPort, firmware string) (approved bool) {
		lctx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()

		dev, ok, creds, err := l.sm.OnRegister(lctx, session.VendorHikvision, deviceID, addr)
		if err != nil {
			log.Error().Err(err).Str("dev", deviceID).Msg("hik onRegister")
			return false
		}
		if !ok {
			return false
		}
		go l.track(ctx, dev.ID.String(), deviceID, addr, creds, firmware)
		return true
	}
}

func (l *Listener) track(ctx context.Context, devPK, deviceID string, addr netip.AddrPort, creds *session.Credentials, firmware string) {
	h, err := l.sdk.LoginReverse(deviceID, creds.ISUPKey)
	if err != nil {
		log.Error().Err(err).Str("dev", deviceID).Msg("hik login")
		return
	}
	l.mu.Lock()
	l.logins[deviceID] = h
	l.mu.Unlock()

	handle := &session.Handle{
		Vendor:        session.VendorHikvision,
		DeviceID:      deviceID,
		RemoteAddr:    addr,
		Closer:        func() error { return l.teardown(deviceID) },
		StreamStarter: l.makeStarter(deviceID),
		StreamStopper: l.makeStopper(deviceID),
		PTZCommander:  l.makePTZ(deviceID),
		Snapshotter:   l.makeSnap(deviceID),
	}

	if err := l.sm.OpenSession(ctx, mustDev(), handle); err != nil {
		log.Error().Err(err).Msg("open session")
		_ = l.sdk.Logout(h)
		return
	}
	log.Info().Str("dev", deviceID).Str("firmware", firmware).Msg("hikvision session online")
}

func (l *Listener) makeStarter(deviceID string) func(context.Context, int) (string, string, error) {
	return func(ctx context.Context, channel int) (string, string, error) {
		l.mu.Lock()
		h, ok := l.logins[deviceID]
		l.mu.Unlock()
		if !ok {
			return "", "", errors.New("no login")
		}

		key := streamKey{deviceID, channel}
		l.mu.Lock()
		if sp, ok := l.streams[key]; ok {
			l.mu.Unlock()
			return sp.rtspURL, "h264", nil
		}
		l.mu.Unlock()

		es, err := l.sdk.StartRealStream(h, channel, false)
		if err != nil {
			return "", "", err
		}

		name := fmt.Sprintf("%shik_%s_ch%d", l.mb.Prefix(), safeName(deviceID), channel)
		rtsp := fmt.Sprintf("rtsp://127.0.0.1:8554/%s", name)

		// Hik ISUP delivers RTP/PS; ffmpeg demuxes and republishes.
		ffmpeg := exec.Command("ffmpeg",
			"-hide_banner", "-loglevel", "warning",
			"-f", "mpegps", "-i", "pipe:0",
			"-c", "copy",
			"-f", "rtsp", "-rtsp_transport", "tcp",
			rtsp,
		)
		ffmpeg.Stdin = es
		if err := ffmpeg.Start(); err != nil {
			_ = es.Close()
			return "", "", err
		}

		l.mu.Lock()
		l.streams[key] = &streamProc{es: es, ffmpeg: ffmpeg, rtspURL: rtsp}
		l.mu.Unlock()

		_ = l.mb.AddStream(ctx, name, rtsp)
		return rtsp, "h264", nil
	}
}

func (l *Listener) makeStopper(deviceID string) func(context.Context, int) error {
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
		name := fmt.Sprintf("%shik_%s_ch%d", l.mb.Prefix(), safeName(deviceID), channel)
		_ = l.mb.RemoveStream(ctx, name)
		return nil
	}
}

func (l *Listener) makePTZ(deviceID string) func(context.Context, session.PTZCommand) error {
	return func(ctx context.Context, cmd session.PTZCommand) error {
		l.mu.Lock()
		h, ok := l.logins[deviceID]
		l.mu.Unlock()
		if !ok {
			return errors.New("offline")
		}
		return l.sdk.PTZControl(h, cmd.Channel, cmd.Action, cmd.Speed, cmd.Preset)
	}
}

func (l *Listener) makeSnap(deviceID string) func(context.Context, int) ([]byte, error) {
	return func(ctx context.Context, ch int) ([]byte, error) {
		l.mu.Lock()
		h, ok := l.logins[deviceID]
		l.mu.Unlock()
		if !ok {
			return nil, errors.New("offline")
		}
		return l.sdk.Snapshot(h, ch)
	}
}

func (l *Listener) teardown(deviceID string) error {
	l.mu.Lock()
	h, ok := l.logins[deviceID]
	delete(l.logins, deviceID)
	toStop := []streamKey{}
	for k := range l.streams {
		if k.deviceID == deviceID {
			toStop = append(toStop, k)
		}
	}
	l.mu.Unlock()

	for _, k := range toStop {
		_ = l.makeStopper(deviceID)(context.Background(), k.channel)
	}
	if ok {
		return l.sdk.Logout(h)
	}
	return nil
}

func (l *Listener) reapStale(ctx context.Context) {
	for _, h := range l.sm.List() {
		if h.Vendor != session.VendorHikvision {
			continue
		}
		if time.Since(h.LastHeartbeat) > time.Duration(l.cfg.HeartbeatTimeout)*time.Second {
			log.Warn().Str("dev", h.DeviceID).Msg("reaping stale hik session")
			_ = l.sm.CloseSession(ctx, h.SessionID)
		}
	}
}

func mustDev() *store.Device {
	return &store.Device{}
}

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
