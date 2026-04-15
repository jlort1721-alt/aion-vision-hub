-- =============================================================================
-- seed-qa-tenant.sql — Datos de prueba para suite Playwright E2E
-- -----------------------------------------------------------------------------
-- Crea un tenant aislado "QA Test Tenant" con UUIDs FIJOS y conocidos para
-- que .env.qa pueda referenciarlos sin tener que descubrirlos en runtime.
--
-- IDEMPOTENTE: usa INSERT ... ON CONFLICT DO NOTHING. Puedes correrlo N veces.
--
-- LIMPIEZA: para borrar todo el tenant QA:
--   psql -U aion -d aion -f db/seeds/seed-qa-tenant.sql -v action=clean
--
-- USO NORMAL (insertar/actualizar):
--   psql -U aion -d aion -f db/seeds/seed-qa-tenant.sql
--
-- Los UUIDs aqui definidos coinciden EXACTAMENTE con los del archivo
-- .env.qa.example. NO CAMBIES estos UUIDs sin actualizar tambien el .env.
-- =============================================================================

\set ON_ERROR_STOP on
\set QUIET 1

-- ---- Tenant + Site fijo ----------------------------------------------------
-- tenant_id:  11111111-1111-1111-1111-111111111111
-- site_id:    22222222-2222-2222-2222-222222222222

DO $$
DECLARE
  v_tenant_id  UUID := '11111111-1111-1111-1111-111111111111';
  v_site_id    UUID := '22222222-2222-2222-2222-222222222222';

  -- Users (auth.users de Supabase si existe; si no, public.users)
  v_admin_user UUID := '33333333-3333-3333-3333-333333333333';
  v_qa_user    UUID := '44444444-4444-4444-4444-444444444444';   -- login QA bot
  v_guard_user UUID := '55555555-5555-5555-5555-555555555555';
  v_resident_user UUID := '66666666-6666-6666-6666-666666666666';

  -- Domain entities
  v_resident_id   UUID := '77777777-7777-7777-7777-777777777777';
  v_guard_id      UUID := '88888888-8888-8888-8888-888888888888';
  v_controller_id UUID := '99999999-9999-9999-9999-999999999999';
  v_route_id      UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_cp1_id        UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_cp2_id        UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  v_cp3_id        UUID := 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  v_unit_id       UUID := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
