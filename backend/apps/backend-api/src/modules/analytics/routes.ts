import type { FastifyInstance } from 'fastify';
import { eq, and, sql, gte } from 'drizzle-orm';
import { requireRole } from '../../plugins/auth.js';
import { analyticsService } from './service.js';
import { db } from '../../db/client.js';
import { sites, devices, events, incidents } from '../../db/schema/index.js';
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
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin', 'auditor')] },
    async (request, reply) => {
      const data = await analyticsService.getDashboardOverview(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /events/trends — Event trends over time ───────────
  app.get<{ Querystring: DashboardFilters }>(
    '/events/trends',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin', 'auditor')] },
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
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin', 'auditor')] },
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
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin', 'auditor')] },
    async (request, reply) => {
      const data = await analyticsService.getDeviceStatusBreakdown(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /events/top-types — Most frequent event types ─────
  app.get<{ Querystring: DashboardFilters & { limit?: number } }>(
    '/events/top-types',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin', 'auditor')] },
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
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin', 'auditor')] },
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

  // ── GET /risk-score — Per-site risk score calculation ──────
  app.get(
    '/risk-score',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin', 'auditor')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Fetch all sites for this tenant
      const tenantSites = await db
        .select({
          id: sites.id,
          name: sites.name,
          wanIp: sites.wanIp,
        })
        .from(sites)
        .where(eq(sites.tenantId, tenantId));

      const results = [];

      for (const site of tenantSites) {
        // Critical events in last 24h
        const [criticalResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(events)
          .where(and(
            eq(events.tenantId, tenantId),
            eq(events.siteId, site.id),
            eq(events.severity, 'critical'),
            gte(events.createdAt, last24h),
          ));

        // High severity events in last 24h
        const [highResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(events)
          .where(and(
            eq(events.tenantId, tenantId),
            eq(events.siteId, site.id),
            eq(events.severity, 'high'),
            gte(events.createdAt, last24h),
          ));

        // Device status for this site
        const [deviceResult] = await db
          .select({
            total: sql<number>`count(*)::int`,
            offline: sql<number>`count(*) filter (where ${devices.status} = 'offline')::int`,
          })
          .from(devices)
          .where(and(
            eq(devices.tenantId, tenantId),
            eq(devices.siteId, site.id),
          ));

        // Open incidents for this site
        const [incidentResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(incidents)
          .where(and(
            eq(incidents.tenantId, tenantId),
            eq(incidents.siteId, site.id),
            sql`${incidents.status} in ('open', 'investigating')`,
          ));

        const criticalCount = criticalResult?.count ?? 0;
        const highCount = highResult?.count ?? 0;
        const totalDevices = deviceResult?.total ?? 0;
        const offlineDevices = deviceResult?.offline ?? 0;
        const openIncidents = incidentResult?.count ?? 0;
        const hasWanIp = !!site.wanIp;

        // Normalize each factor to 0-100 range
        // Critical events: cap at 10 = 100
        const criticalNorm = Math.min(criticalCount / 10, 1) * 100;
        // High events: cap at 20 = 100
        const highNorm = Math.min(highCount / 20, 1) * 100;
        // Offline percentage: 0-100 naturally
        const offlinePct = totalDevices > 0 ? (offlineDevices / totalDevices) * 100 : 0;
        // Open incidents: cap at 10 = 100
        const incidentsNorm = Math.min(openIncidents / 10, 1) * 100;
        // WAN IP: no WAN = +100 (inverted), has WAN = 0
        const wanNorm = hasWanIp ? 0 : 100;

        // Weighted average
        const riskScore = Math.round(
          (criticalNorm * 30 +
            highNorm * 15 +
            offlinePct * 25 +
            incidentsNorm * 20 +
            wanNorm * 10) / 100,
        );

        // Clamp to 0-100
        const clampedScore = Math.max(0, Math.min(100, riskScore));

        // Determine level
        let level: 'low' | 'medium' | 'high' | 'critical';
        if (clampedScore <= 25) level = 'low';
        else if (clampedScore <= 50) level = 'medium';
        else if (clampedScore <= 75) level = 'high';
        else level = 'critical';

        results.push({
          siteId: site.id,
          siteName: site.name,
          riskScore: clampedScore,
          factors: {
            events_critical_24h: criticalCount,
            events_high_24h: highCount,
            devices_offline_pct: Math.round(offlinePct * 100) / 100,
            incidents_open: openIncidents,
            has_wan_ip: hasWanIp,
          },
          level,
        });
      }

      // Sort by risk score descending
      results.sort((a, b) => b.riskScore - a.riskScore);

      return reply.send({ success: true, data: results });
    },
  );
}
