-- +migrate Up
-- =============================================================================
-- 027_policies_operational.sql
-- Politicas para datos operacionales: guards, shifts, patrols, checkpoints,
-- incidents, alerts, detections, minuta, post_orders.
--
-- Regla general:
--   - Guards: ven/editan SOLO su propia actividad durante SU turno activo.
--   - Supervisores: ven todo el sitio asignado.
--   - Admin: todo (via admin_full_access de 025).
-- =============================================================================

-- ---- guards ----------------------------------------------------------------
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='guards') THEN
  EXECUTE 'CREATE POLICY guards_read ON public.guards FOR SELECT TO PUBLIC
           USING (public.is_supervisor() OR user_id = public.current_user_id())';
  EXECUTE 'CREATE POLICY guards_update ON public.guards FOR UPDATE TO PUBLIC
           USING (public.is_supervisor() OR user_id = public.current_user_id())
           WITH CHECK (public.is_supervisor() OR user_id = public.current_user_id())';
  EXECUTE 'CREATE POLICY guards_insert ON public.guards FOR INSERT TO PUBLIC
           WITH CHECK (public.is_admin())';
END IF;
END $$;

-- ---- shifts ---------------------------------------------------------------
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='shifts') THEN
  EXECUTE 'CREATE POLICY shifts_read ON public.shifts FOR SELECT TO PUBLIC
           USING (
             public.is_supervisor()
             OR guard_id IN (SELECT id FROM public.guards WHERE user_id = public.current_user_id())
           )';
  EXECUTE 'CREATE POLICY shifts_write ON public.shifts FOR ALL TO PUBLIC
           USING (public.is_supervisor()) WITH CHECK (public.is_supervisor())';
END IF;
END $$;

-- ---- patrols --------------------------------------------------------------
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='patrols') THEN
  EXECUTE 'CREATE POLICY patrols_read ON public.patrols FOR SELECT TO PUBLIC
           USING (
             public.is_supervisor()
             OR guard_id IN (SELECT id FROM public.guards WHERE user_id = public.current_user_id())
           )';
  EXECUTE 'CREATE POLICY patrols_insert ON public.patrols FOR INSERT TO PUBLIC
           WITH CHECK (
             public.is_guard()
             AND guard_id IN (SELECT id FROM public.guards WHERE user_id = public.current_user_id())
           )';
  EXECUTE 'CREATE POLICY patrols_update ON public.patrols FOR UPDATE TO PUBLIC
           USING (
             public.is_supervisor()
             OR (status = ''active'' AND guard_id IN (
                   SELECT id FROM public.guards WHERE user_id = public.current_user_id()
                ))
           )
           WITH CHECK (
             public.is_supervisor()
             OR guard_id IN (SELECT id FROM public.guards WHERE user_id = public.current_user_id())
           )';
END IF;
END $$;

-- ---- patrol_checkpoints ---------------------------------------------------
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='patrol_checkpoints') THEN
  EXECUTE 'CREATE POLICY patrol_checkpoints_read ON public.patrol_checkpoints FOR SELECT TO PUBLIC
           USING (
             public.is_supervisor()
             OR patrol_id IN (
               SELECT id FROM public.patrols WHERE guard_id IN (
                 SELECT id FROM public.guards WHERE user_id = public.current_user_id()
               )
             )
           )';
  EXECUTE 'CREATE POLICY patrol_checkpoints_insert ON public.patrol_checkpoints FOR INSERT TO PUBLIC
           WITH CHECK (
             public.is_guard()
             AND patrol_id IN (
               SELECT id FROM public.patrols WHERE guard_id IN (
                 SELECT id FROM public.guards WHERE user_id = public.current_user_id()
               ) AND status=''active''
             )
           )';
END IF;
END $$;

-- ---- incidents ------------------------------------------------------------
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='incidents') THEN
  EXECUTE 'CREATE POLICY incidents_read ON public.incidents FOR SELECT TO PUBLIC
           USING (
             public.is_supervisor()
             OR reported_by = public.current_user_id()
             OR site_id IN (
               SELECT site_id FROM public.user_site_access WHERE user_id = public.current_user_id()
             )
           )';
  EXECUTE 'CREATE POLICY incidents_insert ON public.incidents FOR INSERT TO PUBLIC
           WITH CHECK (public.is_guard())';
  EXECUTE 'CREATE POLICY incidents_update ON public.incidents FOR UPDATE TO PUBLIC
           USING (
             public.is_supervisor()
             OR (reported_by = public.current_user_id() AND status != ''closed'')
           )
           WITH CHECK (true)';
