-- Migration 011: Refresh tokens table + performance indices
-- Supports secure refresh token rotation with reuse detection

-- ── Refresh Tokens ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash varchar(128) NOT NULL UNIQUE,
  family uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens (family);

-- ── Performance Indices ─────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_tenant_created
  ON events (tenant_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_tenant_severity_status
  ON events (tenant_id, severity, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_tenant_created
  ON audit_logs (tenant_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incidents_tenant_status
  ON incidents (tenant_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_tenant_status
  ON devices (tenant_id, status);

-- ── WhatsApp O(1) tenant lookup by phone number ID ──────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_integrations_wa_phone
  ON integrations ((config->>'phoneNumberId'))
  WHERE type = 'whatsapp';
