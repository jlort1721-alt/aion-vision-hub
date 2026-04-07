import { z } from 'zod';

// Coerce number/string to string for DB (latitude/longitude stored as text)
const coordString = z.union([z.string(), z.number()])
  .transform(v => String(v))
  .pipe(z.string().max(32).regex(/^-?\d+(\.\d+)?$/, 'Must be a valid coordinate'))
  .optional()
  .nullable();

// ── Create Site ─────────────────────────────────────────────
export const createSiteSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  address: z.string().max(512).optional().nullable(),
  latitude: coordString,
  longitude: coordString,
  timezone: z.string().max(64).default('America/Bogota'),
  status: z.enum(['unknown', 'healthy', 'degraded', 'offline']).default('unknown'),
  wanIp: z.string().max(45).optional().nullable(),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;

// ── Update Site ─────────────────────────────────────────────
export const updateSiteSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().max(512).optional().nullable(),
  latitude: coordString,
  longitude: coordString,
  timezone: z.string().max(64).optional(),
  status: z.enum(['unknown', 'healthy', 'degraded', 'offline']).optional(),
  wanIp: z.string().max(45).optional().nullable(),
});

export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
