import { z } from 'zod';

const severities = ['critical', 'high', 'medium', 'low'] as const;
const slaTrackingStatuses = ['active', 'met', 'breached', 'cancelled'] as const;

// ── SLA Definition Schemas ──────────────────────────────────

export const createSLADefinitionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1024).optional(),
  severity: z.enum(severities),
  responseTimeMinutes: z.coerce.number().int().min(1),
  resolutionTimeMinutes: z.coerce.number().int().min(1),
  businessHoursOnly: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type CreateSLADefinitionInput = z.infer<typeof createSLADefinitionSchema>;

export const updateSLADefinitionSchema = createSLADefinitionSchema.partial();
export type UpdateSLADefinitionInput = z.infer<typeof updateSLADefinitionSchema>;

export const slaDefinitionFiltersSchema = z.object({
  severity: z.enum(severities).optional(),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export type SLADefinitionFilters = z.infer<typeof slaDefinitionFiltersSchema>;

// ── SLA Tracking Schemas ────────────────────────────────────

export const createSLATrackingSchema = z.object({
  slaId: z.string().uuid(),
  incidentId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  responseDeadline: z.string().datetime({ offset: true }),
  resolutionDeadline: z.string().datetime({ offset: true }),
});
export type CreateSLATrackingInput = z.infer<typeof createSLATrackingSchema>;

export const updateSLATrackingSchema = z.object({
  respondedAt: z.string().datetime({ offset: true }).optional(),
  resolvedAt: z.string().datetime({ offset: true }).optional(),
  status: z.enum(slaTrackingStatuses).optional(),
});
export type UpdateSLATrackingInput = z.infer<typeof updateSLATrackingSchema>;

export const slaTrackingFiltersSchema = z.object({
  slaId: z.string().uuid().optional(),
  status: z.enum(slaTrackingStatuses).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export type SLATrackingFilters = z.infer<typeof slaTrackingFiltersSchema>;
