-- ═══════════════════════════════════════════════════════════════════════════
-- AION Vision Hub — Production Seed Data
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Purpose:  Bootstrap a fresh production database with required reference data.
-- Usage:    psql -U aion -d aion_vision_hub -f seed-production.sql
-- Safety:   Every statement is idempotent (ON CONFLICT … DO NOTHING / DO UPDATE).
--           Re-running this script on an existing database is safe.
-- Note:     This script does NOT create user accounts. Users are provisioned
--           through the Supabase auth signup flow and linked via profiles.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. DEFAULT TENANT
-- ═══════════════════════════════════════════════════════════════════════════
-- The default tenant for AION Security.  The well-known UUID allows
-- deterministic references from other seed rows and migration scripts.

INSERT INTO public.tenants (id, name, slug, timezone, settings)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'AION Security',
  'default',
  'America/Bogota',
  '{
    "language": "es",
    "theme": "dark",
    "notifications": {
      "enabled": true,
      "email": true,
      "push": true,
      "whatsapp": true,
      "quietHoursStart": null,
      "quietHoursEnd": null
    },
    "maxDevices": 500,
    "maxSites": 50,
    "maxUsersPerTenant": 100,
    "retentionDays": 365,
    "twoFactorRequired": false,
    "defaultMapCenter": { "lat": 4.6097, "lng": -74.0817 },
    "currency": "COP",
    "dateFormat": "DD/MM/YYYY"
  }'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name     = EXCLUDED.name,
  timezone = EXCLUDED.timezone,
  settings = EXCLUDED.settings,
  updated_at = now();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. DEFAULT SITES
-- ═══════════════════════════════════════════════════════════════════════════
-- Two starter sites so the system is not empty on first login.

INSERT INTO public.sites (id, tenant_id, name, address, timezone, status)
VALUES
  ('b0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'Sede Principal', 'Bogota, Colombia', 'America/Bogota', 'active'),
  ('b0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'Sede Norte', 'Bogota Norte, Colombia', 'America/Bogota', 'active')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. DEFAULT SECTIONS (Access Control)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.sections (id, tenant_id, name, type, description)
VALUES
  ('c0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'Entrada Principal', 'entry', 'Punto de acceso principal del edificio'),
  ('c0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'Parqueadero', 'parking', 'Area de estacionamiento'),
  ('c0000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000001',
   'Area Restringida', 'restricted', 'Zona de acceso controlado')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. DEFAULT DEVICE GROUPS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.device_groups (id, tenant_id, site_id, name, description)
VALUES
  ('d0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001',
   'Camaras Exteriores', 'Camaras perimetrales y de acceso'),
  ('d0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001',
   'Camaras Interiores', 'Camaras de pasillos y areas comunes')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. ROLE MODULE PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════
-- Maps the 5 system roles to the modules they can access.
-- Must match the DEFAULT_ROLE_PERMISSIONS in src/lib/permissions.ts.
--
-- Unique constraint: (tenant_id, role, module)

-- Helper: delete stale permissions that are no longer in the canonical set,
-- then upsert the full set.  This keeps the table in sync with code.

-- ── super_admin: full access to every module ──
INSERT INTO public.role_module_permissions (tenant_id, role, module, enabled) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'dashboard',          true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'live_view',          true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'playback',           true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'events',             true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'alerts',             true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'incidents',          true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'devices',            true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'sites',              true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'domotics',           true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'access_control',     true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'reboots',            true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'intercom',           true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'database',           true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'ai_assistant',       true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'integrations',       true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'reports',            true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'audit',              true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'system',             true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'shifts',             true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'sla',               true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'emergency',          true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'patrols',            true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'scheduled_reports',  true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'automation',         true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'visitors',           true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'analytics',          true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'contracts',          true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'keys',              true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'compliance',         true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'training',           true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'settings',           true),
  ('a0000000-0000-0000-0000-000000000001', 'super_admin', 'admin',              true)
ON CONFLICT (tenant_id, role, module) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();

-- ── tenant_admin: full access to every module (same as super_admin) ──
INSERT INTO public.role_module_permissions (tenant_id, role, module, enabled) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'dashboard',          true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'live_view',          true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'playback',           true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'events',             true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'alerts',             true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'incidents',          true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'devices',            true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'sites',              true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'domotics',           true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'access_control',     true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'reboots',            true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'intercom',           true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'database',           true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'ai_assistant',       true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'integrations',       true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'reports',            true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'audit',              true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'system',             true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'shifts',             true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'sla',               true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'emergency',          true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'patrols',            true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'scheduled_reports',  true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'automation',         true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'visitors',           true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'analytics',          true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'contracts',          true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'keys',              true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'compliance',         true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'training',           true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'settings',           true),
  ('a0000000-0000-0000-0000-000000000001', 'tenant_admin', 'admin',              true)
ON CONFLICT (tenant_id, role, module) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();

-- ── operator: operational modules (no audit, admin, integrations, compliance, scheduled_reports, system) ──
INSERT INTO public.role_module_permissions (tenant_id, role, module, enabled) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'dashboard',          true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'live_view',          true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'playback',           true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'events',             true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'alerts',             true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'incidents',          true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'devices',            true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'sites',              true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'domotics',           true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'access_control',     true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'reboots',            true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'intercom',           true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'database',           true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'ai_assistant',       true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'reports',            true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'settings',           true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'shifts',             true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'sla',               true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'emergency',          true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'patrols',            true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'automation',         true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'visitors',           true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'analytics',          true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'contracts',          true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'keys',              true),
  ('a0000000-0000-0000-0000-000000000001', 'operator', 'training',           true)
ON CONFLICT (tenant_id, role, module) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();

-- ── viewer: read-only dashboard, live view, playback, events, reports ──
INSERT INTO public.role_module_permissions (tenant_id, role, module, enabled) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'viewer', 'dashboard',  true),
  ('a0000000-0000-0000-0000-000000000001', 'viewer', 'live_view',  true),
  ('a0000000-0000-0000-0000-000000000001', 'viewer', 'playback',   true),
  ('a0000000-0000-0000-0000-000000000001', 'viewer', 'events',     true),
  ('a0000000-0000-0000-0000-000000000001', 'viewer', 'reports',    true)
