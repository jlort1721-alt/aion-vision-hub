import { z } from 'zod';

// ── Report Types & Formats ────────────────────────────────────
const reportTypes = ['events', 'incidents', 'devices', 'access', 'audit', 'custom'] as const;
const reportFormats = ['json', 'csv', 'pdf'] as const;

// ── Create Report ─────────────────────────────────────────────
export const createReportSchema = z.object({
  name: z
    .string()
    .min(1, 'Report name is required')
    .max(255, 'Report name must be at most 255 characters'),
  type: z.enum(reportTypes, {
    error: `Type must be one of: ${reportTypes.join(', ')}`,
  }),
  format: z
    .enum(reportFormats, {
      error: `Format must be one of: ${reportFormats.join(', ')}`,
    })
    .optional()
    .default('json'),
  parameters: z.record(z.string(), z.unknown()).default({}),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

// ── Report Query ──────────────────────────────────────────────
export const reportQuerySchema = z.object({
  type: z.enum(reportTypes).optional(),
  status: z.enum(['pending', 'generating', 'ready', 'failed']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
