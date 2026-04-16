-- +migrate Up
-- =============================================================================
-- 026_policies_residential.sql
-- Tenant isolation para datos residenciales: sites, residents, visitors,
-- access_events, units, parking_slots, pets, resident_vehicles.
-- Un "tenant" = una copropiedad/conjunto. Los residentes solo ven su sitio;
-- los admins del sitio ven todo el sitio; los supervisores globales ven todo.
-- =============================================================================

-- ---- sites ----------------------------------------------------------------
CREATE POLICY sites_read ON public.sites
  FOR SELECT TO PUBLIC
  USING (
    public.is_supervisor()
    OR tenant_id = public.current_tenant_id()
    OR id IN (
      SELECT site_id FROM public.user_site_access WHERE user_id = public.current_user_id()
    )
  );

CREATE POLICY sites_write ON public.sites
  FOR INSERT TO PUBLIC
  WITH CHECK (public.is_admin());

CREATE POLICY sites_update ON public.sites
  FOR UPDATE TO PUBLIC
  USING (public.is_admin() OR (public.is_supervisor() AND tenant_id = public.current_tenant_id()))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_admin());

-- ---- residents ------------------------------------------------------------
CREATE POLICY residents_read ON public.residents
  FOR SELECT TO PUBLIC
  USING (
    public.is_supervisor()
    OR user_id = public.current_user_id()
    OR site_id IN (
      SELECT site_id FROM public.user_site_access
      WHERE user_id = public.current_user_id()
    )
  );

CREATE POLICY residents_write ON public.residents
  FOR INSERT TO PUBLIC
  WITH CHECK (
    public.is_admin()
    OR (public.is_supervisor() AND site_id IN (
          SELECT site_id FROM public.user_site_access
          WHERE user_id = public.current_user_id()
       ))
  );

CREATE POLICY residents_update ON public.residents
  FOR UPDATE TO PUBLIC
  USING (
    public.is_supervisor()
    OR user_id = public.current_user_id()
  )
  WITH CHECK (
    public.is_supervisor()
    OR user_id = public.current_user_id()
  );

CREATE POLICY residents_delete ON public.residents
  FOR DELETE TO PUBLIC
  USING (public.is_admin());

-- ---- visitors -------------------------------------------------------------
CREATE POLICY visitors_read ON public.visitors
  FOR SELECT TO PUBLIC
  USING (
    public.is_guard()
    AND site_id IN (
      SELECT site_id FROM public.user_site_access
      WHERE user_id = public.current_user_id()
    )
  );

CREATE POLICY visitors_write ON public.visitors
  FOR INSERT TO PUBLIC
  WITH CHECK (
    public.is_guard()
    AND site_id IN (
      SELECT site_id FROM public.user_site_access
      WHERE user_id = public.current_user_id()
    )
  );

CREATE POLICY visitors_update ON public.visitors
  FOR UPDATE TO PUBLIC
  USING (
    public.is_guard()
    AND site_id IN (
      SELECT site_id FROM public.user_site_access
      WHERE user_id = public.current_user_id()
    )
  );

-- ---- access_events (inmutables: solo insertar + leer) ---------------------
CREATE POLICY access_events_read ON public.access_events
  FOR SELECT TO PUBLIC
  USING (
    public.is_guard()
    OR subject_id = public.current_user_id()
  );

CREATE POLICY access_events_insert ON public.access_events
  FOR INSERT TO PUBLIC
  WITH CHECK (public.is_guard());

-- no UPDATE/DELETE policy -> RLS forbids by default (audit log immutability)

-- ---- units / parking_slots / pets / resident_vehicles --------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['units','parking_slots','pets','resident_vehicles']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=tbl) THEN
      EXECUTE format($p$
        CREATE POLICY %1$I_read ON public.%1$I FOR SELECT TO PUBLIC
        USING (
          public.is_supervisor()
          OR site_id IN (
            SELECT site_id FROM public.user_site_access
            WHERE user_id = public.current_user_id()
          )
        );
        CREATE POLICY %1$I_write ON public.%1$I FOR INSERT TO PUBLIC
        WITH CHECK (public.is_admin());
        CREATE POLICY %1$I_update ON public.%1$I FOR UPDATE TO PUBLIC
        USING (public.is_admin())
        WITH CHECK (public.is_admin());
      $p$, tbl);
    END IF;
  END LOOP;
END $$;


-- +migrate Down
DROP POLICY IF EXISTS sites_read        ON public.sites;
DROP POLICY IF EXISTS sites_write       ON public.sites;
DROP POLICY IF EXISTS sites_update      ON public.sites;
DROP POLICY IF EXISTS residents_read    ON public.residents;
DROP POLICY IF EXISTS residents_write   ON public.residents;
DROP POLICY IF EXISTS residents_update  ON public.residents;
DROP POLICY IF EXISTS residents_delete  ON public.residents;
DROP POLICY IF EXISTS visitors_read     ON public.visitors;
DROP POLICY IF EXISTS visitors_write    ON public.visitors;
DROP POLICY IF EXISTS visitors_update   ON public.visitors;
DROP POLICY IF EXISTS access_events_read   ON public.access_events;
DROP POLICY IF EXISTS access_events_insert ON public.access_events;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['units','parking_slots','pets','resident_vehicles']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS %1$I_read   ON public.%1$I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %1$I_write  ON public.%1$I', tbl);
      EXECUTE format('DROP POLICY IF EXISTS %1$I_update ON public.%1$I', tbl);
    END IF;
  END LOOP;
END $$;
