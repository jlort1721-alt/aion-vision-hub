// Package session orchestrates the lifecycle of every connected device
// independently of vendor protocol. Dahua and Hikvision listeners hand
// off a SessionHandle to this manager; downstream systems (API, metrics,
// media bridge) only ever talk to the manager.
package session

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/netip"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/claveseg/aion/reverse-gateway/internal/crypto"
	"github.com/claveseg/aion/reverse-gateway/internal/metrics"
	"github.com/claveseg/aion/reverse-gateway/internal/store"
)

type Vendor string

const (
	VendorDahua     Vendor = "dahua"
	VendorHikvision Vendor = "hikvision"
)

// Credentials are plaintext only in memory, for the duration of the login call.
type Credentials struct {
	Username string
	Password string
	ISUPKey  string // hikvision only
}

// Handle is the per-session record kept in memory. Created by a vendor
// listener on registration, destroyed on disconnect.
type Handle struct {
	SessionID     uuid.UUID
	DevicePK      uuid.UUID
	Vendor        Vendor
	DeviceID      string
	RemoteAddr    netip.AddrPort
	OpenedAt      time.Time
	LastHeartbeat time.Time

	// Closer is the vendor-specific teardown. Called on Stop.
	Closer func() error

	// StreamStarter accepts a channel index and returns the RTSP URL that
	// the media bridge should pull. Implemented by the vendor listener.
	StreamStarter func(ctx context.Context, channel int) (localRTSP string, codec string, err error)

	// StreamStopper tears down a specific channel stream.
	StreamStopper func(ctx context.Context, channel int) error

	// PTZCommander dispatches PTZ actions to the device.
	PTZCommander func(ctx context.Context, cmd PTZCommand) error

	// Snapshotter grabs a JPEG from the given channel.
	Snapshotter func(ctx context.Context, channel int) ([]byte, error)
}

type PTZCommand struct {
	Channel int
	Action  string // pan_left | pan_right | tilt_up | tilt_down | zoom_in | zoom_out | stop | goto_preset
	Speed   int    // 1..8
	Preset  int
}

type Manager struct {
	pg   *Postgres
	rdb  *Redis
	kek  *crypto.KEK
	mets *metrics.Set

	mu     sync.RWMutex
	byID   map[uuid.UUID]*Handle
	byDev  map[string]*Handle // key = vendor + ":" + deviceID
}

// Postgres and Redis are aliased here so the manager doesn't import the concrete
// store type directly (keeps tests simple with interfaces).
type (
	Postgres = store.Postgres
	Redis    = store.Redis
)

func NewManager(pg *Postgres, rdb *Redis, kek *crypto.KEK, mets *metrics.Set) *Manager {
	return &Manager{
		pg:    pg,
		rdb:   rdb,
		kek:   kek,
		mets:  mets,
		byID:  make(map[uuid.UUID]*Handle),
		byDev: make(map[string]*Handle),
	}
}

// OnRegister is called by a vendor listener when a device opens the reverse
// connection. Returns the device record and whether the device is approved to
// proceed with login. The listener must not fetch a stream if approved=false.
func (m *Manager) OnRegister(ctx context.Context, vendor Vendor, deviceID string, addr netip.AddrPort) (*store.Device, bool, *Credentials, error) {
	dev, inserted, err := m.pg.UpsertSeen(ctx, string(vendor), deviceID)
	if err != nil {
		return nil, false, nil, fmt.Errorf("upsert device: %w", err)
	}
	if inserted {
		log.Info().Str("vendor", string(vendor)).Str("device_id", deviceID).Str("from", addr.String()).Msg("new device, pending approval")
		m.pg.Audit(ctx, "gateway", "device.first_seen", vendor.key(deviceID), nil)
		m.mets.DevicesTotal.WithLabelValues(string(vendor), "pending_approval").Inc()
	}
	if dev.Status != "approved" {
		return dev, false, nil, nil
	}

	creds, err := m.decryptCreds(dev)
	if err != nil {
		return dev, false, nil, fmt.Errorf("decrypt creds for approved device: %w", err)
	}
	return dev, true, creds, nil
}

