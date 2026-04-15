-- =============================================================================
-- seed-qa-tenant-cleanup.sql — borra TODO el tenant QA en orden seguro
-- -----------------------------------------------------------------------------
-- USO:
--   psql -U aion -d aion -f db/seeds/seed-qa-tenant-cleanup.sql
--
-- Borra en orden de dependencias FK. Usa los UUIDs fijos del seed.
-- Idempotente: si ya esta vacio, no falla.
-- =============================================================================

\set ON_ERROR_STOP on

DO $$
DECLARE
  v_tenant_id  UUID := '11111111-1111-1111-1111-111111111111';
  v_site_id    UUID := '22222222-2222-2222-2222-222222222222';
  v_qa_users UUID[] := ARRAY[
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
    '66666666-6666-6666-6666-666666666666'
  ];
BEGIN
  -- Children first
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='patrol_checkpoints') THEN
    DELETE FROM public.patrol_checkpoints
     WHERE patrol_id IN (SELECT id FROM public.patrols WHERE site_id = v_site_id);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='minuta') THEN
    DELETE FROM public.minuta WHERE site_id = v_site_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='patrols') THEN
    DELETE FROM public.patrols WHERE site_id = v_site_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='checkpoints') THEN
    DELETE FROM public.checkpoints WHERE site_id = v_site_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='patrol_routes') THEN
    DELETE FROM public.patrol_routes WHERE site_id = v_site_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='shifts') THEN
    DELETE FROM public.shifts WHERE site_id = v_site_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='access_events') THEN
    DELETE FROM public.access_events WHERE controller_id IN (
      SELECT id FROM public.access_control_devices WHERE site_id = v_site_id
    );
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='visitors') THEN
    DELETE FROM public.visitors WHERE site_id = v_site_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='access_control_devices') THEN
    DELETE FROM public.access_control_devices WHERE site_id = v_site_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='guards') THEN
    DELETE FROM public.guards WHERE site_id = v_site_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='residents') THEN
    DELETE FROM public.residents WHERE site_id = v_site_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='units') THEN
    DELETE FROM public.units WHERE site_id = v_site_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='user_site_access') THEN
    DELETE FROM public.user_site_access WHERE site_id = v_site_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='consent_records') THEN
    DELETE FROM public.consent_records WHERE subject_user_id = ANY(v_qa_users);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='users') THEN
    DELETE FROM public.users WHERE id = ANY(v_qa_users);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='auth' AND table_name='users') THEN
    DELETE FROM auth.users WHERE id = ANY(v_qa_users);
  END IF;

  DELETE FROM public.sites    WHERE id = v_site_id;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='tenants') THEN
    DELETE FROM public.tenants WHERE id = v_tenant_id;
  END IF;

  RAISE NOTICE 'QA tenant cleaned up';
END $$;

DROP VIEW IF EXISTS public.v_qa_seed_status;
