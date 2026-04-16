-- 034: Explicit camera ↔ device links (intercom, door, iot_relay, sensor)
-- Replaces fragile section-based inference with direct mapping

CREATE TABLE IF NOT EXISTS camera_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  camera_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  linked_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('intercom','door','iot_relay','sensor')),
  priority INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (camera_id, linked_device_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_camera_links_camera ON camera_links(camera_id);
CREATE INDEX IF NOT EXISTS idx_camera_links_tenant ON camera_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_camera_links_linked ON camera_links(linked_device_id);

ALTER TABLE camera_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_links FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'camera_links_tenant_isolation') THEN
    CREATE POLICY camera_links_tenant_isolation ON camera_links
      USING (tenant_id = current_setting('request.jwt.claim.tenant_id', true)::uuid);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'camera_links_admin_full') THEN
    CREATE POLICY camera_links_admin_full ON camera_links
      USING (current_setting('request.jwt.claim.role', true) IN ('super_admin', 'tenant_admin'));
  END IF;
END $$;
