-- Migration: Add tenant_id to streams table for multi-tenant isolation
ALTER TABLE streams ADD COLUMN IF NOT EXISTS tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE streams ADD CONSTRAINT fk_streams_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_streams_tenant_id ON streams(tenant_id);
-- Remove default after backfill
ALTER TABLE streams ALTER COLUMN tenant_id DROP DEFAULT;
