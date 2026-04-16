-- 033: Add capabilities JSONB to devices for PTZ/audio/motion detection flags
-- Idempotent: uses IF NOT EXISTS

ALTER TABLE devices ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_devices_capabilities_ptz
  ON devices ((capabilities->>'ptz'))
  WHERE capabilities->>'ptz' = 'true';

COMMENT ON COLUMN devices.capabilities IS 'Device capability flags: { ptz: bool, audio_io: bool, motion_detection: bool }';
