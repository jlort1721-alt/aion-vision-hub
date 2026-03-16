-- Phase 4: Contracts & Billing, Key Management, Compliance (Ley 1581), Training & Certifications
-- Run on Supabase PostgreSQL

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- CONTRACTS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  contract_number VARCHAR(64) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_document VARCHAR(64),
  client_email VARCHAR(255),
  client_phone VARCHAR(32),
  type VARCHAR(32) NOT NULL DEFAULT 'monthly',
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  start_date DATE NOT NULL,
  end_date DATE,
  monthly_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'COP',
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  payment_terms VARCHAR(32) NOT NULL DEFAULT 'net_30',
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_tenant ON contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_site ON contracts(site_id);
CREATE INDEX IF NOT EXISTS idx_contracts_number ON contracts(tenant_id, contract_number);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'contracts_tenant_isolation') THEN
    CREATE POLICY contracts_tenant_isolation ON contracts FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- INVOICES
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  invoice_number VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 19,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'COP',
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  paid_at TIMESTAMPTZ,
  paid_amount NUMERIC(12,2),
  payment_method VARCHAR(32),
  payment_reference VARCHAR(128),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contract ON invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(tenant_id, invoice_number);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'invoices_tenant_isolation') THEN
    CREATE POLICY invoices_tenant_isolation ON invoices FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- KEY INVENTORY
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS key_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  key_code VARCHAR(64) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  key_type VARCHAR(32) NOT NULL DEFAULT 'access',
  status VARCHAR(32) NOT NULL DEFAULT 'available',
  current_holder VARCHAR(255),
  current_holder_id UUID,
  location VARCHAR(255),
  copies INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_key_inventory_tenant ON key_inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_key_inventory_site ON key_inventory(site_id);
CREATE INDEX IF NOT EXISTS idx_key_inventory_code ON key_inventory(tenant_id, key_code);
CREATE INDEX IF NOT EXISTS idx_key_inventory_status ON key_inventory(tenant_id, status);

ALTER TABLE key_inventory ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'key_inventory_tenant_isolation') THEN
    CREATE POLICY key_inventory_tenant_isolation ON key_inventory FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- KEY LOGS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS key_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key_id UUID NOT NULL REFERENCES key_inventory(id) ON DELETE CASCADE,
  action VARCHAR(32) NOT NULL,
  from_holder VARCHAR(255),
  to_holder VARCHAR(255),
  performed_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_key_logs_tenant ON key_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_key_logs_key ON key_logs(key_id);

ALTER TABLE key_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'key_logs_tenant_isolation') THEN
    CREATE POLICY key_logs_tenant_isolation ON key_logs FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- COMPLIANCE TEMPLATES
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS compliance_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(64) NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_templates_tenant ON compliance_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_templates_type ON compliance_templates(tenant_id, type);

ALTER TABLE compliance_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'compliance_templates_tenant_isolation') THEN
    CREATE POLICY compliance_templates_tenant_isolation ON compliance_templates FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- DATA RETENTION POLICIES
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  data_type VARCHAR(64) NOT NULL,
  retention_days INTEGER NOT NULL,
  action VARCHAR(32) NOT NULL DEFAULT 'delete',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_executed_at TIMESTAMPTZ,
  next_execution_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_retention_tenant ON data_retention_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_data_retention_type ON data_retention_policies(tenant_id, data_type);

ALTER TABLE data_retention_policies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'data_retention_policies_tenant_isolation') THEN
    CREATE POLICY data_retention_policies_tenant_isolation ON data_retention_policies FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- TRAINING PROGRAMS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS training_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(64) NOT NULL,
  duration_hours INTEGER NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  validity_months INTEGER NOT NULL DEFAULT 12,
  passing_score INTEGER NOT NULL DEFAULT 70,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_programs_tenant ON training_programs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_programs_category ON training_programs(tenant_id, category);

ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'training_programs_tenant_isolation') THEN
    CREATE POLICY training_programs_tenant_isolation ON training_programs FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- CERTIFICATIONS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'enrolled',
  score INTEGER,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  certificate_url VARCHAR(1024),
  notes TEXT,
  issued_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certifications_tenant ON certifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_certifications_program ON certifications(program_id);
CREATE INDEX IF NOT EXISTS idx_certifications_user ON certifications(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_certifications_status ON certifications(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_certifications_expiry ON certifications(tenant_id, expires_at);

ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'certifications_tenant_isolation') THEN
    CREATE POLICY certifications_tenant_isolation ON certifications FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

COMMIT;

-- Verify tables
SELECT table_name, (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('contracts', 'invoices', 'key_inventory', 'key_logs', 'compliance_templates', 'data_retention_policies', 'training_programs', 'certifications')
ORDER BY table_name;
