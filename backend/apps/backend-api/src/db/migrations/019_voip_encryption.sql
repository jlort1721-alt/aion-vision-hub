-- ============================================================
-- AION — Migration 019: VoIP Password Encryption + RLS
-- [CRIT-DB-002] Encrypt VoIP passwords, restrict access
-- ============================================================

BEGIN;

-- 1. Add encrypted columns
ALTER TABLE voip_config
  ADD COLUMN IF NOT EXISTS ari_password_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS fanvil_password_encrypted BYTEA;

-- 2. Restrict RLS to admin only
ALTER TABLE voip_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE voip_config FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "voip_config_select" ON voip_config;
DROP POLICY IF EXISTS "voip_config_tenant" ON voip_config;
DROP POLICY IF EXISTS "voip_config_admin_only" ON voip_config;

CREATE POLICY "voip_config_admin_only" ON voip_config
  FOR ALL USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('super_admin', 'tenant_admin')
  );

-- 3. Add encrypted credential columns to network_devices for seed data migration
ALTER TABLE network_devices
  ADD COLUMN IF NOT EXISTS username_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS password_encrypted BYTEA;

COMMIT;
