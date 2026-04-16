-- Migration 032: Deprecate orphaned duplicate tables
-- FX: DB-004 (audit_log vs audit_logs), DB-005 (intercoms vs intercom_devices,
--      site_admins vs site_administrators)
--
-- Strategy: RENAME (not DROP). Tables become _deprecated_20260416 and can be
-- inspected or restored without data loss. No code references these tables
-- (verified by grep 2026-04-16). If needed, reverse with:
--   ALTER TABLE <name>_deprecated_20260416 RENAME TO <name>;
--
-- reverse.audit_log is a DIFFERENT table (schema reverse) and is NOT touched.
-- Generated: 2026-04-16 as part of remediation 2026-04-aion-full-audit.

BEGIN;

-- 1. public.audit_log → deprecated (82 rows, no RLS, not written by any code)
ALTER TABLE IF EXISTS public.audit_log
  RENAME TO audit_log_deprecated_20260416;

-- 2. public.intercoms → deprecated (28 rows, canonical is intercom_devices)
ALTER TABLE IF EXISTS public.intercoms
  RENAME TO intercoms_deprecated_20260416;

-- 3. public.site_admins → deprecated (28 rows, canonical is site_administrators)
ALTER TABLE IF EXISTS public.site_admins
  RENAME TO site_admins_deprecated_20260416;

COMMIT;

INSERT INTO public.schema_migrations (version, name, checksum, executed_at)
VALUES ('032', 'deprecate_duplicates', 'v1', NOW())
ON CONFLICT (version) DO NOTHING;