ON CONFLICT (tenant_id, role, module) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();

-- ── auditor: dashboard, events, incidents, audit, reports ──
INSERT INTO public.role_module_permissions (tenant_id, role, module, enabled) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'auditor', 'dashboard',  true),
  ('a0000000-0000-0000-0000-000000000001', 'auditor', 'events',     true),
  ('a0000000-0000-0000-0000-000000000001', 'auditor', 'incidents',  true),
  ('a0000000-0000-0000-0000-000000000001', 'auditor', 'audit',      true),
  ('a0000000-0000-0000-0000-000000000001', 'auditor', 'reports',    true)
ON CONFLICT (tenant_id, role, module) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. DEFAULT NOTIFICATION CHANNELS
-- ═══════════════════════════════════════════════════════════════════════════
-- Pre-configured channels that operators can immediately attach to alert rules.
-- Actual recipient lists are populated by the tenant admin through the UI.

INSERT INTO public.notification_channels (id, tenant_id, name, type, config, is_active)
VALUES
  -- Email channel: recipients configured by admin
  ('e0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001',
   'Email - Equipo de Operaciones',
   'email',
   '{"recipients": [], "description": "Canal de correo para el equipo de operaciones. Agregue direcciones en Configuracion > Notificaciones."}'::jsonb,
   true),

  -- Push notification channel
  ('e0000000-0000-0000-0000-000000000002',
   'a0000000-0000-0000-0000-000000000001',
   'Push - Notificaciones del Navegador',
   'push',
   '{"description": "Notificaciones push del navegador. Los usuarios se suscriben automaticamente al habilitar notificaciones."}'::jsonb,
   true),

  -- WhatsApp channel: phone numbers configured by admin
  ('e0000000-0000-0000-0000-000000000003',
   'a0000000-0000-0000-0000-000000000001',
   'WhatsApp - Alertas Criticas',
   'whatsapp',
   '{"phones": [], "templateName": "alert_notification", "description": "Alertas criticas via WhatsApp Business. Configure los numeros en Configuracion > Notificaciones."}'::jsonb,
   true)
