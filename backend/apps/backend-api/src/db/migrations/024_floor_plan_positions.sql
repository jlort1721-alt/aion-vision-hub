-- Floor plan device positions
-- Stores x/y coordinates of devices on site floor plans
CREATE TABLE IF NOT EXISTS floor_plan_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  x NUMERIC(7,2) NOT NULL DEFAULT 0,
  y NUMERIC(7,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_floor_plan_pos_device UNIQUE (site_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_fp_positions_site ON floor_plan_positions(site_id);
CREATE INDEX IF NOT EXISTS idx_fp_positions_tenant ON floor_plan_positions(tenant_id);
