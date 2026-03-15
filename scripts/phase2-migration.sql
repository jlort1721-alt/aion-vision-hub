-- ============================================================================
-- Phase 2 Migration: Shift Management, SLA, Emergency, Patrol & Reporting
-- Created: 2026-03-15
-- Tables: shifts, shift_assignments, sla_definitions, sla_tracking,
--         emergency_protocols, emergency_contacts, emergency_activations,
--         patrol_routes, patrol_checkpoints, patrol_logs, scheduled_reports
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. shifts
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  days_of_week JSONB NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  max_guards INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_tenant ON shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_site ON shifts(site_id);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shifts_tenant_isolation" ON shifts
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- --------------------------------------------------------------------------
-- 2. shift_assignments
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  check_in_location JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_tenant ON shift_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift ON shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_user_date ON shift_assignments(user_id, date);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_status ON shift_assignments(tenant_id, status);

ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shift_assignments_tenant_isolation" ON shift_assignments
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- --------------------------------------------------------------------------
-- 3. sla_definitions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sla_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(16) NOT NULL,
  response_time_minutes INTEGER NOT NULL,
  resolution_time_minutes INTEGER NOT NULL,
  business_hours_only BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_definitions_tenant ON sla_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_definitions_severity ON sla_definitions(tenant_id, severity);

ALTER TABLE sla_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_definitions_tenant_isolation" ON sla_definitions
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- --------------------------------------------------------------------------
-- 4. sla_tracking
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sla_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sla_id UUID NOT NULL REFERENCES sla_definitions(id) ON DELETE CASCADE,
  incident_id UUID,
  event_id UUID,
  response_deadline TIMESTAMPTZ NOT NULL,
  resolution_deadline TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  response_breached BOOLEAN NOT NULL DEFAULT false,
  resolution_breached BOOLEAN NOT NULL DEFAULT false,
  breach_notified_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_tracking_tenant ON sla_tracking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_status ON sla_tracking(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_deadlines ON sla_tracking(response_deadline);

ALTER TABLE sla_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_tracking_tenant_isolation" ON sla_tracking
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- --------------------------------------------------------------------------
-- 5. emergency_protocols
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS emergency_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(64) NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  auto_actions JSONB NOT NULL DEFAULT '[]',
  priority INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_protocols_tenant ON emergency_protocols(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emergency_protocols_type ON emergency_protocols(tenant_id, type);

ALTER TABLE emergency_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emergency_protocols_tenant_isolation" ON emergency_protocols
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- --------------------------------------------------------------------------
-- 6. emergency_contacts
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(128) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(255),
  priority INTEGER NOT NULL DEFAULT 1,
  available_hours JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_tenant ON emergency_contacts(tenant_id);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emergency_contacts_tenant_isolation" ON emergency_contacts
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- --------------------------------------------------------------------------
-- 7. emergency_activations
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS emergency_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  protocol_id UUID NOT NULL REFERENCES emergency_protocols(id),
  site_id UUID REFERENCES sites(id),
  activated_by UUID NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  timeline JSONB NOT NULL DEFAULT '[]',
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_activations_tenant ON emergency_activations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emergency_activations_status ON emergency_activations(tenant_id, status);

ALTER TABLE emergency_activations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emergency_activations_tenant_isolation" ON emergency_activations
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- --------------------------------------------------------------------------
-- 8. patrol_routes
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patrol_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  frequency_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patrol_routes_tenant ON patrol_routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patrol_routes_site ON patrol_routes(site_id);

ALTER TABLE patrol_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patrol_routes_tenant_isolation" ON patrol_routes
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- --------------------------------------------------------------------------
-- 9. patrol_checkpoints
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patrol_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES patrol_routes(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  location JSONB,
  "order" INTEGER NOT NULL DEFAULT 0,
  qr_code VARCHAR(255),
  required_photo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patrol_checkpoints_route ON patrol_checkpoints(route_id);

ALTER TABLE patrol_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patrol_checkpoints_tenant_isolation" ON patrol_checkpoints
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- --------------------------------------------------------------------------
-- 10. patrol_logs
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patrol_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES patrol_routes(id),
  checkpoint_id UUID REFERENCES patrol_checkpoints(id),
  user_id UUID NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'completed',
  scanned_at TIMESTAMPTZ,
  notes TEXT,
  photo_url VARCHAR(1024),
  incident_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patrol_logs_tenant ON patrol_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_route ON patrol_logs(route_id);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_user ON patrol_logs(user_id, created_at);

ALTER TABLE patrol_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patrol_logs_tenant_isolation" ON patrol_logs
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- --------------------------------------------------------------------------
-- 11. scheduled_reports
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(64) NOT NULL,
  schedule JSONB NOT NULL,
  recipients JSONB NOT NULL DEFAULT '{}',
  format VARCHAR(16) NOT NULL DEFAULT 'pdf',
  filters JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_error TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_tenant ON scheduled_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at);

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scheduled_reports_tenant_isolation" ON scheduled_reports
  USING (tenant_id = get_user_tenant_id(auth.uid()));

COMMIT;

-- ============================================================================
-- VERIFICATION: Confirm all 11 Phase 2 tables were created
-- ============================================================================
SELECT tablename AS phase2_table,
       CASE WHEN tablename IS NOT NULL THEN 'OK' END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'shifts',
    'shift_assignments',
    'sla_definitions',
    'sla_tracking',
    'emergency_protocols',
    'emergency_contacts',
    'emergency_activations',
    'patrol_routes',
    'patrol_checkpoints',
    'patrol_logs',
    'scheduled_reports'
  )
ORDER BY tablename;
