-- ═══════════════════════════════════════════════════════════
-- AION — Real Operational Data Schema for Clave Seguridad CTA
-- 22 security sites in Medellin, Colombia
-- Migration: 20260327100000_real_data_schema
-- ═══════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── NETWORK CONFIGURATIONS (sensitive - encrypted) ─────────
CREATE TABLE IF NOT EXISTS public.network_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  wan_ip_encrypted BYTEA,
  wan_subnet VARCHAR(50),
  wan_gateway_encrypted BYTEA,
  lan_ip VARCHAR(20),
  isp VARCHAR(100),
  connection_type VARCHAR(50) DEFAULT 'fibra',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_network_configs_updated_at
  BEFORE UPDATE ON public.network_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── NETWORK DEVICES (DVR, NVR, cameras, access control) ────
CREATE TABLE IF NOT EXISTS public.network_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_name VARCHAR(200),
  device_type VARCHAR(100),
  brand VARCHAR(100),
  model VARCHAR(100),
  lan_ip VARCHAR(20),
  port INTEGER,
  username_encrypted BYTEA,
  password_encrypted BYTEA,
  remote_access_app VARCHAR(100),
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_network_devices_updated_at
  BEFORE UPDATE ON public.network_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── ACCESS POINTS (doors/gates with codes) ─────────────────
CREATE TABLE IF NOT EXISTS public.access_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR(200),
  access_type VARCHAR(50),
  methods JSONB DEFAULT '{}',
  ewelink_code_encrypted BYTEA,
  intercom_code_encrypted BYTEA,
  intercom_number VARCHAR(20),
  has_plate_reader BOOLEAN DEFAULT false,
  has_biometric BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CONSIGNAS (special instructions per unit) ──────────────
CREATE TABLE IF NOT EXISTS public.consignas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_number VARCHAR(20),
  instruction TEXT NOT NULL,
  authorized_by VARCHAR(200),
  authorized_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SITE ADMINISTRATORS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_administrators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR(300),
  phone VARCHAR(50),
  role VARCHAR(100) DEFAULT 'administrador',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INTERCOMS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.intercoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location VARCHAR(200),
  number INTEGER,
  code VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ZONE COORDINATORS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.zone_coordinators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  zone_name VARCHAR(100),
  coordinator_name VARCHAR(200),
  coordinator_phone VARCHAR(50),
  site_names TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SYSTEM CREDENTIALS (encrypted — super_admin only) ──────
CREATE TABLE IF NOT EXISTS public.system_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  system_name VARCHAR(200),
  username_encrypted BYTEA,
  password_encrypted BYTEA,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── CCTV EQUIPMENT ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cctv_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  equipment_type VARCHAR(100),
  quantity INTEGER DEFAULT 1,
  description TEXT,
  camera_names TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── BIOMETRIC RECORDS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.biometric_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  resident_name VARCHAR(300),
  unit_number VARCHAR(20),
  has_biometric BOOLEAN DEFAULT false,
  has_plate_recognition BOOLEAN DEFAULT false,
  has_rfid_tag BOOLEAN DEFAULT false,
  has_sticker BOOLEAN DEFAULT false,
  card_number VARCHAR(50),
  access_zones TEXT[],
  technician VARCHAR(200),
  registered_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_biometric_records_updated_at
  BEFORE UPDATE ON public.biometric_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_network_configs_site ON public.network_configs(site_id);
