-- ═══════════════════════════════════════════════════════════
-- AION Vision Hub — Migration 008: Monitoring Sites & Devices Extension
-- Adds columns needed for full monitoring station import
-- Idempotent: safe to run multiple times
-- ═══════════════════════════════════════════════════════════

-- ── Sites: add slug and site_sheet for idempotent matching ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'slug') THEN
    ALTER TABLE public.sites ADD COLUMN slug text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sites' AND column_name = 'site_sheet') THEN
    ALTER TABLE public.sites ADD COLUMN site_sheet text;
  END IF;
END $$;

-- Create unique index on slug per tenant (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sites_tenant_slug') THEN
    CREATE UNIQUE INDEX idx_sites_tenant_slug ON public.sites (tenant_id, slug) WHERE slug IS NOT NULL;
  END IF;
END $$;

-- ── Devices: make ip_address nullable and add monitoring fields ──
DO $$ BEGIN
  -- Make ip_address nullable (it was NOT NULL, but cloud accounts and some intercoms have no IP)
  ALTER TABLE public.devices ALTER COLUMN ip_address DROP NOT NULL;
  ALTER TABLE public.devices ALTER COLUMN ip_address DROP DEFAULT;
  -- Make port nullable
  ALTER TABLE public.devices ALTER COLUMN port DROP NOT NULL;
  ALTER TABLE public.devices ALTER COLUMN port DROP DEFAULT;
  -- Make brand nullable
  ALTER TABLE public.devices ALTER COLUMN brand DROP NOT NULL;
  ALTER TABLE public.devices ALTER COLUMN brand DROP DEFAULT;
  -- Make model nullable
  ALTER TABLE public.devices ALTER COLUMN model DROP NOT NULL;
  ALTER TABLE public.devices ALTER COLUMN model DROP DEFAULT;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Some ALTER COLUMN changes already applied, continuing...';
END $$;

-- Add new columns for monitoring data
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'device_slug') THEN
    ALTER TABLE public.devices ADD COLUMN device_slug text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'username') THEN
    ALTER TABLE public.devices ADD COLUMN username text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'password') THEN
    ALTER TABLE public.devices ADD COLUMN password text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'subnet_mask') THEN
    ALTER TABLE public.devices ADD COLUMN subnet_mask text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'gateway') THEN
    ALTER TABLE public.devices ADD COLUMN gateway text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'operator') THEN
    ALTER TABLE public.devices ADD COLUMN operator text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'app_name') THEN
    ALTER TABLE public.devices ADD COLUMN app_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'app_id') THEN
    ALTER TABLE public.devices ADD COLUMN app_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'extension') THEN
    ALTER TABLE public.devices ADD COLUMN extension text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'outbound_call') THEN
    ALTER TABLE public.devices ADD COLUMN outbound_call text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'connection_type') THEN
    ALTER TABLE public.devices ADD COLUMN connection_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'aps_count') THEN
    ALTER TABLE public.devices ADD COLUMN aps_count integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'antennas_count') THEN
    ALTER TABLE public.devices ADD COLUMN antennas_count integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'cameras_count') THEN
    ALTER TABLE public.devices ADD COLUMN cameras_count integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'analog_cameras_count') THEN
    ALTER TABLE public.devices ADD COLUMN analog_cameras_count integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'missing_fields') THEN
    ALTER TABLE public.devices ADD COLUMN missing_fields text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'devices' AND column_name = 'source_sheet') THEN
    ALTER TABLE public.devices ADD COLUMN source_sheet text;
  END IF;
END $$;

-- Create idempotent index for device upsert: site + device_slug
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_devices_site_slug') THEN
    CREATE INDEX idx_devices_site_slug ON public.devices (site_id, device_slug) WHERE device_slug IS NOT NULL;
  END IF;
END $$;

-- Verify migration
DO $$ BEGIN
  RAISE NOTICE 'Migration 008 completed: sites and devices tables extended for monitoring import';
END $$;
