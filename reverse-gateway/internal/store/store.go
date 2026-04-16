// Package store wraps the Postgres and Redis connections used by the gateway.
//
// All SQL lives here, not scattered. Every query is parameterized.
package store

import (
	"context"
	"errors"
	"fmt"
	"net/netip"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// ---------- Postgres ----------

type Postgres struct {
	pool *pgxpool.Pool
}

func OpenPostgres(ctx context.Context, dsn string) (*Postgres, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse dsn: %w", err)
	}
	cfg.MaxConns = 20
	cfg.MinConns = 2
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Postgres{pool: pool}, nil
}

func (p *Postgres) Close()                        { p.pool.Close() }
func (p *Postgres) Ping(ctx context.Context) error { return p.pool.Ping(ctx) }

// ---------- Device ----------

type Device struct {
	ID             uuid.UUID
	Vendor         string
	DeviceID       string
	SiteID         *uuid.UUID
	DisplayName    string
	ChannelCount   int
	UsernameEnc    []byte
	PasswordEnc    []byte
	ISUPKeyEnc     []byte
	Status         string
	FirstSeenAt    time.Time
	LastSeenAt     *time.Time
}

var ErrDeviceNotFound = errors.New("device not found")

// UpsertSeen creates the device row on first contact, updates last_seen_at otherwise.
// Never promotes status — approval is explicit.
func (p *Postgres) UpsertSeen(ctx context.Context, vendor, deviceID string) (*Device, bool, error) {
	const q = `
		INSERT INTO reverse.devices (vendor, device_id, status, first_seen_at, last_seen_at)
		VALUES ($1, $2, 'pending_approval', now(), now())
		ON CONFLICT (vendor, device_id) DO UPDATE SET last_seen_at = now()
		RETURNING id, vendor, device_id, site_id, display_name, channel_count,
		          username_enc, password_enc, isup_key_enc, status, first_seen_at, last_seen_at,
		          (xmax = 0) AS inserted
	`
	d := &Device{}
	var inserted bool
	err := p.pool.QueryRow(ctx, q, vendor, deviceID).Scan(
		&d.ID, &d.Vendor, &d.DeviceID, &d.SiteID, &d.DisplayName, &d.ChannelCount,
		&d.UsernameEnc, &d.PasswordEnc, &d.ISUPKeyEnc, &d.Status, &d.FirstSeenAt, &d.LastSeenAt,
		&inserted,
	)
	if err != nil {
		return nil, false, err
	}
	return d, inserted, nil
}

func (p *Postgres) GetDevice(ctx context.Context, vendor, deviceID string) (*Device, error) {
	const q = `
		SELECT id, vendor, device_id, site_id, display_name, channel_count,
		       username_enc, password_enc, isup_key_enc, status, first_seen_at, last_seen_at
		FROM reverse.devices WHERE vendor=$1 AND device_id=$2
	`
	d := &Device{}
	err := p.pool.QueryRow(ctx, q, vendor, deviceID).Scan(
		&d.ID, &d.Vendor, &d.DeviceID, &d.SiteID, &d.DisplayName, &d.ChannelCount,
		&d.UsernameEnc, &d.PasswordEnc, &d.ISUPKeyEnc, &d.Status, &d.FirstSeenAt, &d.LastSeenAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrDeviceNotFound
	}
	return d, err
}

// ---------- Session ----------

type Session struct {
	ID            uuid.UUID
	DevicePK      uuid.UUID
	RemoteAddr    string
	State         string
	OpenedAt      time.Time
	ClosedAt      *time.Time
	LastHeartbeat *time.Time
	Firmware      string
	SDKVersion    string
}

func (p *Postgres) OpenSession(ctx context.Context, devicePK uuid.UUID, addr netip.AddrPort, firmware, sdkVer string) (uuid.UUID, error) {
	const q = `
		INSERT INTO reverse.sessions (device_pk, remote_addr, state, firmware, sdk_version, last_heartbeat)
		VALUES ($1, $2, 'connecting', $3, $4, now())
		RETURNING id
	`
	var id uuid.UUID
	err := p.pool.QueryRow(ctx, q, devicePK, addr.Addr().String(), firmware, sdkVer).Scan(&id)
	return id, err
}

func (p *Postgres) MarkSessionOnline(ctx context.Context, id uuid.UUID) error {
	_, err := p.pool.Exec(ctx, `UPDATE reverse.sessions SET state='online', last_heartbeat=now() WHERE id=$1`, id)
	return err
}

func (p *Postgres) Heartbeat(ctx context.Context, id uuid.UUID) error {
	_, err := p.pool.Exec(ctx, `UPDATE reverse.sessions SET last_heartbeat=now() WHERE id=$1 AND state IN ('online','degraded')`, id)
	return err
}

func (p *Postgres) CloseSession(ctx context.Context, id uuid.UUID) error {
	_, err := p.pool.Exec(ctx, `UPDATE reverse.sessions SET state='disconnected', closed_at=now() WHERE id=$1 AND closed_at IS NULL`, id)
	return err
}

// ---------- Streams ----------

func (p *Postgres) InsertStream(ctx context.Context, sessionID uuid.UUID, channel int, go2rtcName, codec, resolution string) (uuid.UUID, error) {
	const q = `
		INSERT INTO reverse.streams (session_id, channel, go2rtc_name, codec, resolution)
		VALUES ($1, $2, $3, $4, $5) RETURNING id
	`
	var id uuid.UUID
	err := p.pool.QueryRow(ctx, q, sessionID, channel, go2rtcName, codec, resolution).Scan(&id)
	return id, err
}

func (p *Postgres) StopStream(ctx context.Context, streamID uuid.UUID) error {
	_, err := p.pool.Exec(ctx, `UPDATE reverse.streams SET stopped_at=now() WHERE id=$1 AND stopped_at IS NULL`, streamID)
	return err
}

// ---------- Events ----------

func (p *Postgres) InsertEvent(ctx context.Context, devicePK uuid.UUID, channel int, kind string, payload []byte) error {
	_, err := p.pool.Exec(ctx,
		`INSERT INTO reverse.events (device_pk, channel, kind, payload) VALUES ($1, $2, $3, $4)`,
		devicePK, channel, kind, payload)
	return err
}

// ---------- Audit ----------

func (p *Postgres) Audit(ctx context.Context, actor, action, target string, details []byte) {
	// best-effort; never block hot path on audit write failure
	_, _ = p.pool.Exec(ctx,
		`INSERT INTO reverse.audit_log (actor, action, target, details) VALUES ($1, $2, $3, $4)`,
		actor, action, target, details)
}

// ---------- Redis ----------

type Redis struct {
	cli *redis.Client
}

func OpenRedis(ctx context.Context, addr, password string, db int) (*Redis, error) {
	cli := redis.NewClient(&redis.Options{Addr: addr, Password: password, DB: db})
	if err := cli.Ping(ctx).Err(); err != nil {
		return nil, err
	}
	return &Redis{cli: cli}, nil
}

func (r *Redis) Close() error { return r.cli.Close() }

func (r *Redis) Publish(ctx context.Context, channel string, payload []byte) error {
	return r.cli.Publish(ctx, channel, payload).Err()
}

func (r *Redis) SetSessionCache(ctx context.Context, sessID uuid.UUID, data []byte, ttl time.Duration) error {
	return r.cli.Set(ctx, "reverse:sess:"+sessID.String(), data, ttl).Err()
}