BEGIN
  -- ============================================================
  -- 1. TENANT (si la tabla existe)
  -- ============================================================
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='tenants') THEN
    INSERT INTO public.tenants (id, name, slug, status, created_at)
    VALUES (v_tenant_id, 'QA Test Tenant', 'qa-test', 'active', now())
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status='active';
    RAISE NOTICE 'tenant: %', v_tenant_id;
  END IF;

  -- ============================================================
  -- 2. SITE (copropiedad de prueba)
  -- ============================================================
  INSERT INTO public.sites (
    id, tenant_id, name, address, city, country, status, created_at
  ) VALUES (
    v_site_id, v_tenant_id, 'QA Conjunto Pruebas',
    'Calle QA #1-23', 'Medellin', 'CO', 'active', now()
  )
  ON CONFLICT (id) DO UPDATE
     SET name = EXCLUDED.name, status='active', updated_at = now();
  RAISE NOTICE 'site: %', v_site_id;

  -- ============================================================
  -- 3. USERS (admin + QA bot + guard + resident)
  -- ============================================================
  -- Si Supabase auth.users existe, intentar crear ahi tambien
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='auth' AND table_name='users') THEN
    -- Solo INSERT si no existen (auth.users es manejado por Supabase Auth normalmente)
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES
      (v_admin_user,    'qa-admin@aionseg.co',    crypt('QA-admin-2026!',    gen_salt('bf')), now(), now(), now()),
      (v_qa_user,       'qa-bot@aionseg.co',      crypt('QA-bot-2026!',      gen_salt('bf')), now(), now(), now()),
      (v_guard_user,    'qa-guard@aionseg.co',    crypt('QA-guard-2026!',    gen_salt('bf')), now(), now(), now()),
      (v_resident_user, 'qa-resident@aionseg.co', crypt('QA-resident-2026!', gen_salt('bf')), now(), now(), now())
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- public.users (si existe app-level)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='users') THEN
    INSERT INTO public.users (id, email, full_name, role, tenant_id, status, created_at)
    VALUES
      (v_admin_user,    'qa-admin@aionseg.co',    'QA Admin',    'admin',      v_tenant_id, 'active', now()),
      (v_qa_user,       'qa-bot@aionseg.co',      'QA Bot',      'supervisor', v_tenant_id, 'active', now()),
      (v_guard_user,    'qa-guard@aionseg.co',    'QA Guard',    'guard',      v_tenant_id, 'active', now()),
      (v_resident_user, 'qa-resident@aionseg.co', 'QA Resident', 'resident',   v_tenant_id, 'active', now())
    ON CONFLICT (id) DO UPDATE
       SET role = EXCLUDED.role, status='active', tenant_id = EXCLUDED.tenant_id;
  END IF;

  -- ============================================================
  -- 4. USER_SITE_ACCESS (que usuarios pueden ver que sitio)
  -- ============================================================
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='user_site_access') THEN
    INSERT INTO public.user_site_access (user_id, site_id, access_level, granted_at)
    VALUES
      (v_admin_user,    v_site_id, 'admin',      now()),
      (v_qa_user,       v_site_id, 'supervisor', now()),
      (v_guard_user,    v_site_id, 'operate',    now()),
      (v_resident_user, v_site_id, 'view',       now())
    ON CONFLICT (user_id, site_id) DO UPDATE
       SET access_level = EXCLUDED.access_level;
  END IF;

  -- ============================================================
  -- 5. UNIT (apartamento)
  -- ============================================================
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='units') THEN
    INSERT INTO public.units (id, site_id, code, tower, floor, status, created_at)
    VALUES (v_unit_id, v_site_id, 'QA-101', 'A', 1, 'active', now())
    ON CONFLICT (id) DO UPDATE SET status='active';
  END IF;

  -- ============================================================
  -- 6. RESIDENT
  -- ============================================================
  INSERT INTO public.residents (
    id, user_id, site_id, unit_id, first_name, last_name,
    id_document, phone, email, status, created_at
  ) VALUES (
    v_resident_id, v_resident_user, v_site_id,
    CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='units')
         THEN v_unit_id ELSE NULL END,
    'QA', 'Resident', '99999999-QA', '+573000000001',
    'qa-resident@aionseg.co', 'active', now()
  )
  ON CONFLICT (id) DO UPDATE
     SET status='active', updated_at = now();
  RAISE NOTICE 'resident: %', v_resident_id;

  -- ============================================================
  -- 7. GUARD
  -- ============================================================
  INSERT INTO public.guards (
    id, user_id, site_id, full_name, badge_number,
    phone, status, hired_at, created_at
  ) VALUES (
    v_guard_id, v_guard_user, v_site_id, 'QA Guard',
    'QA-001', '+573000000002', 'active', now(), now()
  )
  ON CONFLICT (id) DO UPDATE
     SET status='active', updated_at = now();
  RAISE NOTICE 'guard: %', v_guard_id;

  -- ============================================================
  -- 8. ACCESS CONTROLLER
  -- ============================================================
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='access_control_devices') THEN
    INSERT INTO public.access_control_devices (
      id, site_id, name, type, ip_address, port,
      vendor, model, status, created_at
    ) VALUES (
      v_controller_id, v_site_id, 'QA Main Gate',
      'access_controller', '10.0.0.99'::inet, 8080,
      'QA-Vendor', 'QA-Model-X', 'online', now()
    )
    ON CONFLICT (id) DO UPDATE SET status='online', updated_at=now();
    RAISE NOTICE 'controller: %', v_controller_id;
  END IF;

  -- ============================================================
  -- 9. PATROL ROUTE + 3 CHECKPOINTS
  -- ============================================================
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='patrol_routes') THEN
    INSERT INTO public.patrol_routes (
      id, site_id, name, description,
      estimated_duration_minutes, status, created_at
    ) VALUES (
      v_route_id, v_site_id, 'QA Route — Perimeter Round',
      'Test route covering 3 checkpoints around the perimeter',
      30, 'active', now()
    )
    ON CONFLICT (id) DO UPDATE SET status='active';
    RAISE NOTICE 'route: %', v_route_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='checkpoints') THEN
    INSERT INTO public.checkpoints (id, route_id, site_id, name, sequence, qr_code, location, status, created_at)
    VALUES
      (v_cp1_id, v_route_id, v_site_id, 'QA CP-1: North Gate',  1,
       'QA-CP-001', 'North entrance, gate A',  'active', now()),
      (v_cp2_id, v_route_id, v_site_id, 'QA CP-2: Pool Area',   2,
       'QA-CP-002', 'Pool deck, west side',    'active', now()),
      (v_cp3_id, v_route_id, v_site_id, 'QA CP-3: South Gate',  3,
       'QA-CP-003', 'South service entrance',  'active', now())
    ON CONFLICT (id) DO UPDATE SET status='active';
    RAISE NOTICE 'checkpoints: 3 created';
  END IF;

  -- ============================================================
  -- 10. ASSIGN ACTIVE SHIFT TO QA GUARD (so patrol policies pass)
  -- ============================================================
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='shifts') THEN
    INSERT INTO public.shifts (
      id, guard_id, site_id, started_at, ends_at, status, created_at
    ) VALUES (
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      v_guard_id, v_site_id,
      now() - interval '1 hour',
      now() + interval '11 hours',
      'active', now()
    )
    ON CONFLICT (id) DO UPDATE
       SET status='active',
           started_at = now() - interval '1 hour',
           ends_at    = now() + interval '11 hours';
    RAISE NOTICE 'active shift assigned';
  END IF;

  -- ============================================================
  -- 11. CONSENT RECORD (Ley 1581) for QA resident
  -- ============================================================
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='consent_records') THEN
    INSERT INTO public.consent_records (
      id, subject_user_id, purpose, granted_at, granted, version
    ) VALUES (
      gen_random_uuid(), v_resident_user,
      'security_monitoring_video_biometric', now(), TRUE, 'v1.0'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'QA tenant seeded successfully';
  RAISE NOTICE '   Update .env.qa with these UUIDs (already match .env.qa.example):';
  RAISE NOTICE '   AION_QA_SITE_ID=%',         v_site_id;
  RAISE NOTICE '   AION_QA_RESIDENT_ID=%',     v_resident_id;
  RAISE NOTICE '   AION_QA_GUARD_ID=%',        v_guard_id;
  RAISE NOTICE '   AION_QA_CONTROLLER_ID=%',   v_controller_id;
  RAISE NOTICE '   AION_QA_ROUTE_ID=%',        v_route_id;
  RAISE NOTICE '   AION_QA_CHECKPOINT_1=%',    v_cp1_id;
  RAISE NOTICE '   AION_QA_CHECKPOINT_2=%',    v_cp2_id;
  RAISE NOTICE '   AION_QA_CHECKPOINT_3=%',    v_cp3_id;
END $$;

-- ---- Verification view (handy for debugging from psql) ---------------------
CREATE OR REPLACE VIEW public.v_qa_seed_status AS
SELECT
  'tenant'    AS entity, COUNT(*) AS n FROM public.tenants    WHERE id = '11111111-1111-1111-1111-111111111111'
UNION ALL SELECT 'site',     COUNT(*) FROM public.sites       WHERE id = '22222222-2222-2222-2222-222222222222'
UNION ALL SELECT 'resident', COUNT(*) FROM public.residents   WHERE id = '77777777-7777-7777-7777-777777777777'
UNION ALL SELECT 'guard',    COUNT(*) FROM public.guards      WHERE id = '88888888-8888-8888-8888-888888888888';
