-- ═══════════════════════════════════════════════════════════
-- Production Readiness Indexes for 250-1000 Devices
-- Optimizes high-volume tables for enterprise workloads
-- ═══════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_tenant
  ON public.profiles(tenant_id);

-- ── sites ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sites_tenant
  ON public.sites(tenant_id);

-- ── devices (compound indexes for common query patterns) ─
CREATE INDEX IF NOT EXISTS idx_devices_tenant_site
  ON public.devices(tenant_id, site_id);
CREATE INDEX IF NOT EXISTS idx_devices_tenant_status
  ON public.devices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_devices_tenant_last_seen
  ON public.devices(tenant_id, last_seen DESC NULLS LAST);

-- ── streams ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_streams_device
  ON public.streams(device_id);

-- ── events (CRITICAL — highest-volume table) ─────────────
CREATE INDEX IF NOT EXISTS idx_events_tenant_created
  ON public.events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_tenant_device_created
  ON public.events(tenant_id, device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_tenant_site_created
  ON public.events(tenant_id, site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_tenant_status_created
  ON public.events(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_tenant_severity_created
  ON public.events(tenant_id, severity, created_at DESC);

-- ── incidents ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_incidents_tenant_created
  ON public.incidents(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant_status
  ON public.incidents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant_priority
  ON public.incidents(tenant_id, priority);

-- ── audit_logs (CRITICAL — grows with every mutation) ────
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_action
  ON public.audit_logs(tenant_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_user_created
  ON public.audit_logs(tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_entity
  ON public.audit_logs(tenant_id, entity_type, entity_id);

-- ── access_logs ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_access_logs_tenant_created
  ON public.access_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_tenant_section
  ON public.access_logs(tenant_id, section_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_tenant_person
  ON public.access_logs(tenant_id, person_id);

-- ── access_people ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_access_people_tenant_section
  ON public.access_people(tenant_id, section_id);
CREATE INDEX IF NOT EXISTS idx_access_people_tenant_status
  ON public.access_people(tenant_id, status);

-- ── access_vehicles ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_access_vehicles_tenant_person
  ON public.access_vehicles(tenant_id, person_id);
CREATE INDEX IF NOT EXISTS idx_access_vehicles_tenant_plate
  ON public.access_vehicles(tenant_id, plate);

-- ── sections ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sections_tenant
  ON public.sections(tenant_id);

-- ── domotic_devices ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_domotic_devices_tenant
  ON public.domotic_devices(tenant_id);

-- ── domotic_actions ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_domotic_actions_tenant_device
  ON public.domotic_actions(tenant_id, device_id, created_at DESC);

-- ── reboot_tasks ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reboot_tasks_tenant_created
  ON public.reboot_tasks(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reboot_tasks_tenant_device
  ON public.reboot_tasks(tenant_id, device_id);

-- ── intercom_devices ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_intercom_devices_tenant
  ON public.intercom_devices(tenant_id);

-- ── intercom_calls ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_intercom_calls_tenant_created
  ON public.intercom_calls(tenant_id, created_at DESC);

-- ── database_records ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_database_records_tenant_category
  ON public.database_records(tenant_id, category);

-- ── integrations ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_integrations_tenant_type
  ON public.integrations(tenant_id, type);

-- ── wa_conversations (fix: make last_msg index tenant-aware)
CREATE INDEX IF NOT EXISTS idx_wa_conversations_tenant_last_msg
  ON public.wa_conversations(tenant_id, last_message_at DESC);

-- ═══════════════════════════════════════════════════════════
-- Auto-vacuum tuning for high-volume tables
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.events SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE public.audit_logs SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

ALTER TABLE public.access_logs SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE public.wa_messages SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);
