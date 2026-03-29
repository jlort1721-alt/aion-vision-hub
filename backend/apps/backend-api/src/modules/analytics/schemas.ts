import { z } from 'zod';

const periods = ['hourly', 'daily', 'weekly', 'monthly'] as const;

// ── Dashboard Filters ────────────────────────────────────────
export const dashboardFiltersSchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  siteId: z.string().uuid().optional(),
  period: z.enum(periods).optional(),
});

export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>;

// ── KPI Snapshot Filters ─────────────────────────────────────
export const kpiSnapshotFiltersSchema = z.object({
  period: z.enum(periods),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type KPISnapshotFilters = z.infer<typeof kpiSnapshotFiltersSchema>;

// ── Save KPI Snapshot ────────────────────────────────────────
export const saveKPISnapshotSchema = z.object({
  period: z.enum(periods),
  periodStart: z.string().datetime({ offset: true }),
  periodEnd: z.string().datetime({ offset: true }),
  metrics: z.record(z.string(), z.unknown()),
});

export type SaveKPISnapshotInput = z.infer<typeof saveKPISnapshotSchema>;
