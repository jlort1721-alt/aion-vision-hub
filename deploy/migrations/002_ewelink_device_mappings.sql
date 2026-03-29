CREATE TABLE IF NOT EXISTS ewelink_device_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'tenant-001',
  ewelink_device_id TEXT NOT NULL,
  site_id UUID REFERENCES sites(id),
  device_type TEXT CHECK (device_type IN ('door_pedestrian','door_vehicular','siren','light','lock','relay')),
  label TEXT NOT NULL,
  requires_confirmation BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, ewelink_device_id)
);
CREATE INDEX IF NOT EXISTS idx_ewm_tenant ON ewelink_device_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ewm_site ON ewelink_device_mappings(site_id);