func (m *Manager) decryptCreds(dev *store.Device) (*Credentials, error) {
	user, err := m.kek.Decrypt(dev.UsernameEnc)
	if err != nil {
		return nil, err
	}
	pass, err := m.kek.Decrypt(dev.PasswordEnc)
	if err != nil {
		return nil, err
	}
	c := &Credentials{Username: string(user), Password: string(pass)}
	if len(dev.ISUPKeyEnc) > 0 {
		k, err := m.kek.Decrypt(dev.ISUPKeyEnc)
		if err != nil {
			return nil, err
		}
		c.ISUPKey = string(k)
	}
	return c, nil
}

// OpenSession records the session in Postgres and registers the handle in memory.
func (m *Manager) OpenSession(ctx context.Context, dev *store.Device, h *Handle) error {
	sid, err := m.pg.OpenSession(ctx, dev.ID, h.RemoteAddr, "", "")
	if err != nil {
		return err
	}
	h.SessionID = sid
	h.DevicePK = dev.ID
	h.OpenedAt = time.Now()
	h.LastHeartbeat = time.Now()

	m.mu.Lock()
	m.byID[sid] = h
	m.byDev[string(h.Vendor)+":"+h.DeviceID] = h
	m.mu.Unlock()

	if err := m.pg.MarkSessionOnline(ctx, sid); err != nil {
		log.Warn().Err(err).Msg("mark online failed")
	}
	m.mets.SessionsOnline.WithLabelValues(string(h.Vendor)).Inc()
	m.broadcastState(ctx, h, "online")
	return nil
}

func (m *Manager) Heartbeat(ctx context.Context, sessID uuid.UUID) {
	m.mu.Lock()
	h, ok := m.byID[sessID]
	if ok {
		h.LastHeartbeat = time.Now()
	}
	m.mu.Unlock()
	if ok {
		_ = m.pg.Heartbeat(ctx, sessID)
		m.mets.HeartbeatsTotal.WithLabelValues(string(h.Vendor)).Inc()
	}
}

func (m *Manager) CloseSession(ctx context.Context, sessID uuid.UUID) error {
	m.mu.Lock()
	h, ok := m.byID[sessID]
	if ok {
		delete(m.byID, sessID)
		delete(m.byDev, string(h.Vendor)+":"+h.DeviceID)
	}
	m.mu.Unlock()
	if !ok {
		return errors.New("session not found")
	}

	if h.Closer != nil {
		if err := h.Closer(); err != nil {
			log.Warn().Err(err).Str("sess", sessID.String()).Msg("vendor closer error")
		}
	}
	if err := m.pg.CloseSession(ctx, sessID); err != nil {
		return err
	}
	m.mets.SessionsOnline.WithLabelValues(string(h.Vendor)).Dec()
	m.broadcastState(ctx, h, "disconnected")
	return nil
}

func (m *Manager) Get(sessID uuid.UUID) (*Handle, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	h, ok := m.byID[sessID]
	return h, ok
}

func (m *Manager) List() []*Handle {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]*Handle, 0, len(m.byID))
	for _, h := range m.byID {
		out = append(out, h)
	}
	return out
}

func (m *Manager) DrainAll(ctx context.Context) {
	m.mu.RLock()
	snapshot := make([]uuid.UUID, 0, len(m.byID))
	for id := range m.byID {
		snapshot = append(snapshot, id)
	}
	m.mu.RUnlock()

	for _, id := range snapshot {
		if err := m.CloseSession(ctx, id); err != nil {
			log.Warn().Err(err).Str("sess", id.String()).Msg("drain close")
		}
	}
}

func (m *Manager) broadcastState(ctx context.Context, h *Handle, state string) {
	payload, _ := json.Marshal(map[string]any{
		"session_id": h.SessionID,
		"device_id":  h.DeviceID,
		"vendor":     h.Vendor,
		"state":      state,
		"ts":         time.Now().UnixMilli(),
	})
	if err := m.rdb.Publish(ctx, "reverse:sessions", payload); err != nil {
		log.Debug().Err(err).Msg("redis publish session state")
	}
}

func (v Vendor) key(devID string) string { return string(v) + ":" + devID }
