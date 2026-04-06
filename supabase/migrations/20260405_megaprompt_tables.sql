-- ═══════════════════════════════════════════════════════════════════════════
-- Megaprompt Tables: floor_plans, clips, operator_site_assignments
-- Adds support for floor plan uploads, video clip exports, and
-- operator-to-site assignment management.
-- ═══════════════════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  1. FLOOR_PLANS — Uploaded floor plan images per site    ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.floor_plans (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id     UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  filename    VARCHAR(255) NOT NULL,
  file_path   TEXT NOT NULL,
  mime_type   VARCHAR(100) NOT NULL DEFAULT 'image/png',
  file_size   BIGINT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_floor_plans_tenant_site UNIQUE (tenant_id, site_id)
);

ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'floor_plans' AND policyname = 'Tenant sees floor plans') THEN
    CREATE POLICY "Tenant sees floor plans"
    ON public.floor_plans FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'floor_plans' AND policyname = 'Operators create floor plans') THEN
    CREATE POLICY "Operators create floor plans"
    ON public.floor_plans FOR INSERT TO authenticated
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'floor_plans' AND policyname = 'Operators update floor plans') THEN
    CREATE POLICY "Operators update floor plans"
    ON public.floor_plans FOR UPDATE TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'floor_plans' AND policyname = 'Admins delete floor plans') THEN
    CREATE POLICY "Admins delete floor plans"
    ON public.floor_plans FOR DELETE TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE TRIGGER update_floor_plans_updated_at
  BEFORE UPDATE ON public.floor_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_floor_plans_tenant
  ON public.floor_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_floor_plans_site
  ON public.floor_plans(site_id);
CREATE INDEX IF NOT EXISTS idx_floor_plans_uploaded_by
  ON public.floor_plans(uploaded_by);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  2. CLIPS — Exported video clip metadata                 ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.clips (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  camera_id        UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  device_id        UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  filename         VARCHAR(255) NOT NULL,
  file_path        TEXT NOT NULL,
  file_size        BIGINT,
  duration_sec     INTEGER,
  quality          VARCHAR(20) DEFAULT 'high',
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clips' AND policyname = 'Tenant sees clips') THEN
    CREATE POLICY "Tenant sees clips"
    ON public.clips FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clips' AND policyname = 'Operators create clips') THEN
    CREATE POLICY "Operators create clips"
    ON public.clips FOR INSERT TO authenticated
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clips' AND policyname = 'Operators update clips') THEN
    CREATE POLICY "Operators update clips"
    ON public.clips FOR UPDATE TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clips' AND policyname = 'Admins delete clips') THEN
    CREATE POLICY "Admins delete clips"
    ON public.clips FOR DELETE TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE TRIGGER update_clips_updated_at
  BEFORE UPDATE ON public.clips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_clips_tenant_created
  ON public.clips(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clips_device
  ON public.clips(device_id);
CREATE INDEX IF NOT EXISTS idx_clips_tenant_time_range
  ON public.clips(tenant_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_clips_exported_by
  ON public.clips(exported_by);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║  3. OPERATOR_SITE_ASSIGNMENTS — User↔Site assignments    ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.operator_site_assignments (
  id        UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_id   UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_operator_site_assignment UNIQUE (user_id, site_id)
);

ALTER TABLE public.operator_site_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operator_site_assignments' AND policyname = 'Tenant sees operator site assignments') THEN
    CREATE POLICY "Tenant sees operator site assignments"
    ON public.operator_site_assignments FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operator_site_assignments' AND policyname = 'Admins create operator site assignments') THEN
    CREATE POLICY "Admins create operator site assignments"
    ON public.operator_site_assignments FOR INSERT TO authenticated
    WITH CHECK (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operator_site_assignments' AND policyname = 'Admins update operator site assignments') THEN
    CREATE POLICY "Admins update operator site assignments"
    ON public.operator_site_assignments FOR UPDATE TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operator_site_assignments' AND policyname = 'Admins delete operator site assignments') THEN
    CREATE POLICY "Admins delete operator site assignments"
    ON public.operator_site_assignments FOR DELETE TO authenticated
    USING (
      tenant_id = get_user_tenant_id(auth.uid())
      AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
    );
  END IF;
END $$;

CREATE TRIGGER update_operator_site_assignments_updated_at
  BEFORE UPDATE ON public.operator_site_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_osa_tenant
  ON public.operator_site_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_osa_user
  ON public.operator_site_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_osa_site
  ON public.operator_site_assignments(site_id);
CREATE INDEX IF NOT EXISTS idx_osa_tenant_user
  ON public.operator_site_assignments(tenant_id, user_id);
