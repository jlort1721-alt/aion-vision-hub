-- +migrate Up
-- =============================================================================
-- 025_enable_rls_global.sql — Activa Row Level Security en TODAS las tablas del
--                             schema public, y crea helpers de contexto JWT.
-- Bridge: COALESCE(auth.uid(), request.jwt.claim.sub) para compatibilidad
-- con Supabase PostgREST y Fastify directo.
-- =============================================================================

-- ---- Helpers de contexto (JWT claims) ----------------------------------------
-- Bridge pattern: tries Supabase auth.uid() first, falls back to set_config
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT COALESCE(
    auth.uid(),
    NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE SQL STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    'anon'
  )
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1),
    NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')::UUID
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT public.current_user_role() IN ('admin', 'superadmin', 'super_admin', 'tenant_admin', 'service_role')
$$;

CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT public.current_user_role() IN ('admin','superadmin','super_admin','tenant_admin','service_role','supervisor')
$$;

CREATE OR REPLACE FUNCTION public.is_guard()
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT public.current_user_role() IN ('admin','superadmin','super_admin','tenant_admin','service_role','supervisor','guard')
$$;

-- ---- Enable RLS + force on every table in public -----------------------------
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT IN ('schema_migrations')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',  t.tablename);
    EXECUTE format('ALTER TABLE public.%I FORCE  ROW LEVEL SECURITY',  t.tablename);
  END LOOP;
END $$;

-- ---- Super-admin bypass policy on every table (safety net) ------------------
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname='public' AND tablename NOT IN ('schema_migrations')
  LOOP
    EXECUTE format($f$
      DO $inner$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname='public' AND tablename='%1$I' AND policyname='admin_full_access'
        ) THEN
          EXECUTE 'CREATE POLICY admin_full_access ON public.%1$I
                   FOR ALL TO PUBLIC
                   USING (public.is_admin())
                   WITH CHECK (public.is_admin())';
        END IF;
      END
      $inner$;
    $f$, t.tablename);
  END LOOP;
END $$;


-- +migrate Down
DROP FUNCTION IF EXISTS public.is_guard()        CASCADE;
DROP FUNCTION IF EXISTS public.is_supervisor()   CASCADE;
DROP FUNCTION IF EXISTS public.is_admin()        CASCADE;
DROP FUNCTION IF EXISTS public.current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS public.current_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.current_user_id() CASCADE;

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS admin_full_access ON public.%I', t.tablename);
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
