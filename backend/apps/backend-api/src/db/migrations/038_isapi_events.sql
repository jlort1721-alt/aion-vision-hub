-- Migration 038: ISAPI events ingestion table
-- Receives HTTP POSTs from Hikvision DVR Event Upload
-- Publishes to aion_event channel for event-gateway to pick up

BEGIN;

CREATE TABLE IF NOT EXISTS public.isapi_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  device_id      uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  event_type     text NOT NULL,
  channel_id     integer,
  severity       text NOT NULL DEFAULT 'medium',
  occurred_at    timestamptz NOT NULL DEFAULT NOW(),
  received_at    timestamptz NOT NULL DEFAULT NOW(),
  source_ip      inet,
  raw_xml        text,
  raw_json       jsonb,
  correlation_id uuid,
  processed      boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_isapi_events_device     ON public.isapi_events (device_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_isapi_events_tenant     ON public.isapi_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_isapi_events_type       ON public.isapi_events (event_type);
CREATE INDEX IF NOT EXISTS idx_isapi_events_unprocessed ON public.isapi_events (processed) WHERE processed = false;

-- RLS
ALTER TABLE public.isapi_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='isapi_events' AND policyname='isapi_events_tenant_isolation') THEN
    CREATE POLICY isapi_events_tenant_isolation ON public.isapi_events
      USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END$$;

-- Trigger: publish to aion_event on INSERT (event-gateway will translate to MQTT canonical)
DROP TRIGGER IF EXISTS isapi_events_notify_trigger ON public.isapi_events;
CREATE TRIGGER isapi_events_notify_trigger
  AFTER INSERT ON public.isapi_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_row_change();

COMMIT;

INSERT INTO public.schema_migrations (version, name, checksum, executed_at)
VALUES ('038', 'isapi_events', 'v1', NOW())
ON CONFLICT (version) DO NOTHING;
