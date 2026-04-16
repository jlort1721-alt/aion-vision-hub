-- Migration 031: LISTEN/NOTIFY triggers for realtime WebSocket broadcast
-- FX: Stream A.2 alternative — wires PostgreSQL row changes into the Fastify
-- WebSocket plugin (backend/apps/backend-api/src/plugins/websocket.ts) via
-- LISTEN/NOTIFY so the native WS replaces Supabase Realtime completely.
--
-- Payload shape (JSON):
--   { "table": "...", "op": "INSERT|UPDATE|DELETE",
--     "tenant_id": "<uuid>", "row": { ... minimal fields ... } }
--
-- Listener: `LISTEN aion_event` in a dedicated pg client inside the backend
-- WebSocket plugin. The plugin translates the NOTIFY into broadcast(tenantId,
-- "events"|"incidents"|"alerts", payload).
--
-- Idempotent: every CREATE uses OR REPLACE / IF NOT EXISTS.
-- Generated: 2026-04-15 as part of remediation 2026-04-aion-full-audit.

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_row_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  tenant uuid;
  channel text := 'aion_event';
  payload jsonb;
  row_data jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := to_jsonb(OLD);
  ELSE
    row_data := to_jsonb(NEW);
  END IF;

  -- Best-effort tenant extraction; NULL if column absent.
  tenant := NULLIF(row_data->>'tenant_id', '')::uuid;

  payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'op', TG_OP,
    'tenant_id', tenant,
    'row', row_data
  );

  PERFORM pg_notify(channel, payload::text);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach to core realtime tables. DROP first to make it idempotent across redeploys.

DROP TRIGGER IF EXISTS events_notify_trigger ON public.events;
CREATE TRIGGER events_notify_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.notify_row_change();

DROP TRIGGER IF EXISTS incidents_notify_trigger ON public.incidents;
CREATE TRIGGER incidents_notify_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.notify_row_change();

DROP TRIGGER IF EXISTS alert_instances_notify_trigger ON public.alert_instances;
CREATE TRIGGER alert_instances_notify_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.alert_instances
  FOR EACH ROW EXECUTE FUNCTION public.notify_row_change();

COMMIT;

INSERT INTO public.schema_migrations (version, name, checksum, executed_at)
VALUES ('031', 'event_notify_triggers', 'v1', NOW())
ON CONFLICT (version) DO NOTHING;
