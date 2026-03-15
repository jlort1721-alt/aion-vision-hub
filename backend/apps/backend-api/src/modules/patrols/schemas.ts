import { z } from 'zod';

const patrolStatuses = ['completed', 'missed', 'skipped', 'incident'] as const;

// ── Patrol Route Schemas ────────────────────────────────────

export const createRouteSchema = z.object({
  siteId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1024).optional(),
  estimatedMinutes: z.coerce.number().int().min(1).max(1440),
  frequencyMinutes: z.coerce.number().int().min(1).max(10080),
  isActive: z.boolean().default(true),
});
export type CreateRouteInput = z.infer<typeof createRouteSchema>;

export const updateRouteSchema = createRouteSchema.partial();
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;

export const routeFiltersSchema = z.object({
  siteId: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export type RouteFilters = z.infer<typeof routeFiltersSchema>;

// ── Checkpoint Schemas ──────────────────────────────────────

export const createCheckpointSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1024).optional(),
  location: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
    floor: z.string().optional(),
    zone: z.string().optional(),
  }).optional(),
  order: z.coerce.number().int().min(0),
  qrCode: z.string().max(512).optional(),
  requiredPhoto: z.boolean().default(false),
});
export type CreateCheckpointInput = z.infer<typeof createCheckpointSchema>;

export const updateCheckpointSchema = createCheckpointSchema.partial();
export type UpdateCheckpointInput = z.infer<typeof updateCheckpointSchema>;

// ── Patrol Log Schemas ──────────────────────────────────────

export const createPatrolLogSchema = z.object({
  routeId: z.string().uuid(),
  checkpointId: z.string().uuid().optional(),
  status: z.enum(patrolStatuses).default('completed'),
  scannedAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(2048).optional(),
  photoUrl: z.string().url().max(2048).optional(),
});
export type CreatePatrolLogInput = z.infer<typeof createPatrolLogSchema>;

export const patrolLogFiltersSchema = z.object({
  routeId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: z.enum(patrolStatuses).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export type PatrolLogFilters = z.infer<typeof patrolLogFiltersSchema>;
