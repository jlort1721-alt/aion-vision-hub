import { z } from 'zod';

const reportTypes = ['daily_summary', 'weekly_incidents', 'monthly_sla', 'patrol_compliance', 'access_log'] as const;
const reportFormats = ['pdf', 'csv', 'json'] as const;

// ── Scheduled Report Schemas ────────────────────────────────

export const createScheduledReportSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(reportTypes),
  schedule: z.object({
    cron: z.string().min(1).max(128),
    timezone: z.string().min(1).max(64),
  }),
  recipients: z.object({
    email: z.array(z.string().email()).optional(),
    whatsapp: z.array(z.string()).optional(),
  }),
  format: z.enum(reportFormats).default('pdf'),
  filters: z.object({
    siteIds: z.array(z.string().uuid()).optional(),
    severity: z.string().max(32).optional(),
  }).optional(),
  isActive: z.boolean().default(true),
});
export type CreateScheduledReportInput = z.infer<typeof createScheduledReportSchema>;

export const updateScheduledReportSchema = createScheduledReportSchema.partial();
export type UpdateScheduledReportInput = z.infer<typeof updateScheduledReportSchema>;

export const scheduledReportFiltersSchema = z.object({
  type: z.enum(reportTypes).optional(),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export type ScheduledReportFilters = z.infer<typeof scheduledReportFiltersSchema>;