ON CONFLICT (id) DO UPDATE SET
  name     = EXCLUDED.name,
  type     = EXCLUDED.type,
  config   = EXCLUDED.config,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. FEATURE FLAGS (system-wide, not tenant-scoped)
-- ═══════════════════════════════════════════════════════════════════════════
-- All features enabled by default for the production tenant.
-- The tenant_override JSONB column can selectively disable features per tenant.

INSERT INTO public.feature_flags (key, name, description, enabled, tenant_override)
VALUES
  ('ai_assistant',
   'AI Assistant',
   'Enable AION AI assistant for natural language queries and incident summarization',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('voice_intercom',
   'Voice Intercom',
   'Enable TTS voice synthesis for intercom calls via ElevenLabs',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('whatsapp_notifications',
   'WhatsApp Notifications',
   'Enable WhatsApp Business API messaging for alerts and reports',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('domotic_control',
   'Domotic Control',
   'Enable smart device control (eWeLink/Sonoff) for locks, lights, and relays',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('access_control',
   'Access Control',
   'Enable access control module: people, vehicles, visitor passes, QR check-in',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('email_notifications',
   'Email Notifications',
   'Enable email notification system via SMTP/Resend/SendGrid',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('video_playback',
   'Video Playback',
   'Enable recorded video playback requests and clip export',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('mcp_connectors',
   'MCP Connectors',
   'Enable Model Context Protocol integrations for external AI tool use',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('live_view',
   'Live View',
   'Enable live camera view with WebRTC/HLS streaming via MediaMTX',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('reports',
   'Reports',
   'Enable report generation, PDF export, and scheduled reports',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('automation_engine',
   'Automation Engine',
   'Enable event-driven automation rules for alerts, incidents, and device control',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('visitor_management',
   'Visitor Management',
   'Enable visitor pre-registration, QR passes, and check-in/check-out tracking',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('patrol_tracking',
   'Patrol Tracking',
   'Enable guard patrol routes, checkpoints, and compliance tracking',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('shift_management',
   'Shift Management',
   'Enable guard shift scheduling, assignments, and handoff tracking',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('contracts_billing',
   'Contracts & Billing',
   'Enable contract management, invoicing, and billing for security services',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('key_management',
   'Key Management',
   'Enable physical key inventory, checkout logs, and chain-of-custody tracking',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb),

  ('compliance_ley1581',
   'Compliance (Ley 1581)',
   'Enable Colombian data protection compliance templates and data retention policies',
   true,
   '{"a0000000-0000-0000-0000-000000000001": true}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name             = EXCLUDED.name,
  description      = EXCLUDED.description,
  enabled          = EXCLUDED.enabled,
  tenant_override  = EXCLUDED.tenant_override;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. DEFAULT ESCALATION POLICY
-- ═══════════════════════════════════════════════════════════════════════════
-- A sensible default: operator first, then tenant_admin if unacknowledged.

INSERT INTO public.escalation_policies (id, tenant_id, name, description, levels, is_active)
VALUES (
  'f0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Escalamiento Predeterminado',
  'Nivel 1: operador (15 min). Nivel 2: administrador (30 min).',
  '[
    {"level": 1, "notifyRoles": ["operator"], "notifyUsers": [], "timeoutMinutes": 15},
    {"level": 2, "notifyRoles": ["tenant_admin"], "notifyUsers": [], "timeoutMinutes": 30}
  ]'::jsonb,
  true
)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  levels      = EXCLUDED.levels,
  is_active   = EXCLUDED.is_active,
  updated_at  = now();

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verification queries (run manually to confirm seed data)
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT name, slug, timezone FROM tenants;
-- SELECT role, count(*) FROM role_module_permissions WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001' GROUP BY role ORDER BY role;
-- SELECT key, enabled FROM feature_flags ORDER BY key;
-- SELECT name, type, is_active FROM notification_channels WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';
-- SELECT name, is_active FROM escalation_policies WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001';
