-- Migration 010: Add credentials_encrypted flag to devices table
-- This supports the credential encryption feature (AES-256-GCM)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'credentials_encrypted'
  ) THEN
    ALTER TABLE devices ADD COLUMN credentials_encrypted boolean NOT NULL DEFAULT false;
  END IF;
END $$;
