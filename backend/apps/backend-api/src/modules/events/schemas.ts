import { z } from 'zod';

const eventSeverities = ['info', 'warning', 'critical'] as const;
const eventStatuses = ['new', 'acknowledged', 'resolved', 'dismissed'] as const;

// ── Create Event ────────────────────────────────────────────
export const createEventSchema = z.object({
  deviceId: z.string().uuid('deviceId must be a valid UUID'),
  siteId: z.string().uuid('siteId must be a valid UUID'),
  type: z.string().min(1, 'Event type is required').max(64),
  severity: z.enum(eventSeverities).default('info'),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(4096).optional(),
  channel: z.coerce.number().int().min(0).optional(),
  snapshotUrl: z.string().url().max(1024).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

// ── Assign Event ────────────────────────────────────────────
export const assignEventSchema = z.object({
  assignedTo: z.string().uuid('assignedTo must be a valid UUID'),
});

export type AssignEventInput = z.infer<typeof assignEventSchema>;

// ── Update Event Status ─────────────────────────────────────
export const updateEventStatusSchema = z.object({
  status: z.enum(eventStatuses),
});

export type UpdateEventStatusInput = z.infer<typeof updateEventStatusSchema>;

// ── Event Filters ───────────────────────────────────────────
export const eventFiltersSchema = z.object({
  severity: z.enum(eventSeverities).optional(),
  status: z.enum(eventStatuses).optional(),
  deviceId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(['createdAt', 'severity', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type EventFilters = z.infer<typeof eventFiltersSchema>;
