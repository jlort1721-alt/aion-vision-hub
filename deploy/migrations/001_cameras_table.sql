-- Migration: Create cameras table for go2rtc stream management
-- Run on: aionseg_prod database
-- Date: 2026-03-29

CREATE TABLE IF NOT EXISTS cameras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'tenant-001',
  device_id UUID,
  site_id UUID,
  name TEXT NOT NULL,
  channel_number INTEGER NOT NULL DEFAULT 1,
  stream_key TEXT UNIQUE NOT NULL,
  brand TEXT DEFAULT 'hikvision' CHECK (brand IN ('hikvision', 'dahua', 'generic')),
  is_lpr BOOLEAN DEFAULT false,
  is_ptz BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'unknown' CHECK (status IN ('online','offline','unknown','error')),
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cameras_tenant ON cameras(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cameras_site ON cameras(site_id);
CREATE INDEX IF NOT EXISTS idx_cameras_stream_key ON cameras(stream_key);
CREATE INDEX IF NOT EXISTS idx_cameras_status ON cameras(status);
