-- ═══════════════════════════════════════════════════════════
-- AION — Vehicles table (authorized plates per site)
-- Migration: 20260327200000_vehicles_table
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plate VARCHAR(20) NOT NULL,
  vehicle_type VARCHAR(30) NOT NULL DEFAULT 'car',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_site ON public.vehicles(site_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant ON public.vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON public.vehicles(plate);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_tenant_site_plate
  ON public.vehicles(tenant_id, site_id, plate);

-- RLS
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant sees vehicles"
  ON public.vehicles FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Admins manage vehicles"
  ON public.vehicles FOR ALL TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin'))
  );

COMMENT ON TABLE public.vehicles IS 'Authorized vehicle plates per site. Used by LPR/access control.';
