import { z } from 'zod';

// ── White-label branding sub-schema ──────────────────────
// Stored inside tenant `settings.branding` (JSONB).
// All fields are optional — the frontend falls back to AION defaults.
export const tenantBrandingSchema = z.object({
  /** Display name shown in sidebar / page title */
  name: z.string().max(128).optional(),
  /** URL to the logo image */
  logoUrl: z.string().url().optional(),
  /** URL to the favicon */
  faviconUrl: z.string().url().optional(),
  /** Primary brand colour (CSS value, e.g. "hsl(217, 91%, 60%)") */
  primaryColor: z.string().max(64).optional(),
  /** Secondary brand colour */
  secondaryColor: z.string().max(64).optional(),
  /** Accent colour */
  accentColor: z.string().max(64).optional(),
}).strict().optional();

// ── Tenant settings schema ───────────────────────────────
// Documents the known keys that live inside the JSONB `settings` column.
export const tenantSettingsSchema = z.object({
  language: z.enum(['es', 'en']).optional(),
  branding: tenantBrandingSchema,
}).passthrough(); // allow additional unknown keys for forward-compatibility

export const createTenantSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(64),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  settings: tenantSettingsSchema.optional(),
  isActive: z.boolean().optional(),
});
