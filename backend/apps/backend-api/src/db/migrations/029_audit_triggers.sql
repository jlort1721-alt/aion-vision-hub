-- +migrate Up
-- =============================================================================
-- 029_audit_triggers.sql
-- Triggers INSERT/UPDATE/DELETE -> audit_log con diff JSON.
-- Instalados sobre tablas sensibles. Idempotente.
-- =============================================================================

-- Asegurar estructura de audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           BIGSERIAL PRIMARY KEY,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id     UUID,
  actor_role   TEXT,
  action       TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  table_name   TEXT NOT NULL,
  row_pk       TEXT,
  before       JSONB,
  after        JSONB,
  diff         JSONB,
  request_id   TEXT,
  ip           INET
);
CREATE INDEX IF NOT EXISTS audit_log_occurred_at_idx ON public.audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_table_idx       ON public.audit_log(table_name);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx       ON public.audit_log(actor_id);

-- Trigger function
CREATE OR REPLACE FUNCTION public.fn_audit_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before JSONB;
  v_after  JSONB;
  v_pk     TEXT;
  v_diff   JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_before := NULL;
    v_after  := to_jsonb(NEW);
    v_pk     := COALESCE((NEW.id)::TEXT, '');
    v_diff   := v_after;
  ELSIF TG_OP = 'UPDATE' THEN
    v_before := to_jsonb(OLD);
    v_after  := to_jsonb(NEW);
    v_pk     := COALESCE((NEW.id)::TEXT, (OLD.id)::TEXT, '');
    SELECT jsonb_object_agg(k, jsonb_build_object('old', v_before->k, 'new', v_after->k))
      INTO v_diff
      FROM jsonb_object_keys(v_after) AS k
     WHERE v_before->k IS DISTINCT FROM v_after->k;
  ELSIF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD);
    v_after  := NULL;
    v_pk     := COALESCE((OLD.id)::TEXT, '');
    v_diff   := v_before;
  END IF;

  INSERT INTO public.audit_log (
    actor_id, actor_role, action, table_name, row_pk,
    before, after, diff,
    request_id, ip
  ) VALUES (
    public.current_user_id(),
    public.current_user_role(),
    TG_OP,
    TG_TABLE_NAME,
    v_pk,
    v_before, v_after, v_diff,
    NULLIF(current_setting('request.headers.x-request-id', true), ''),
    NULLIF(current_setting('request.headers.x-real-ip',    true), '')::inet
  );

  RETURN COALESCE(NEW, OLD);
END $$;

-- Attach trigger to sensitive tables (idempotent)
DO $$
DECLARE
  t TEXT;
  audited TEXT[] := ARRAY[
    'sites','residents','visitors','access_events',
    'guards','shifts','patrols','patrol_checkpoints',
    'incidents','alerts','detections','minuta',
    'consent_records','data_subject_requests','biometric_data',
    'access_control_devices','camera_devices','iot_devices',
    'notification_templates','automation_rules',
    'user_site_access','roles','permissions'
  ];
BEGIN
  FOREACH t IN ARRAY audited
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format($q$
        DROP TRIGGER IF EXISTS trg_audit_%1$I ON public.%1$I;
        CREATE TRIGGER trg_audit_%1$I
          AFTER INSERT OR UPDATE OR DELETE ON public.%1$I
          FOR EACH ROW EXECUTE FUNCTION public.fn_audit_row();
      $q$, t);
    END IF;
  END LOOP;
END $$;

-- audit_log itself: prohibit any UPDATE/DELETE via trigger (extra guard)
CREATE OR REPLACE FUNCTION public.fn_audit_log_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (op=%)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON public.audit_log;
CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log_immutable();


-- +migrate Down
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$I ON public.%1$I', t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS trg_audit_log_immutable ON public.audit_log;
DROP FUNCTION IF EXISTS public.fn_audit_log_immutable();
DROP FUNCTION IF EXISTS public.fn_audit_row();
-- intentionally NOT dropping audit_log table (historical data preserved)
