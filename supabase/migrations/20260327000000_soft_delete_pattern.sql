-- Add soft-delete columns to critical tables
-- These allow "deleting" records while preserving audit trail

ALTER TABLE IF EXISTS public.devices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE IF EXISTS public.incidents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE IF EXISTS public.events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE IF EXISTS public.contracts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE IF EXISTS public.visitors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE IF EXISTS public.access_people ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE IF EXISTS public.access_vehicles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE IF EXISTS public.patrols ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE IF EXISTS public.shifts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE IF EXISTS public.emergency_protocols ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE IF EXISTS public.compliance_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE IF EXISTS public.training_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE IF EXISTS public.keys ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add indexes for soft-delete queries (WHERE deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_devices_not_deleted ON public.devices(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_incidents_not_deleted ON public.incidents(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_events_not_deleted ON public.events(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_not_deleted ON public.contracts(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_visitors_not_deleted ON public.visitors(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patrols_not_deleted ON public.patrols(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shifts_not_deleted ON public.shifts(id) WHERE deleted_at IS NULL;

-- Update RLS policies to exclude soft-deleted records
-- (These are additive and won't break existing policies)
