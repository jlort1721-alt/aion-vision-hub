import { z } from 'zod';

const visitReasons = ['meeting', 'delivery', 'maintenance', 'personal', 'other'] as const;
const passTypes = ['single_use', 'daily', 'multi_day', 'permanent'] as const;
const passStatuses = ['active', 'used', 'expired', 'revoked'] as const;

// ── Create Visitor ─────────────────────────────────────────
export const createVisitorSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(255),
  siteId: z.string().uuid('siteId must be a valid UUID').optional(),
  documentId: z.string().max(128).optional(),
  phone: z.string().max(64).optional(),
  email: z.string().email().max(255).optional(),
  company: z.string().max(255).optional(),
  visitReason: z.enum(visitReasons).optional(),
  hostName: z.string().max(255).optional(),
  hostUnit: z.string().max(128).optional(),
  hostPhone: z.string().max(64).optional(),
  notes: z.string().max(4096).optional(),
});

export type CreateVisitorInput = z.infer<typeof createVisitorSchema>;

// ── Update Visitor ─────────────────────────────────────────
export const updateVisitorSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  siteId: z.string().uuid('siteId must be a valid UUID').optional(),
  documentId: z.string().max(128).optional(),
  phone: z.string().max(64).optional(),
  email: z.string().email().max(255).optional(),
  company: z.string().max(255).optional(),
  visitReason: z.enum(visitReasons).optional(),
  hostName: z.string().max(255).optional(),
  hostUnit: z.string().max(128).optional(),
  hostPhone: z.string().max(64).optional(),
  notes: z.string().max(4096).optional(),
  isBlacklisted: z.boolean().optional(),
});

export type UpdateVisitorInput = z.infer<typeof updateVisitorSchema>;

// ── Visitor Filters ────────────────────────────────────────
export const visitorFiltersSchema = z.object({
  siteId: z.string().uuid().optional(),
  isBlacklisted: z.coerce.boolean().optional(),
  search: z.string().max(255).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type VisitorFilters = z.infer<typeof visitorFiltersSchema>;

// ── Create Visitor Pass ────────────────────────────────────
export const createVisitorPassSchema = z.object({
  visitorId: z.string().uuid('visitorId must be a valid UUID'),
  siteId: z.string().uuid('siteId must be a valid UUID').optional(),
  passType: z.enum(passTypes).optional().default('single_use'),
  validFrom: z.string().datetime({ offset: true }),
  validUntil: z.string().datetime({ offset: true }),
  notes: z.string().max(4096).optional(),
});

export type CreateVisitorPassInput = z.infer<typeof createVisitorPassSchema>;

// ── Update Visitor Pass ────────────────────────────────────
export const updateVisitorPassSchema = z.object({
  status: z.enum(passStatuses).optional(),
});

export type UpdateVisitorPassInput = z.infer<typeof updateVisitorPassSchema>;

// ── Visitor Pass Filters ───────────────────────────────────
export const visitorPassFiltersSchema = z.object({
  visitorId: z.string().uuid().optional(),
  status: z.enum(passStatuses).optional(),
  siteId: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type VisitorPassFilters = z.infer<typeof visitorPassFiltersSchema>;

// ── Validate QR ────────────────────────────────────────────
export const validateQRSchema = z.object({
  qrToken: z.string().min(1, 'qrToken is required').max(128),
});

export type ValidateQRInput = z.infer<typeof validateQRSchema>;
