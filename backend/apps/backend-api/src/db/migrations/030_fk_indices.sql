-- Migration 030: Add indices on Foreign Key columns
-- FX: DB-002
-- Motivation: 32 FK columns without supporting index. Risk: slow DELETE/UPDATE on parent
-- tables, and JOINs without index usage. All indices are IF NOT EXISTS and non-destructive.
-- Generated: 2026-04-15 as part of remediation 2026-04-aion-full-audit.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_access_logs_vehicle_id ON public.access_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_tenant_id ON public.ai_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_instances_escalation_policy_id ON public.alert_instances(escalation_policy_id);
CREATE INDEX IF NOT EXISTS idx_biometric_records_tenant_id ON public.biometric_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cctv_equipment_tenant_id ON public.cctv_equipment(tenant_id);
CREATE INDEX IF NOT EXISTS idx_database_records_section_id ON public.database_records(section_id);
CREATE INDEX IF NOT EXISTS idx_devices_group_id ON public.devices(group_id);
CREATE INDEX IF NOT EXISTS idx_domotic_devices_section_id ON public.domotic_devices(section_id);
CREATE INDEX IF NOT EXISTS idx_emergency_activations_protocol_id ON public.emergency_activations(protocol_id);
CREATE INDEX IF NOT EXISTS idx_emergency_activations_site_id ON public.emergency_activations(site_id);
CREATE INDEX IF NOT EXISTS idx_incidents_site_id ON public.incidents(site_id);
CREATE INDEX IF NOT EXISTS idx_intercom_calls_device_id ON public.intercom_calls(device_id);
CREATE INDEX IF NOT EXISTS idx_intercom_calls_section_id ON public.intercom_calls(section_id);
CREATE INDEX IF NOT EXISTS idx_intercom_devices_section_id ON public.intercom_devices(section_id);
CREATE INDEX IF NOT EXISTS idx_intercoms_tenant_id ON public.intercoms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_checkpoint_id ON public.patrol_logs(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_playback_requests_device_id ON public.playback_requests(device_id);
CREATE INDEX IF NOT EXISTS idx_playback_requests_tenant_id ON public.playback_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reboot_tasks_section_id ON public.reboot_tasks(section_id);
CREATE INDEX IF NOT EXISTS idx_sections_site_id ON public.sections(site_id);
CREATE INDEX IF NOT EXISTS idx_site_administrators_tenant_id ON public.site_administrators(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_credentials_tenant_id ON public.system_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zone_coordinators_tenant_id ON public.zone_coordinators(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_site_id ON public.agent_knowledge(site_id);
CREATE INDEX IF NOT EXISTS idx_agent_learning_knowledge_id ON public.agent_learning(knowledge_id);
CREATE INDEX IF NOT EXISTS idx_resident_sessions_resident_id ON public.resident_sessions(resident_id);
CREATE INDEX IF NOT EXISTS idx_resident_sessions_site_id ON public.resident_sessions(site_id);
CREATE INDEX IF NOT EXISTS idx_ai_vision_detections_rule_id ON public.ai_vision_detections(rule_id);
CREATE INDEX IF NOT EXISTS idx_biomarkers_tenant_id ON public.biomarkers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_iot_scene_actions_scene_id ON public.iot_scene_actions(scene_id);
CREATE INDEX IF NOT EXISTS idx_incident_notes_incident_id ON public.incident_notes(incident_id);
CREATE INDEX IF NOT EXISTS idx_site_admins_site_id ON public.site_admins(site_id);
CREATE INDEX IF NOT EXISTS idx_site_equipment_inventory_site_id ON public.site_equipment_inventory(site_id);
CREATE INDEX IF NOT EXISTS idx_sirens_site_id ON public.sirens(site_id);
CREATE INDEX IF NOT EXISTS idx_camera_detections_reviewed_by ON public.camera_detections(reviewed_by);

COMMIT;

INSERT INTO public.schema_migrations (version, name, checksum, executed_at)
VALUES ('030', 'fk_indices', 'v1', NOW())
ON CONFLICT (version) DO NOTHING;
