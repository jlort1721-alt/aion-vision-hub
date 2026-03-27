-- ================================================================
-- AION Residents Table — Multi-tenant extension
-- Creates the residents table if it doesn't exist
-- Run this BEFORE the seed batches
-- ================================================================

CREATE TABLE IF NOT EXISTS public.residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  unit_number TEXT,
  full_name TEXT NOT NULL,
  phone_primary TEXT,
  notes TEXT,
  resident_type TEXT NOT NULL DEFAULT 'resident',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_residents_tenant ON public.residents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_residents_site ON public.residents(site_id);
CREATE INDEX IF NOT EXISTS idx_residents_unit ON public.residents(unit_number);
CREATE INDEX IF NOT EXISTS idx_residents_name ON public.residents(full_name);
CREATE INDEX IF NOT EXISTS idx_residents_tenant_site ON public.residents(tenant_id, site_id);

-- Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_residents_updated_at'
  ) THEN
    CREATE TRIGGER update_residents_updated_at
      BEFORE UPDATE ON public.residents
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- RLS
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'residents' AND policyname = 'Tenant sees residents'
  ) THEN
    CREATE POLICY "Tenant sees residents"
      ON public.residents FOR SELECT TO authenticated
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'residents' AND policyname = 'Admins manage residents'
  ) THEN
    CREATE POLICY "Admins manage residents"
      ON public.residents FOR ALL TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'operator'))
      )
      WITH CHECK (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'operator'))
      );
  END IF;
END $$;

COMMENT ON TABLE public.residents IS 'Residents directory per site. Multi-tenant with RLS.';
