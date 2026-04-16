-- migrations/001_reverse_schema.sql
--
-- AION Reverse-Connect Gateway: additive schema.
-- Rollback: DROP SCHEMA reverse CASCADE;
--
-- Guarantees:
--   * Does not touch any existing AION table.
--   * Foreign key to public.sites(id) is optional and will only be added if
--     public.sites exists. If your AION install uses a different site table,
--     fix the FK line below before applying.

BEGIN;

CREATE SCHEMA IF NOT EXISTS reverse;

-- ---------------------------------------------------------------- devices
CREATE TABLE IF NOT EXISTS reverse.devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor          TEXT NOT NULL CHECK (vendor IN ('dahua','hikvision')),
  device_id       TEXT NOT NULL,
  site_id         UUID,
  display_name    TEXT,
  channel_count   INT DEFAULT 1,
  username_enc    BYTEA,
  password_enc    BYTEA,
  isup_key_enc    BYTEA,
  status          TEXT NOT NULL DEFAULT 'pending_approval'
                  CHECK (status IN ('pending_approval','approved','blocked')),
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (vendor, device_id)
);
CREATE INDEX IF NOT EXISTS devices_status_idx ON reverse.devices (status);
CREATE INDEX IF NOT EXISTS devices_site_idx   ON reverse.devices (site_id) WHERE site_id IS NOT NULL;

-- Optional FK to public.sites — added inside a DO block so it's idempotent
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='sites')
     AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                     WHERE constraint_name='devices_site_fk'
                       AND table_schema='reverse' AND table_name='devices') THEN
    ALTER TABLE reverse.devices
      ADD CONSTRAINT devices_site_fk
      FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------- sessions
CREATE TABLE IF NOT EXISTS reverse.sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_pk       UUID NOT NULL REFERENCES reverse.devices(id) ON DELETE CASCADE,
  remote_addr     INET NOT NULL,
  state           TEXT NOT NULL DEFAULT 'connecting'
                  CHECK (state IN ('connecting','online','degraded','disconnected')),
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  last_heartbeat  TIMESTAMPTZ,
  firmware        TEXT,
  sdk_version     TEXT,
  capabilities    JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS sessions_device_state_idx ON reverse.sessions (device_pk, state);
CREATE INDEX IF NOT EXISTS sessions_online_idx       ON reverse.sessions (state) WHERE state = 'online';

-- ---------------------------------------------------------------- streams
CREATE TABLE IF NOT EXISTS reverse.streams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES reverse.sessions(id) ON DELETE CASCADE,
  channel         INT NOT NULL,
  go2rtc_name     TEXT NOT NULL UNIQUE,
  codec           TEXT,
  resolution      TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS streams_session_idx ON reverse.streams (session_id);

-- ---------------------------------------------------------------- events
CREATE TABLE IF NOT EXISTS reverse.events (
  id              BIGSERIAL PRIMARY KEY,
  device_pk       UUID NOT NULL REFERENCES reverse.devices(id) ON DELETE CASCADE,
  channel         INT,
  kind            TEXT NOT NULL,
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_device_time_idx ON reverse.events (device_pk, created_at DESC);
CREATE INDEX IF NOT EXISTS events_kind_time_idx   ON reverse.events (kind, created_at DESC);

-- ---------------------------------------------------------------- audit_log
CREATE TABLE IF NOT EXISTS reverse.audit_log (
  id              BIGSERIAL PRIMARY KEY,
  actor           TEXT NOT NULL,
  action          TEXT NOT NULL,
  target          TEXT,
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_target_idx ON reverse.audit_log (target, created_at DESC);

COMMIT;
