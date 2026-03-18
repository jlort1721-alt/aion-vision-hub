-- ═══════════════════════════════════════════════════════════
-- AION Vision Hub — Migration 012: Reports Table
-- Stores on-demand report requests and their results
-- Idempotent: safe to run multiple times
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  type varchar(50) NOT NULL,
  description text,
  parameters jsonb DEFAULT '{}',
  format varchar(20) NOT NULL DEFAULT 'pdf',
  status varchar(20) NOT NULL DEFAULT 'pending',
  result_url text,
  generated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  generated_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Indices ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reports_tenant ON reports (tenant_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports (type);
CREATE INDEX IF NOT EXISTS idx_reports_generated_by ON reports (generated_by);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports (created_at DESC);

-- Verify migration
DO $$ BEGIN
  RAISE NOTICE 'Migration 012 completed: reports table created';
END $$;
