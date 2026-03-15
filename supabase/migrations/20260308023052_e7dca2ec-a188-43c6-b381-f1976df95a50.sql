
-- Sections table (50 configurable sections per tenant)
CREATE TABLE public.sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'post',
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant sees sections" ON public.sections FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Admins manage sections" ON public.sections FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin')));

-- Domotic devices
CREATE TABLE public.domotic_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'relay',
  brand TEXT NOT NULL DEFAULT 'Sonoff',
  model TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'offline',
  state TEXT NOT NULL DEFAULT 'off',
  last_action TEXT,
  last_sync TIMESTAMPTZ,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.domotic_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant sees domotic devices" ON public.domotic_devices FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Admins manage domotic devices" ON public.domotic_devices FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator')));

-- Domotic actions log
CREATE TABLE public.domotic_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.domotic_devices(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  result TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.domotic_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant sees domotic actions" ON public.domotic_actions FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Users create domotic actions" ON public.domotic_actions FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Access people (residents, visitors)
CREATE TABLE public.access_people (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'resident',
  full_name TEXT NOT NULL,
  document_id TEXT,
  phone TEXT,
  email TEXT,
  unit TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.access_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant sees access people" ON public.access_people FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Operators manage access people" ON public.access_people FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator')));

-- Access vehicles
CREATE TABLE public.access_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.access_people(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  color TEXT,
  type TEXT NOT NULL DEFAULT 'car',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.access_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant sees access vehicles" ON public.access_vehicles FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Operators manage access vehicles" ON public.access_vehicles FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator')));

-- Access logs
CREATE TABLE public.access_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  person_id UUID REFERENCES public.access_people(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.access_vehicles(id) ON DELETE SET NULL,
  direction TEXT NOT NULL DEFAULT 'in',
  method TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  operator_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant sees access logs" ON public.access_logs FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Operators create access logs" ON public.access_logs FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Reboot tasks
CREATE TABLE public.reboot_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  recovery_time_seconds INTEGER,
  initiated_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.reboot_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant sees reboot tasks" ON public.reboot_tasks FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Operators manage reboot tasks" ON public.reboot_tasks FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator')));

-- Intercom devices
CREATE TABLE public.intercom_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'Fanvil',
  model TEXT NOT NULL DEFAULT '',
  ip_address TEXT,
  sip_uri TEXT,
  status TEXT NOT NULL DEFAULT 'offline',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.intercom_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant sees intercom devices" ON public.intercom_devices FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Admins manage intercom devices" ON public.intercom_devices FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin')));

-- Intercom calls
CREATE TABLE public.intercom_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.intercom_devices(id) ON DELETE SET NULL,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  direction TEXT NOT NULL DEFAULT 'inbound',
  duration_seconds INTEGER,
  attended_by TEXT NOT NULL DEFAULT 'operator',
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.intercom_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant sees intercom calls" ON public.intercom_calls FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Operators create intercom calls" ON public.intercom_calls FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Database records (operational central DB)
CREATE TABLE public.database_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.database_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant sees database records" ON public.database_records FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Operators manage database records" ON public.database_records FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator')));
