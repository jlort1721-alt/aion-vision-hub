import { z } from 'zod';

const assignmentStatuses = ['scheduled', 'checked_in', 'checked_out', 'missed', 'excused'] as const;

// ── Shift Schemas ───────────────────────────────────────────

export const createShiftSchema = z.object({
  name: z.string().min(1).max(255),
  siteId: z.string().uuid().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  maxGuards: z.coerce.number().int().min(1).optional(),
  description: z.string().max(1024).optional(),
  isActive: z.boolean().default(true),
});
export type CreateShiftInput = z.infer<typeof createShiftSchema>;

export const updateShiftSchema = createShiftSchema.partial();
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;

export const shiftFiltersSchema = z.object({
  siteId: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export type ShiftFilters = z.infer<typeof shiftFiltersSchema>;

// ── Shift Assignment Schemas ────────────────────────────────

export const createShiftAssignmentSchema = z.object({
  shiftId: z.string().uuid(),
  userId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  status: z.enum(assignmentStatuses).default('scheduled'),
  notes: z.string().max(1024).optional(),
});
export type CreateShiftAssignmentInput = z.infer<typeof createShiftAssignmentSchema>;

export const updateShiftAssignmentSchema = z.object({
  status: z.enum(assignmentStatuses).optional(),
  checkInAt: z.string().datetime({ offset: true }).optional(),
  checkOutAt: z.string().datetime({ offset: true }).optional(),
  checkInLocation: z.object({
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number().optional(),
  }).optional(),
  notes: z.string().max(1024).optional(),
});
export type UpdateShiftAssignmentInput = z.infer<typeof updateShiftAssignmentSchema>;

export const shiftAssignmentFiltersSchema = z.object({
  shiftId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: z.enum(assignmentStatuses).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD').optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export type ShiftAssignmentFilters = z.infer<typeof shiftAssignmentFiltersSchema>;
