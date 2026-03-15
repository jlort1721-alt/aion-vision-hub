-- ═══════════════════════════════════════════════════════════
-- AION Vision Hub — Phase 1 Migration
-- Alert System + Performance Indexes
-- Run in: Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ══════════════════════════════════════════════════════════
-- 1. ALERT RULES
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '{}',
  severity VARCHAR(16) NOT NULL DEFAULT 'medium',
  cooldown_minutes INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant ON alert_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON alert_rules(tenant_id, is_active);

-- ══════════════════════════════════════════════════════════
-- 2. ESCALATION POLICIES
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS escalation_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  levels JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalation_policies_tenant ON escalation_policies(tenant_id);

-- ══════════════════════════════════════════════════════════
-- 3. ALERT INSTANCES
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS alert_instances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  event_id UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'firing',
  severity VARCHAR(16) NOT NULL DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  message TEXT,
  current_level INTEGER NOT NULL DEFAULT 1,
  escalation_policy_id UUID REFERENCES escalation_policies(id),
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  actions_log JSONB NOT NULL DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  next_escalation_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_instances_tenant_status ON alert_instances(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_alert_instances_rule ON alert_instances(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_instances_created ON alert_instances(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_instances_escalation ON alert_instances(next_escalation_at) WHERE next_escalation_at IS NOT NULL;

-- ══════════════════════════════════════════════════════════
-- 4. NOTIFICATION CHANNELS
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notification_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(32) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_channels_tenant ON notification_channels(tenant_id);

-- ══════════════════════════════════════════════════════════
-- 5. NOTIFICATION LOG
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES notification_channels(id),
  alert_instance_id UUID REFERENCES alert_instances(id),
  type VARCHAR(32) NOT NULL,
  recipient VARCHAR(512) NOT NULL,
  subject VARCHAR(255),
  message TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  error TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_tenant ON notification_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_log_alert ON notification_log(alert_instance_id);

-- ══════════════════════════════════════════════════════════
-- 6. ROW LEVEL SECURITY (RLS) FOR NEW TABLES
-- ══════════════════════════════════════════════════════════

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: tenant isolation
CREATE POLICY "alert_rules_tenant_isolation" ON alert_rules
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "escalation_policies_tenant_isolation" ON escalation_policies
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "alert_instances_tenant_isolation" ON alert_instances
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "notification_channels_tenant_isolation" ON notification_channels
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "notification_log_tenant_isolation" ON notification_log
  USING (tenant_id = get_user_tenant_id());

-- ══════════════════════════════════════════════════════════
-- 7. PERFORMANCE INDEXES FOR EXISTING TABLES
-- ══════════════════════════════════════════════════════════

-- Events table
CREATE INDEX IF NOT EXISTS idx_events_tenant_status ON events(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_events_tenant_severity ON events(tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_device ON events(device_id);
CREATE INDEX IF NOT EXISTS idx_events_site ON events(site_id);

-- Devices table
CREATE INDEX IF NOT EXISTS idx_devices_tenant_status ON devices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_devices_site ON devices(site_id);
CREATE INDEX IF NOT EXISTS idx_devices_tenant ON devices(tenant_id);

-- Audit logs table
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);

-- Incidents table
CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(tenant_id, status);

-- Sites table
CREATE INDEX IF NOT EXISTS idx_sites_tenant ON sites(tenant_id);

-- Access logs
CREATE INDEX IF NOT EXISTS idx_access_logs_tenant ON access_logs(tenant_id, created_at DESC);

-- WhatsApp conversations
CREATE INDEX IF NOT EXISTS idx_wa_conversations_tenant ON wa_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation ON wa_messages(conversation_id, created_at DESC);

COMMIT;

-- ══════════════════════════════════════════════════════════
-- VERIFICATION
-- ══════════════════════════════════════════════════════════

SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('alert_rules', 'escalation_policies', 'alert_instances', 'notification_channels', 'notification_log')
ORDER BY tablename;
