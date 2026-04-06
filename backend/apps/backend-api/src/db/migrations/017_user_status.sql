-- ============================================================
-- AION — Migration 017: User status for approval workflow
-- [CRIT-SEC-004] Disable/secure public registration
-- ============================================================

BEGIN;

-- Add status column for approval workflow
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' NOT NULL;

-- Existing users remain 'active'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('pending_approval', 'active', 'suspended', 'disabled'));

-- Index for quick filtering of pending users
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles (status) WHERE status != 'active';

COMMIT;
