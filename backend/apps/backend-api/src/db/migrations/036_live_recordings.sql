-- 036: On-demand live recordings from Live View
-- Operator clicks "Record" → ffmpeg captures N minutes → uploads to storage

CREATE TABLE IF NOT EXISTS live_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  camera_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  started_by UUID NOT NULL REFERENCES profiles(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_sec INT,
  storage_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','recording','uploading','ready','failed')),
  reason TEXT,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_recordings_tenant ON live_recordings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_live_recordings_camera ON live_recordings(camera_id);
CREATE INDEX IF NOT EXISTS idx_live_recordings_status ON live_recordings(status) WHERE status IN ('pending','recording');

ALTER TABLE live_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_recordings FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'live_recordings_tenant_isolation') THEN
    CREATE POLICY live_recordings_tenant_isolation ON live_recordings
      USING (tenant_id = current_setting('request.jwt.claim.tenant_id', true)::uuid);
  END IF;
END $$;
