import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { analyticsService } from './service.js';
import {
  dashboardFiltersSchema,
  kpiSnapshotFiltersSchema,
  saveKPISnapshotSchema,
} from './schemas.js';
import type {
  DashboardFilters,
  KPISnapshotFilters,
  SaveKPISnapshotInput,
} from './schemas.js';

export async function registerAnalyticsRoutes(app: FastifyInstance) {
  // ── GET /dashboard — Main KPI dashboard data ──────────────
  app.get(
    '/dashboard',
    async (request, reply) => {
      const data = await analyticsService.getDashboardOverview(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /events/trends — Event trends over time ───────────
  app.get<{ Querystring: DashboardFilters }>(
    '/events/trends',
    async (request, reply) => {
      const filters = dashboardFiltersSchema.parse(request.query);
      const now = new Date();
      const from = filters.from ?? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const to = filters.to ?? now.toISOString();
      const period = filters.period ?? 'daily';

      const data = await analyticsService.getEventTrends(request.tenantId, from, to, period);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /incidents/metrics — Incident statistics ──────────
  app.get<{ Querystring: DashboardFilters }>(
    '/incidents/metrics',
    async (request, reply) => {
      const filters = dashboardFiltersSchema.parse(request.query);
      const now = new Date();
      const from = filters.from ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const to = filters.to ?? now.toISOString();

      const data = await analyticsService.getIncidentMetrics(request.tenantId, from, to);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /devices/status — Device status breakdown ─────────
  app.get(
    '/devices/status',
    async (request, reply) => {
      const data = await analyticsService.getDeviceStatusBreakdown(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /events/top-types — Most frequent event types ─────
  app.get<{ Querystring: DashboardFilters & { limit?: number } }>(
    '/events/top-types',
    async (request, reply) => {
      const filters = dashboardFiltersSchema.parse(request.query);
      const now = new Date();
      const from = filters.from ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const to = filters.to ?? now.toISOString();
      const limit = Number(request.query.limit) || 10;

      const data = await analyticsService.getTopEventTypes(request.tenantId, from, to, limit);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /kpi/snapshots — Historical KPI data ──────────────
  app.get<{ Querystring: KPISnapshotFilters }>(
    '/kpi/snapshots',
    async (request, reply) => {
      const filters = kpiSnapshotFiltersSchema.parse(request.query);
      const result = await analyticsService.listKPISnapshots(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  // ── POST /kpi/snapshot — Save a KPI snapshot (tenant_admin+) ─
  app.post<{ Body: SaveKPISnapshotInput }>(
    '/kpi/snapshot',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = saveKPISnapshotSchema.parse(request.body);
      const data = await analyticsService.saveKPISnapshot(
        request.tenantId,
        body.period,
        body.periodStart,
        body.periodEnd,
        body.metrics,
      );

      await request.audit('kpi_snapshot.create', 'kpi_snapshots', data.id, {
        period: data.period,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
      });

      return reply.code(201).send({ success: true, data });
    },
  );
}
