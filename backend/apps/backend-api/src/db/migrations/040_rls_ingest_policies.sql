-- Migration 040: RLS split into SELECT/INSERT/UPDATE for ingest tables.
-- SELECT remains tenant-scoped, INSERT allowed from public ingest routes
-- (isapi-ingest endpoint), UPDATE tenant-scoped.

BEGIN;

DROP POLICY IF EXISTS isapi_events_tenant_isolation ON public.isapi_events;
DROP POLICY IF EXISTS isapi_events_select ON public.isapi_events;
DROP POLICY IF EXISTS isapi_events_insert ON public.isapi_events;
DROP POLICY IF EXISTS isapi_events_update ON public.isapi_events;

CREATE POLICY isapi_events_select ON public.isapi_events
  FOR SELECT USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY isapi_events_insert ON public.isapi_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY isapi_events_update ON public.isapi_events
  FOR UPDATE USING (tenant_id::text = current_setting('app.tenant_id', true));

DROP POLICY IF EXISTS ade_tenant_isolation ON public.access_door_events;
DROP POLICY IF EXISTS ade_select ON public.access_door_events;
DROP POLICY IF EXISTS ade_insert ON public.access_door_events;
DROP POLICY IF EXISTS ade_update ON public.access_door_events;

CREATE POLICY ade_select ON public.access_door_events
  FOR SELECT USING (tenant_id::text = current_setting('app.tenant_id', true));
CREATE POLICY ade_insert ON public.access_door_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY ade_update ON public.access_door_events
  FOR UPDATE USING (tenant_id::text = current_setting('app.tenant_id', true));

COMMIT;

INSERT INTO public.schema_migrations (version, name, checksum, executed_at)
VALUES ('040', 'rls_ingest_policies', 'v1', NOW())
ON CONFLICT (version) DO NOTHING;
