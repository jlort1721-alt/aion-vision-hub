
-- ═══════════════════════════════════════════════════════════
-- AION VISION HUB — Complete Database Schema
-- ═══════════════════════════════════════════════════════════

-- Utility: updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ── Tenants ────────────────────────────────────────────────
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Profiles ───────────────────────────────────────────────
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Roles (enum + table) ──────────────────────────────────
CREATE TYPE public.app_role AS ENUM ('super_admin', 'tenant_admin', 'operator', 'viewer', 'auditor');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  UNIQUE(user_id, role, tenant_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: get user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- ── Sites ──────────────────────────────────────────────────
CREATE TABLE public.sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON public.sites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Device Groups ──────────────────────────────────────────
CREATE TABLE public.device_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT
);
ALTER TABLE public.device_groups ENABLE ROW LEVEL SECURITY;

-- ── Devices ────────────────────────────────────────────────
CREATE TABLE public.devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.device_groups(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'camera',
  brand TEXT NOT NULL DEFAULT 'generic_onvif',
  model TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 80,
  http_port INTEGER,
  rtsp_port INTEGER DEFAULT 554,
  onvif_port INTEGER DEFAULT 80,
  serial_number TEXT,
  firmware_version TEXT,
  mac_address TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  channels INTEGER NOT NULL DEFAULT 1,
  capabilities JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON public.devices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_devices_tenant ON public.devices(tenant_id);
CREATE INDEX idx_devices_site ON public.devices(site_id);
CREATE INDEX idx_devices_status ON public.devices(status);

-- ── Streams ────────────────────────────────────────────────
CREATE TABLE public.streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  channel INTEGER NOT NULL DEFAULT 1,
  type TEXT NOT NULL DEFAULT 'main',
  codec TEXT NOT NULL DEFAULT 'H.264',
  resolution TEXT NOT NULL DEFAULT '1920x1080',
  fps INTEGER NOT NULL DEFAULT 25,
  bitrate INTEGER,
  url_template TEXT NOT NULL DEFAULT '',
  protocol TEXT NOT NULL DEFAULT 'rtsp',
  is_active BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;

-- ── Events ─────────────────────────────────────────────────
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  channel INTEGER,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  status TEXT NOT NULL DEFAULT 'new',
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  snapshot_url TEXT,
  clip_url TEXT,
  assigned_to UUID REFERENCES auth.users(id),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_events_tenant ON public.events(tenant_id);
CREATE INDEX idx_events_severity ON public.events(severity);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_created ON public.events(created_at DESC);

-- ── Incidents ──────────────────────────────────────────────
CREATE TABLE public.incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  event_ids UUID[] DEFAULT '{}',
  evidence_urls TEXT[] DEFAULT '{}',
  comments JSONB NOT NULL DEFAULT '[]',
  ai_summary TEXT,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Integrations ───────────────────────────────────────────
CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive',
  config JSONB NOT NULL DEFAULT '{}',
  last_sync TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── MCP Connectors ─────────────────────────────────────────
CREATE TABLE public.mcp_connectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  endpoint TEXT,
  scopes TEXT[] DEFAULT '{}',
  health TEXT NOT NULL DEFAULT 'unknown',
  last_check TIMESTAMPTZ,
  error_count INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mcp_connectors ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_mcp_connectors_updated_at BEFORE UPDATE ON public.mcp_connectors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── AI Sessions ────────────────────────────────────────────
CREATE TABLE public.ai_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'lovable',
  model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  context_type TEXT,
  context_id TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;

-- ── Audit Logs ─────────────────────────────────────────────
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_state JSONB,
  after_state JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_logs_tenant ON public.audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ── Feature Flags ──────────────────────────────────────────
CREATE TABLE public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  tenant_override JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- ── Playback Requests ──────────────────────────────────────
CREATE TABLE public.playback_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  channel INTEGER NOT NULL DEFAULT 1,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  output_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.playback_requests ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════
-- RLS Policies — tenant-scoped access
-- ═══════════════════════════════════════════════════════════

-- Tenants: users can see their own tenant
CREATE POLICY "Users see own tenant" ON public.tenants
  FOR SELECT TO authenticated
  USING (id = public.get_user_tenant_id(auth.uid()));

-- Profiles: users see profiles in their tenant
CREATE POLICY "Users see tenant profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System creates profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User roles: viewable within tenant
CREATE POLICY "Users see tenant roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Sites: tenant-scoped
CREATE POLICY "Tenant sees own sites" ON public.sites
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins manage sites" ON public.sites
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin')));

-- Device groups: tenant-scoped
CREATE POLICY "Tenant sees device groups" ON public.device_groups
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins manage device groups" ON public.device_groups
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin')));

-- Devices: tenant-scoped
CREATE POLICY "Tenant sees devices" ON public.devices
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins manage devices" ON public.devices
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin')));

-- Streams: accessible if device is accessible
CREATE POLICY "Users see streams" ON public.streams
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_id AND d.tenant_id = public.get_user_tenant_id(auth.uid()))
  );

-- Events: tenant-scoped
CREATE POLICY "Tenant sees events" ON public.events
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant manages events" ON public.events
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Incidents: tenant-scoped
CREATE POLICY "Tenant sees incidents" ON public.incidents
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant manages incidents" ON public.incidents
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Integrations: tenant-scoped
CREATE POLICY "Tenant sees integrations" ON public.integrations
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins manage integrations" ON public.integrations
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin')));

-- MCP Connectors: tenant-scoped
CREATE POLICY "Tenant sees connectors" ON public.mcp_connectors
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins manage connectors" ON public.mcp_connectors
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin')));

-- AI Sessions: user's own sessions
CREATE POLICY "Users see own sessions" ON public.ai_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users create own sessions" ON public.ai_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own sessions" ON public.ai_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Audit logs: viewable by admins/auditors in tenant
CREATE POLICY "Admins/auditors see audit" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'auditor'))
  );

CREATE POLICY "System inserts audit" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Feature flags: readable by all authenticated
CREATE POLICY "All read feature flags" ON public.feature_flags
  FOR SELECT TO authenticated
  USING (true);

-- Playback requests: tenant-scoped
CREATE POLICY "Tenant sees playback requests" ON public.playback_requests
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users create playback requests" ON public.playback_requests
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND created_by = auth.uid());

-- ═══════════════════════════════════════════════════════════
-- Auto-create profile + default tenant on signup
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  default_tenant_id UUID;
BEGIN
  -- Get or create default tenant
  SELECT id INTO default_tenant_id FROM public.tenants WHERE slug = 'default' LIMIT 1;
  IF default_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, slug, timezone) VALUES ('Default Organization', 'default', 'UTC')
    RETURNING id INTO default_tenant_id;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (user_id, tenant_id, full_name)
  VALUES (
    NEW.id,
    default_tenant_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );

  -- Assign default role
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (NEW.id, 'operator', default_tenant_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
