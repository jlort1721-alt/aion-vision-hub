-- 035: User-defined scene layouts for Live View
-- Persistent custom grid arrangements per user/tenant

CREATE TABLE IF NOT EXISTS user_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layout JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_scenes_tenant_user ON user_scenes(tenant_id, user_id);

ALTER TABLE user_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_scenes FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_scenes_own_or_shared') THEN
    CREATE POLICY user_scenes_own_or_shared ON user_scenes
      USING (
        tenant_id = current_setting('request.jwt.claim.tenant_id', true)::uuid
        AND (
          user_id = current_setting('request.jwt.claim.sub', true)::uuid
          OR is_shared = true
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_scenes_admin_full') THEN
    CREATE POLICY user_scenes_admin_full ON user_scenes
      USING (current_setting('request.jwt.claim.role', true) IN ('super_admin', 'tenant_admin'));
  END IF;
END $$;