END IF;
END $$;

-- ---- alerts & detections (inmutables una vez creadas, solo supervisor ack) -
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='alerts') THEN
  EXECUTE 'CREATE POLICY alerts_read ON public.alerts FOR SELECT TO PUBLIC
           USING (public.is_guard())';
  EXECUTE 'CREATE POLICY alerts_insert ON public.alerts FOR INSERT TO PUBLIC
           WITH CHECK (public.is_guard())';
  EXECUTE 'CREATE POLICY alerts_ack ON public.alerts FOR UPDATE TO PUBLIC
           USING (public.is_supervisor()) WITH CHECK (public.is_supervisor())';
END IF;
END $$;

DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='detections') THEN
  EXECUTE 'CREATE POLICY detections_read ON public.detections FOR SELECT TO PUBLIC
           USING (public.is_guard())';
  EXECUTE 'CREATE POLICY detections_insert ON public.detections FOR INSERT TO PUBLIC
           WITH CHECK (public.is_guard() OR public.current_user_role() = ''service_role'')';
END IF;
END $$;

-- ---- minuta ---------------------------------------------------------------
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='minuta') THEN
  EXECUTE 'CREATE POLICY minuta_read ON public.minuta FOR SELECT TO PUBLIC
           USING (
             public.is_supervisor()
             OR guard_id IN (SELECT id FROM public.guards WHERE user_id = public.current_user_id())
           )';
  EXECUTE 'CREATE POLICY minuta_insert ON public.minuta FOR INSERT TO PUBLIC
           WITH CHECK (
             public.is_guard()
             AND guard_id IN (SELECT id FROM public.guards WHERE user_id = public.current_user_id())
           )';
  -- minuta no permite UPDATE/DELETE (inmutable por Ley 1581 y policy interna)
END IF;
END $$;

-- ---- post_orders (lectura para guards del sitio) --------------------------
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='post_orders') THEN
  EXECUTE 'CREATE POLICY post_orders_read ON public.post_orders FOR SELECT TO PUBLIC
           USING (
             public.is_guard()
             AND site_id IN (
               SELECT site_id FROM public.user_site_access WHERE user_id = public.current_user_id()
             )
           )';
  EXECUTE 'CREATE POLICY post_orders_write ON public.post_orders FOR ALL TO PUBLIC
           USING (public.is_supervisor()) WITH CHECK (public.is_supervisor())';
END IF;
END $$;


-- +migrate Down
DROP POLICY IF EXISTS guards_read    ON public.guards;
DROP POLICY IF EXISTS guards_update  ON public.guards;
DROP POLICY IF EXISTS guards_insert  ON public.guards;
DROP POLICY IF EXISTS shifts_read    ON public.shifts;
DROP POLICY IF EXISTS shifts_write   ON public.shifts;
DROP POLICY IF EXISTS patrols_read   ON public.patrols;
DROP POLICY IF EXISTS patrols_insert ON public.patrols;
DROP POLICY IF EXISTS patrols_update ON public.patrols;
DROP POLICY IF EXISTS patrol_checkpoints_read   ON public.patrol_checkpoints;
DROP POLICY IF EXISTS patrol_checkpoints_insert ON public.patrol_checkpoints;
DROP POLICY IF EXISTS incidents_read   ON public.incidents;
DROP POLICY IF EXISTS incidents_insert ON public.incidents;
DROP POLICY IF EXISTS incidents_update ON public.incidents;
DROP POLICY IF EXISTS alerts_read     ON public.alerts;
DROP POLICY IF EXISTS alerts_insert   ON public.alerts;
DROP POLICY IF EXISTS alerts_ack      ON public.alerts;
DROP POLICY IF EXISTS detections_read   ON public.detections;
DROP POLICY IF EXISTS detections_insert ON public.detections;
DROP POLICY IF EXISTS minuta_read   ON public.minuta;
DROP POLICY IF EXISTS minuta_insert ON public.minuta;
DROP POLICY IF EXISTS post_orders_read  ON public.post_orders;
DROP POLICY IF EXISTS post_orders_write ON public.post_orders;
