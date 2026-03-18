import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  events,
  incidents,
  devices,
  alertInstances,
  slaTracking,
  patrolLogs,
  shiftAssignments,
  kpiSnapshots,
} from '../../db/schema/index.js';
import type { KPISnapshotFilters } from './schemas.js';

export class AnalyticsService {
  // ══════════════════════════════════════════════════════════
  // DASHBOARD OVERVIEW
  // ══════════════════════════════════════════════════════════

  async getDashboardOverview(tenantId: string) {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Events stats (last 24h and 7d)
    const [eventStats] = await db
      .select({
        total24h: sql<number>`count(*) filter (where ${events.createdAt} >= ${last24h})::int`,
        total7d: sql<number>`count(*) filter (where ${events.createdAt} >= ${last7d})::int`,
        critical24h: sql<number>`count(*) filter (where ${events.createdAt} >= ${last24h} and ${events.severity} = 'critical')::int`,
        high24h: sql<number>`count(*) filter (where ${events.createdAt} >= ${last24h} and ${events.severity} = 'high')::int`,
        medium24h: sql<number>`count(*) filter (where ${events.createdAt} >= ${last24h} and ${events.severity} = 'medium')::int`,
        low24h: sql<number>`count(*) filter (where ${events.createdAt} >= ${last24h} and ${events.severity} = 'low')::int`,
      })
      .from(events)
      .where(and(
        eq(events.tenantId, tenantId),
        gte(events.createdAt, last7d),
      ));

    // Active incidents
    const [incidentStats] = await db
      .select({ active: sql<number>`count(*)::int` })
      .from(incidents)
      .where(and(
        eq(incidents.tenantId, tenantId),
        sql`${incidents.status} in ('open', 'investigating')`,
      ));

    // Device status counts
    const [deviceStats] = await db
      .select({
        online: sql<number>`count(*) filter (where ${devices.status} = 'online')::int`,
        offline: sql<number>`count(*) filter (where ${devices.status} = 'offline')::int`,
      })
      .from(devices)
      .where(eq(devices.tenantId, tenantId));

    // Active alerts (firing)
    const [alertStats] = await db
      .select({ firing: sql<number>`count(*)::int` })
      .from(alertInstances)
      .where(and(
        eq(alertInstances.tenantId, tenantId),
        eq(alertInstances.status, 'firing'),
      ));

    // SLA compliance rate
    const [slaStats] = await db
      .select({
        met: sql<number>`count(*) filter (where ${slaTracking.status} = 'met')::int`,
        breached: sql<number>`count(*) filter (where ${slaTracking.status} = 'breached')::int`,
      })
      .from(slaTracking)
      .where(eq(slaTracking.tenantId, tenantId));

    const slaMet = slaStats?.met ?? 0;
    const slaBreached = slaStats?.breached ?? 0;
    const slaTotal = slaMet + slaBreached;
    const slaComplianceRate = slaTotal > 0 ? Math.round((slaMet / slaTotal) * 10000) / 100 : 100;

    // Patrol compliance rate
    const [patrolStats] = await db
      .select({
        completed: sql<number>`count(*) filter (where ${patrolLogs.status} = 'completed')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(patrolLogs)
      .where(eq(patrolLogs.tenantId, tenantId));

    const patrolCompleted = patrolStats?.completed ?? 0;
    const patrolTotal = patrolStats?.total ?? 0;
    const patrolComplianceRate = patrolTotal > 0 ? Math.round((patrolCompleted / patrolTotal) * 10000) / 100 : 100;

    // Shift attendance rate
    const [shiftStats] = await db
      .select({
        attended: sql<number>`count(*) filter (where ${shiftAssignments.status} in ('checked_in', 'checked_out'))::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(shiftAssignments)
      .where(eq(shiftAssignments.tenantId, tenantId));

    const shiftAttended = shiftStats?.attended ?? 0;
    const shiftTotal = shiftStats?.total ?? 0;
    const shiftAttendanceRate = shiftTotal > 0 ? Math.round((shiftAttended / shiftTotal) * 10000) / 100 : 100;

    return {
      events: {
        last24h: eventStats?.total24h ?? 0,
        last7d: eventStats?.total7d ?? 0,
        bySeverity24h: {
          critical: eventStats?.critical24h ?? 0,
          high: eventStats?.high24h ?? 0,
          medium: eventStats?.medium24h ?? 0,
          low: eventStats?.low24h ?? 0,
        },
      },
      incidents: {
        active: incidentStats?.active ?? 0,
      },
      devices: {
        online: deviceStats?.online ?? 0,
        offline: deviceStats?.offline ?? 0,
      },
      alerts: {
        firing: alertStats?.firing ?? 0,
      },
      sla: {
        complianceRate: slaComplianceRate,
        met: slaMet,
        breached: slaBreached,
      },
      patrols: {
        complianceRate: patrolComplianceRate,
        completed: patrolCompleted,
        total: patrolTotal,
      },
      shifts: {
        attendanceRate: shiftAttendanceRate,
        attended: shiftAttended,
        total: shiftTotal,
      },
    };
  }

  // ══════════════════════════════════════════════════════════
  // EVENT TRENDS
  // ══════════════════════════════════════════════════════════

  async getEventTrends(tenantId: string, from: string, to: string, period: string) {
    const rows = await db.execute(sql`
      select
        date_trunc(${period}, ${events.createdAt}) as date,
        count(*)::int as total,
        count(*) filter (where ${events.severity} = 'critical')::int as critical,
        count(*) filter (where ${events.severity} = 'high')::int as high,
        count(*) filter (where ${events.severity} = 'medium')::int as medium,
        count(*) filter (where ${events.severity} = 'low')::int as low
      from ${events}
      where ${events.tenantId} = ${tenantId}
        and ${events.createdAt} >= ${from}
        and ${events.createdAt} <= ${to}
      group by date_trunc(${period}, ${events.createdAt})
      order by date_trunc(${period}, ${events.createdAt}) asc
    `);

    return rows;
  }

  // ══════════════════════════════════════════════════════════
  // INCIDENT METRICS
  // ══════════════════════════════════════════════════════════

  async getIncidentMetrics(tenantId: string, from: string, to: string) {
    const conditions = [
      eq(incidents.tenantId, tenantId),
      gte(incidents.createdAt, new Date(from)),
      lte(incidents.createdAt, new Date(to)),
    ];

    const [result] = await db
      .select({
        total: sql<number>`count(*)::int`,
        open: sql<number>`count(*) filter (where ${incidents.status} = 'open')::int`,
        investigating: sql<number>`count(*) filter (where ${incidents.status} = 'investigating')::int`,
        resolved: sql<number>`count(*) filter (where ${incidents.status} = 'resolved')::int`,
        closed: sql<number>`count(*) filter (where ${incidents.status} = 'closed')::int`,
        avgResolutionMinutes: sql<number>`
          coalesce(
            round(extract(epoch from avg(${incidents.closedAt} - ${incidents.createdAt})) / 60)::int,
            0
          )
        `,
      })
      .from(incidents)
      .where(and(...conditions));

    return {
      total: result?.total ?? 0,
      byStatus: {
        open: result?.open ?? 0,
        investigating: result?.investigating ?? 0,
        resolved: result?.resolved ?? 0,
        closed: result?.closed ?? 0,
      },
      avgResolutionMinutes: result?.avgResolutionMinutes ?? 0,
    };
  }

  // ══════════════════════════════════════════════════════════
  // DEVICE STATUS BREAKDOWN
  // ══════════════════════════════════════════════════════════

  async getDeviceStatusBreakdown(tenantId: string) {
    const rows = await db
      .select({
        siteId: devices.siteId,
        status: devices.status,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(eq(devices.tenantId, tenantId))
      .groupBy(devices.siteId, devices.status)
      .orderBy(devices.siteId);

    // Group by siteId for a nested structure
    const bySite: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      if (!bySite[row.siteId]) {
        bySite[row.siteId] = {};
      }
      bySite[row.siteId][row.status] = row.count;
    }

    return bySite;
  }

  // ══════════════════════════════════════════════════════════
  // TOP EVENT TYPES
  // ══════════════════════════════════════════════════════════

  async getTopEventTypes(tenantId: string, from: string, to: string, limit: number) {
    const rows = await db
      .select({
        type: events.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(events)
      .where(and(
        eq(events.tenantId, tenantId),
        gte(events.createdAt, new Date(from)),
        lte(events.createdAt, new Date(to)),
      ))
      .groupBy(events.eventType)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);

    return rows;
  }

  // ══════════════════════════════════════════════════════════
  // KPI SNAPSHOTS
  // ══════════════════════════════════════════════════════════

  async saveKPISnapshot(
    tenantId: string,
    period: string,
    periodStart: string,
    periodEnd: string,
    metrics: Record<string, unknown>,
  ) {
    const [snapshot] = await db
      .insert(kpiSnapshots)
      .values({
        tenantId,
        period,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        metrics,
      })
      .returning();

    return snapshot;
  }

  async listKPISnapshots(tenantId: string, filters: KPISnapshotFilters) {
    const conditions = [
      eq(kpiSnapshots.tenantId, tenantId),
      eq(kpiSnapshots.period, filters.period),
    ];

    if (filters.from) {
      conditions.push(gte(kpiSnapshots.periodStart, new Date(filters.from)));
    }
    if (filters.to) {
      conditions.push(lte(kpiSnapshots.periodEnd, new Date(filters.to)));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(kpiSnapshots)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(kpiSnapshots)
      .where(whereClause)
      .orderBy(desc(kpiSnapshots.periodStart))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: {
        page: filters.page,
        perPage: filters.perPage,
        total,
        totalPages: Math.ceil(total / filters.perPage),
      },
    };
  }
}

export const analyticsService = new AnalyticsService();
