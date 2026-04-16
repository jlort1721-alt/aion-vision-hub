-- 023: Add detection flags to clips table
ALTER TABLE clips ADD COLUMN IF NOT EXISTS has_motion BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS has_detection BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_clips_motion ON clips(has_motion) WHERE has_motion = true;
CREATE INDEX IF NOT EXISTS idx_clips_detection ON clips(has_detection) WHERE has_detection = true;
