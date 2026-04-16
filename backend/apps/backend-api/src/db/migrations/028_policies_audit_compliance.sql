-- +migrate Up
-- =============================================================================
-- 028_policies_audit_compliance.sql
-- Politicas para:
--   - tablas de auditoria (audit_log, data_subject_requests, consent_records)
--   - compliance (Ley 1581 Colombia, SuperVigilancia)
--   - AI usage (solo lectura para admin, insert por service_role)
-- =============================================================================

-- ---- audit_log (append-only, lectura solo admin/supervisor) ---------------
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='audit_log') THEN
  EXECUTE 'CREATE POLICY audit_log_read ON public.audit_log FOR SELECT TO PUBLIC
           USING (public.is_supervisor())';
  EXECUTE 'CREATE POLICY audit_log_insert ON public.audit_log FOR INSERT TO PUBLIC
           WITH CHECK (true)';
  -- NO UPDATE, NO DELETE — enforced by default (no policy + FORCE RLS)
END IF;
END $$;

-- ---- consent_records (Ley 1581 — consentimiento tratamiento datos) --------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='consent_records') THEN
    EXECUTE 'CREATE POLICY consent_records_read ON public.consent_records FOR SELECT TO PUBLIC
             USING (
               public.is_admin()
               OR subject_user_id = public.current_user_id()
             )';
    EXECUTE 'CREATE POLICY consent_records_insert ON public.consent_records FOR INSERT TO PUBLIC
             WITH CHECK (
               subject_user_id = public.current_user_id()
               OR public.is_admin()
             )';
    EXECUTE 'CREATE POLICY consent_records_revoke ON public.consent_records FOR UPDATE TO PUBLIC
             USING (
               subject_user_id = public.current_user_id() OR public.is_admin()
             )
             WITH CHECK (
               subject_user_id = public.current_user_id() OR public.is_admin()
             )';
  END IF;
END $$;

-- ---- data_subject_requests (derechos ARCO del titular) --------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='data_subject_requests') THEN
    EXECUTE 'CREATE POLICY dsr_read ON public.data_subject_requests FOR SELECT TO PUBLIC
             USING (
               public.is_admin()
               OR requester_user_id = public.current_user_id()
             )';
    EXECUTE 'CREATE POLICY dsr_insert ON public.data_subject_requests FOR INSERT TO PUBLIC
             WITH CHECK (
               requester_user_id = public.current_user_id()
             )';
    EXECUTE 'CREATE POLICY dsr_admin_update ON public.data_subject_requests FOR UPDATE TO PUBLIC
             USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
END $$;

-- ---- biometric_data (cifrado + solo titular/admin) ------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='biometric_data') THEN
    EXECUTE 'CREATE POLICY biometric_read ON public.biometric_data FOR SELECT TO PUBLIC
             USING (
               public.is_admin()
               OR subject_user_id = public.current_user_id()
             )';
    EXECUTE 'CREATE POLICY biometric_write ON public.biometric_data FOR ALL TO PUBLIC
             USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
END $$;

-- ---- ai_usage / model_router_logs -----------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='ai_usage') THEN
    EXECUTE 'CREATE POLICY ai_usage_read ON public.ai_usage FOR SELECT TO PUBLIC
             USING (public.is_admin())';
    EXECUTE 'CREATE POLICY ai_usage_insert ON public.ai_usage FOR INSERT TO PUBLIC
             WITH CHECK (public.current_user_role() = ''service_role'' OR public.is_admin())';
  END IF;
END $$;

-- ---- compliance_reports (SuperVigilancia) ---------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='compliance_reports') THEN
    EXECUTE 'CREATE POLICY compliance_read ON public.compliance_reports FOR SELECT TO PUBLIC
             USING (public.is_supervisor())';
    EXECUTE 'CREATE POLICY compliance_write ON public.compliance_reports FOR ALL TO PUBLIC
             USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;
END $$;


-- +migrate Down
DROP POLICY IF EXISTS audit_log_read   ON public.audit_log;
DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;

DO $$
DECLARE p TEXT; tbl TEXT;
BEGIN
  FOR tbl IN VALUES
    ('consent_records'),('data_subject_requests'),
    ('biometric_data'),('ai_usage'),('compliance_reports')
  LOOP
    FOR p IN
      SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, tbl);
    END LOOP;
  END LOOP;
END $$;
