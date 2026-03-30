-- Migration: Domotics audit log table
-- Run on: aionseg_prod database

CREATE TABLE IF NOT EXISTS domotics_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  device_id TEXT NOT NULL,
  device_name TEXT,
  site_id UUID,
  site_name TEXT,
  action TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'mcp',
  result TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domotics_audit_device ON domotics_audit_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_domotics_audit_site ON domotics_audit_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_domotics_audit_created ON domotics_audit_logs(created_at DESC);
