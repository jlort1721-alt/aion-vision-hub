import { z } from 'zod';

// ── Create Site ─────────────────────────────────────────────
export const createSiteSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  address: z.string().max(512).optional(),
  latitude: z
    .string()
    .max(32)
    .regex(/^-?\d+(\.\d+)?$/, 'Must be a valid latitude')
    .optional(),
  longitude: z
    .string()
    .max(32)
    .regex(/^-?\d+(\.\d+)?$/, 'Must be a valid longitude')
    .optional(),
  timezone: z.string().max(64).default('UTC'),
  gatewayId: z.string().max(128).optional(),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;

// ── Update Site ─────────────────────────────────────────────
export const updateSiteSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().max(512).optional(),
  latitude: z
    .string()
    .max(32)
    .regex(/^-?\d+(\.\d+)?$/, 'Must be a valid latitude')
    .optional(),
  longitude: z
    .string()
    .max(32)
    .regex(/^-?\d+(\.\d+)?$/, 'Must be a valid longitude')
    .optional(),
  timezone: z.string().max(64).optional(),
  gatewayId: z.string().max(128).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
