-- ═══════════════════════════════════════════════════════════
-- AION Vision Hub — Production Seed Data
-- Run ONCE after migrations to bootstrap the system
-- ═══════════════════════════════════════════════════════════

-- ── 1. Default Tenant ───────────────────────────────────────
INSERT INTO public.tenants (id, name, slug, timezone, settings)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'AION Main',
  'default',
  'America/Bogota',
  '{"language": "es", "theme": "dark", "maxDevices": 500}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  timezone = EXCLUDED.timezone,
  settings = EXCLUDED.settings;

-- ── 2. Default Sites ───────────────────────────────────────
INSERT INTO public.sites (id, tenant_id, name, address, timezone, status)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Sede Principal', 'Bogota, Colombia', 'America/Bogota', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Sede Norte', 'Bogota Norte, Colombia', 'America/Bogota', 'active')
ON CONFLICT (id) DO NOTHING;

-- ── 3. Default Sections (Access Control) ────────────────────
INSERT INTO public.sections (id, tenant_id, name, type, description)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Entrada Principal', 'entry', 'Punto de acceso principal del edificio'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Parqueadero', 'parking', 'Area de estacionamiento'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Area Restringida', 'restricted', 'Zona de acceso controlado')
ON CONFLICT (id) DO NOTHING;

-- ── 4. Feature Flags (system-wide) ──────────────────────────
INSERT INTO public.feature_flags (key, name, description, enabled)
VALUES
  ('ai_assistant', 'AI Assistant', 'Enable AION AI assistant for natural language queries', true),
  ('voice_intercom', 'Voice Intercom', 'Enable TTS voice synthesis for intercom calls', true),
  ('whatsapp_notifications', 'WhatsApp Notifications', 'Enable WhatsApp Business messaging', true),
  ('domotic_control', 'Domotic Control', 'Enable smart device (eWeLink/Sonoff) control', true),
  ('access_control', 'Access Control', 'Enable access control module (people, vehicles, sections)', true),
  ('email_notifications', 'Email Notifications', 'Enable email notification system', true),
  ('video_playback', 'Video Playback', 'Enable recorded video playback requests', true),
  ('mcp_connectors', 'MCP Connectors', 'Enable MCP (Model Context Protocol) integrations', true),
  ('live_view', 'Live View', 'Enable live camera view with WebRTC/HLS', true),
  ('reports', 'Reports', 'Enable report generation and PDF export', true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  enabled = EXCLUDED.enabled;

-- ── 5. Default Device Group ─────────────────────────────────
INSERT INTO public.device_groups (id, tenant_id, site_id, name, description)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001', 'Camaras Exteriores', 'Camaras perimetrales y de acceso'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001', 'Camaras Interiores', 'Camaras de pasillos y areas comunes')
ON CONFLICT (id) DO NOTHING;

-- ── 6. Role Module Permissions (tenant-scoped) ──────────────
-- Maps roles to enabled modules for the default tenant
INSERT INTO public.role_module_permissions (tenant_id, role, module, enabled)
VALUES
  -- super_admin: all modules
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'dashboard', true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'devices', true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'events', true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'access', true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'domotics', true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'intercom', true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'whatsapp', true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'reports', true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'settings', true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'audit', true),
  -- tenant_admin: all modules
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'dashboard', true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'devices', true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'events', true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'access', true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'domotics', true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'intercom', true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'whatsapp', true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'reports', true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'settings', true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'audit', true),
  -- operator: operational modules
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'dashboard', true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'devices', true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'events', true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'access', true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'domotics', true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'intercom', true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'whatsapp', true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'reports', true),
  -- viewer: read-only modules
  ('a0000000-0000-0000-0000-000000000001', 'viewer', 'dashboard', true),
  ('a0000000-0000-0000-0000-000000000001', 'viewer', 'devices', true),
  ('a0000000-0000-0000-0000-000000000001', 'viewer', 'events', true),
  ('a0000000-0000-0000-0000-000000000001', 'viewer', 'access', true),
  ('a0000000-0000-0000-0000-000000000001', 'viewer', 'reports', true),
  -- auditor: audit + read-only
  ('a0000000-0000-0000-0000-000000000001', 'auditor', 'dashboard', true),
  ('a0000000-0000-0000-0000-000000000001', 'auditor', 'audit', true),
  ('a0000000-0000-0000-0000-000000000001', 'auditor', 'events', true),
  ('a0000000-0000-0000-0000-000000000001', 'auditor', 'reports', true)
ON CONFLICT (tenant_id, role, module) DO UPDATE SET
  enabled = EXCLUDED.enabled;
