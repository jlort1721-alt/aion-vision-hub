-- Phase 3 Migration: Automation, Visitors, KPI, Push Subscriptions
-- Generated: 2026-03-15

BEGIN;

-- ============================================================
-- 1. automation_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger JSONB NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  priority INTEGER NOT NULL DEFAULT 1,
  cooldown_minutes INTEGER NOT NULL DEFAULT 5,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_tenant ON automation_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON automation_rules(tenant_id, is_active);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_rules_tenant_isolation" ON automation_rules
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- ============================================================
-- 2. automation_executions
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  trigger_data JSONB NOT NULL DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(32) NOT NULL DEFAULT 'success',
  execution_time_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_executions_tenant ON automation_executions(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_automation_executions_rule ON automation_executions(rule_id);

ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_executions_tenant_isolation" ON automation_executions
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- ============================================================
-- 3. visitors
-- ============================================================
CREATE TABLE IF NOT EXISTS visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  document_id VARCHAR(64),
  phone VARCHAR(32),
  email VARCHAR(255),
  company VARCHAR(255),
  photo_url VARCHAR(1024),
  visit_reason VARCHAR(64) NOT NULL DEFAULT 'personal',
  host_name VARCHAR(255),
  host_unit VARCHAR(64),
  host_phone VARCHAR(32),
  notes TEXT,
  is_blacklisted BOOLEAN NOT NULL DEFAULT false,
  visit_count INTEGER NOT NULL DEFAULT 0,
  last_visit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitors_tenant ON visitors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visitors_document ON visitors(tenant_id, document_id);
CREATE INDEX IF NOT EXISTS idx_visitors_site ON visitors(site_id);

ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visitors_tenant_isolation" ON visitors
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- ============================================================
-- 4. visitor_passes
-- ============================================================
CREATE TABLE IF NOT EXISTS visitor_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  visitor_id UUID NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  qr_token VARCHAR(128) NOT NULL,
  pass_type VARCHAR(32) NOT NULL DEFAULT 'single_use',
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  check_in_by UUID,
  authorized_by UUID NOT NULL,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitor_passes_tenant ON visitor_passes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visitor_passes_visitor ON visitor_passes(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitor_passes_qr ON visitor_passes(qr_token);
CREATE INDEX IF NOT EXISTS idx_visitor_passes_status ON visitor_passes(tenant_id, status);

ALTER TABLE visitor_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visitor_passes_tenant_isolation" ON visitor_passes
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- ============================================================
-- 5. kpi_snapshots
-- ============================================================
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period VARCHAR(16) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_tenant_period ON kpi_snapshots(tenant_id, period, period_start);

ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpi_snapshots_tenant_isolation" ON kpi_snapshots
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- ============================================================
-- 6. push_subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  subscription JSONB NOT NULL,
  user_agent VARCHAR(512),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(tenant_id, user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_subscriptions_tenant_isolation" ON push_subscriptions
  USING (tenant_id = get_user_tenant_id(auth.uid()));

COMMIT;

-- ============================================================
-- Verification (outside transaction)
-- ============================================================
SELECT table_name, COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_name IN (
  'automation_rules',
  'automation_executions',
  'visitors',
  'visitor_passes',
  'kpi_snapshots',
  'push_subscriptions'
)
GROUP BY table_name
ORDER BY table_name;
