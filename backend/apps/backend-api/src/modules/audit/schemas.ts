import { z } from 'zod';

// ── Audit Log Filters ─────────────────────────────────────────
export const auditFilterSchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().max(64).optional(),
  resource: z.string().max(64).optional(),
  from: z.string().datetime({ message: 'Invalid ISO date format for "from"' }).optional(),
  to: z.string().datetime({ message: 'Invalid ISO date format for "to"' }).optional(),
});

export type AuditFilterInput = z.infer<typeof auditFilterSchema>;

// ── Pagination ────────────────────────────────────────────────
export const auditPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(50),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type AuditPaginationInput = z.infer<typeof auditPaginationSchema>;

// ── Combined Query Schema ─────────────────────────────────────
export const auditQuerySchema = auditFilterSchema.merge(auditPaginationSchema);

export type AuditQueryInput = z.infer<typeof auditQuerySchema>;

// ── Stats Query ───────────────────────────────────────────────
export const auditStatsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type AuditStatsQueryInput = z.infer<typeof auditStatsQuerySchema>;
