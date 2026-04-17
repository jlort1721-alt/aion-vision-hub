-- Migration 039: access_door_events table
-- Physical door events (ISAPI controlled): remote_open_requested, door_opened,
-- door_forced, tamper, access_granted, access_denied.
-- Separate from access_logs (which tracks people/vehicles passing through sections).

BEGIN;

CREATE TABLE IF NOT EXISTS public.access_door_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  door_id        uuid NOT NULL REFERENCES public.access_doors(id) ON DELETE CASCADE,
  event_type     text NOT NULL,
  person_id      uuid,
  operator_id    uuid,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at    timestamptz NOT NULL DEFAULT NOW(),
  created_at     timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ade_door_time    ON public.access_door_events (door_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ade_tenant_time  ON public.access_door_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ade_event_type   ON public.access_door_events (event_type);

ALTER TABLE public.access_door_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='access_door_events' AND policyname='ade_tenant_isolation') THEN
    CREATE POLICY ade_tenant_isolation ON public.access_door_events
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END$$;

-- pg_notify → event-gateway → MQTT aion/events/<category>/aion_db
DROP TRIGGER IF EXISTS access_door_events_notify_trigger ON public.access_door_events;
CREATE TRIGGER access_door_events_notify_trigger
  AFTER INSERT ON public.access_door_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_row_change();

COMMIT;

INSERT INTO public.schema_migrations (version, name, checksum, executed_at)
VALUES ('039', 'access_door_events', 'v1', NOW())
ON CONFLICT (version) DO NOTHING;
