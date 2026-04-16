-- ============================================================
-- Migration: Add Hikvision HCNetSDK Bridge support
-- Extends devices table with SDK status fields
-- Creates hik_recordings table for SDK file downloads
-- ============================================================

-- 1. Add SDK status tracking to existing devices table
ALTER TABLE devices ADD COLUMN IF NOT EXISTS hik_sdk_status text;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS hik_sdk_connected_at timestamptz;

-- 2. Create recordings table for SDK file-level downloads
CREATE TABLE IF NOT EXISTS hik_recordings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  channel integer NOT NULL DEFAULT 1,
  file_name text NOT NULL,
  file_size bigint,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  file_type text DEFAULT 'video',
  download_status text DEFAULT 'pending',
  local_path text,
  requested_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_hik_rec_device_time
  ON hik_recordings(device_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_hik_rec_tenant
  ON hik_recordings(tenant_id);

-- 4. Add comment for documentation
COMMENT ON TABLE hik_recordings IS 'Recording files discovered/downloaded via HCNetSDK (port 8000)';
COMMENT ON COLUMN devices.hik_sdk_status IS 'SDK connection status: connected, disconnected, unsupported, error';
COMMENT ON COLUMN devices.hik_sdk_connected_at IS 'Timestamp of last successful SDK login';