CREATE INDEX IF NOT EXISTS idx_network_configs_tenant ON public.network_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_network_devices_site ON public.network_devices(site_id);
CREATE INDEX IF NOT EXISTS idx_network_devices_tenant ON public.network_devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_network_devices_type ON public.network_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_network_devices_online ON public.network_devices(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_access_points_site ON public.access_points(site_id);
CREATE INDEX IF NOT EXISTS idx_access_points_tenant ON public.access_points(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consignas_site ON public.consignas(site_id);
CREATE INDEX IF NOT EXISTS idx_consignas_tenant ON public.consignas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consignas_active ON public.consignas(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_site_admins_site ON public.site_administrators(site_id);
CREATE INDEX IF NOT EXISTS idx_site_admins_tenant ON public.site_administrators(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intercoms_site ON public.intercoms(site_id);
CREATE INDEX IF NOT EXISTS idx_intercoms_tenant ON public.intercoms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zone_coordinators_tenant ON public.zone_coordinators(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_credentials_tenant ON public.system_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cctv_site ON public.cctv_equipment(site_id);
CREATE INDEX IF NOT EXISTS idx_cctv_tenant ON public.cctv_equipment(tenant_id);
CREATE INDEX IF NOT EXISTS idx_biometric_site ON public.biometric_records(site_id);
CREATE INDEX IF NOT EXISTS idx_biometric_tenant ON public.biometric_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_biometric_unit ON public.biometric_records(unit_number);

-- ══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Pattern follows existing project conventions:
--   SELECT: tenant-scoped via get_user_tenant_id()
--   ALL (INSERT/UPDATE/DELETE): tenant_admin or super_admin
-- ══════════════════════════════════════════════════════════

ALTER TABLE public.network_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intercoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_coordinators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cctv_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_records ENABLE ROW LEVEL SECURITY;

-- ── network_configs ────────────────────────────────────────
CREATE POLICY "Tenant sees network_configs"
  ON public.network_configs FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins manage network_configs"
  ON public.network_configs FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

-- ── network_devices ────────────────────────────────────────
CREATE POLICY "Tenant sees network_devices"
  ON public.network_devices FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins manage network_devices"
  ON public.network_devices FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

-- ── access_points ──────────────────────────────────────────
CREATE POLICY "Tenant sees access_points"
  ON public.access_points FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins manage access_points"
  ON public.access_points FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

-- ── consignas ──────────────────────────────────────────────
CREATE POLICY "Tenant sees consignas"
  ON public.consignas FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins manage consignas"
  ON public.consignas FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

-- ── site_administrators ────────────────────────────────────
CREATE POLICY "Tenant sees site_administrators"
  ON public.site_administrators FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins manage site_administrators"
  ON public.site_administrators FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

-- ── intercoms ──────────────────────────────────────────────
CREATE POLICY "Tenant sees intercoms"
  ON public.intercoms FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins manage intercoms"
  ON public.intercoms FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

-- ── zone_coordinators ──────────────────────────────────────
CREATE POLICY "Tenant sees zone_coordinators"
  ON public.zone_coordinators FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins manage zone_coordinators"
  ON public.zone_coordinators FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

-- ── system_credentials (super_admin / tenant_admin ONLY) ───
CREATE POLICY "Admins see system_credentials"
  ON public.system_credentials FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

CREATE POLICY "Admins manage system_credentials"
  ON public.system_credentials FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'super_admin'))
  );

-- ── cctv_equipment ─────────────────────────────────────────
CREATE POLICY "Tenant sees cctv_equipment"
  ON public.cctv_equipment FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins manage cctv_equipment"
  ON public.cctv_equipment FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

-- ── biometric_records ──────────────────────────────────────
CREATE POLICY "Tenant sees biometric_records"
  ON public.biometric_records FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins manage biometric_records"
  ON public.biometric_records FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

-- ══════════════════════════════════════════════════════════
-- USEFUL VIEWS
-- ══════════════════════════════════════════════════════════

-- Site summary with device/access/cctv counts
CREATE OR REPLACE VIEW public.site_operational_summary AS
SELECT
  s.id,
  s.name,
  s.address,
  s.status,
  COUNT(DISTINCT nd.id) AS device_count,
  COUNT(DISTINCT ap.id) AS access_point_count,
  COUNT(DISTINCT ce.id) AS cctv_equipment_count,
  COUNT(DISTINCT sa.id) AS admin_count,
  COUNT(DISTINCT ic.id) AS intercom_count,
  COUNT(DISTINCT br.id) AS biometric_record_count
FROM public.sites s
LEFT JOIN public.network_devices nd ON nd.site_id = s.id
LEFT JOIN public.access_points ap ON ap.site_id = s.id
LEFT JOIN public.cctv_equipment ce ON ce.site_id = s.id
LEFT JOIN public.site_administrators sa ON sa.site_id = s.id
LEFT JOIN public.intercoms ic ON ic.site_id = s.id
LEFT JOIN public.biometric_records br ON br.site_id = s.id
GROUP BY s.id, s.name, s.address, s.status;

-- Network overview per site
CREATE OR REPLACE VIEW public.site_network_overview AS
SELECT
  s.id AS site_id,
  s.name AS site_name,
  nc.isp,
  nc.connection_type,
  nc.lan_ip AS network_lan_ip,
  COUNT(nd.id) AS total_devices,
  COUNT(nd.id) FILTER (WHERE nd.is_online = true) AS online_devices,
  COUNT(nd.id) FILTER (WHERE nd.is_online = false) AS offline_devices
FROM public.sites s
LEFT JOIN public.network_configs nc ON nc.site_id = s.id
LEFT JOIN public.network_devices nd ON nd.site_id = s.id
GROUP BY s.id, s.name, nc.isp, nc.connection_type, nc.lan_ip;

-- Active consignas view
CREATE OR REPLACE VIEW public.active_consignas AS
SELECT
  c.id,
  c.site_id,
  s.name AS site_name,
  c.unit_number,
  c.instruction,
  c.authorized_by,
  c.authorized_date,
  c.notes
FROM public.consignas c
JOIN public.sites s ON s.id = c.site_id
WHERE c.is_active = true;

-- ══════════════════════════════════════════════════════════
-- COMMENTS (for documentation in the DB catalog)
-- ══════════════════════════════════════════════════════════
COMMENT ON TABLE public.network_configs IS 'Network configuration per site (WAN/LAN, ISP). Sensitive IPs encrypted.';
COMMENT ON TABLE public.network_devices IS 'DVRs, NVRs, cameras, access controllers. Credentials encrypted.';
COMMENT ON TABLE public.access_points IS 'Physical entry points (doors, gates) with access methods and codes.';
COMMENT ON TABLE public.consignas IS 'Standing instructions (consignas) per residential unit.';
COMMENT ON TABLE public.site_administrators IS 'Building/complex administrators and their contact info.';
COMMENT ON TABLE public.intercoms IS 'Intercom units installed at each site.';
COMMENT ON TABLE public.zone_coordinators IS 'Zone-level coordinators overseeing multiple sites.';
COMMENT ON TABLE public.system_credentials IS 'Encrypted credentials for external systems. Super-admin access only.';
COMMENT ON TABLE public.cctv_equipment IS 'CCTV equipment inventory (cameras, recorders) per site.';
COMMENT ON TABLE public.biometric_records IS 'Biometric enrollment records for residents (fingerprint, plate, RFID, sticker).';
