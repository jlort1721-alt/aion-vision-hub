/**
 * MCP Server Tool — Report Server
 *
 * Provides tools for generating reports, retrieving KPI snapshots,
 * and accessing analytics data. All queries are tenant-scoped.
 */

import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import {
  reports,
  events,
  incidents,
  devices,
  sites,
  kpiSnapshots,
  auditLogs,
} from '../../../db/schema/index.js';
import type { MCPServerTool } from './index.js';

// ── generate_report ───────────────────────────────────────────

export const generateReport: MCPServerTool = {
  name: 'generate_report',
  description:
    'Generate a report of a given type for a date range. Creates a report request record and returns it. The report is processed asynchronously.',
  parameters: {
    type: {
      type: 'string',
      description: 'Report type',
      required: true,
      enum: [
        'daily_summary',
        'weekly_incidents',
        'monthly_sla',
        'device_health',
        'event_analysis',
        'patrol_compliance',
        'access_log',
      ],
    },
    date_from: {
      type: 'string',
      description: 'Report start date (ISO 8601, required)',
      required: true,
    },
    date_to: {
      type: 'string',
      description: 'Report end date (ISO 8601, required)',
      required: true,
    },
    site_id: {
      type: 'string',
      description: 'Optional site UUID to scope the report to',
      required: false,
    },
    format: {
      type: 'string',
      description: 'Output format',
      required: false,
      enum: ['pdf', 'csv', 'json'],
    },
  },
  execute: async (params, context) => {
    const type = params.type as string;
    const dateFrom = params.date_from as string;
    const dateTo = params.date_to as string;
    const siteId = params.site_id as string | undefined;
    const format = (params.format as string) || 'pdf';

    if (!type || !dateFrom || !dateTo) {
      return { error: 'type, date_from, and date_to are required' };
    }

    const validTypes = [
      'daily_summary',
      'weekly_incidents',
      'monthly_sla',
      'device_health',
      'event_analysis',
      'patrol_compliance',
      'access_log',
    ];
    if (!validTypes.includes(type)) {
      return { error: `Invalid report type. Must be one of: ${validTypes.join(', ')}` };
    }

    const validFormats = ['pdf', 'csv', 'json'];
    if (!validFormats.includes(format)) {
      return { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` };
    }

    // Validate site belongs to tenant if specified
    if (siteId) {
      const [site] = await db
        .select({ id: sites.id })
        .from(sites)
        .where(and(eq(sites.id, siteId), eq(sites.tenantId, context.tenantId)))
        .limit(1);

      if (!site) {
        return { error: `Site '${siteId}' not found or does not belong to this tenant` };
      }
    }

    // Create the report request
    const [report] = await db
      .insert(reports)
      .values({
        tenantId: context.tenantId,
        name: `${type} — ${dateFrom} to ${dateTo}`,
        type,
        format,
        parameters: {
          dateFrom,
          dateTo,
          siteId: siteId ?? null,
        },
        status: 'pending',
        generatedBy: context.userId,
      })
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      tenantId: context.tenantId,
      userId: context.userId,
      userEmail: 'mcp-agent',
      action: 'mcp.report.generate',
      entityType: 'report',
      entityId: report.id,
      afterState: {
        type,
        dateFrom,
        dateTo,
        siteId: siteId ?? null,
        format,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      message: 'Report generation request created',
      report: {
        id: report.id,
        name: report.name,
        type: report.type,
        format: report.format,
        status: report.status,
        parameters: report.parameters,
        created_at: report.createdAt.toISOString(),
      },
    };
  },
};

// ── get_kpis ──────────────────────────────────────────────────

export const getKpis: MCPServerTool = {
  name: 'get_kpis',
  description:
    'Get a KPI (Key Performance Indicator) snapshot including MTTA, MTTR, event counts, incident counts, and device uptime metrics.',
  parameters: {
    period: {
      type: 'string',
      description: 'KPI period to retrieve',
      required: false,
      enum: ['hourly', 'daily', 'weekly', 'monthly'],
    },
    date_from: {
      type: 'string',
      description: 'Start date for KPI calculation (ISO 8601). Defaults to last 30 days.',
      required: false,
    },
    date_to: {
      type: 'string',
      description: 'End date for KPI calculation (ISO 8601). Defaults to now.',
      required: false,
    },
  },
  execute: async (params, context) => {
    const period = (params.period as string) || 'daily';
    const dateTo = params.date_to ? new Date(params.date_to as string) : new Date();
    const dateFrom = params.date_from
      ? new Date(params.date_from as string)
      : new Date(dateTo.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Try to fetch pre-computed KPI snapshots first
    const snapshots = await db
      .select()
      .from(kpiSnapshots)
      .where(
        and(
          eq(kpiSnapshots.tenantId, context.tenantId),
          eq(kpiSnapshots.period, period),
          gte(kpiSnapshots.periodStart, dateFrom),
          lte(kpiSnapshots.periodEnd, dateTo),
        ),
      )
      .orderBy(desc(kpiSnapshots.periodStart))
      .limit(30);

    // Also compute real-time KPIs from live data

    // Event stats for the period
    const [eventStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        critical: sql<number>`count(*) filter (where ${events.severity} = 'critical')::int`,
        high: sql<number>`count(*) filter (where ${events.severity} = 'high')::int`,
        resolved: sql<number>`count(*) filter (where ${events.status} = 'resolved')::int`,
      })
      .from(events)
      .where(
        and(
          eq(events.tenantId, context.tenantId),
          gte(events.createdAt, dateFrom),
          lte(events.createdAt, dateTo),
        ),
      );

    // Incident stats
    const [incidentStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        open: sql<number>`count(*) filter (where ${incidents.status} in ('open', 'investigating'))::int`,
        resolved: sql<number>`count(*) filter (where ${incidents.status} in ('resolved', 'closed'))::int`,
      })
      .from(incidents)
      .where(
        and(
          eq(incidents.tenantId, context.tenantId),
          gte(incidents.createdAt, dateFrom),
          lte(incidents.createdAt, dateTo),
        ),
      );

    // MTTA (Mean Time To Acknowledge) — average time from event creation to acknowledgement
    const [mttaResult] = await db
      .select({
        avg_minutes: sql<number>`
          coalesce(
            avg(extract(epoch from (${events.updatedAt} - ${events.createdAt})) / 60)
            filter (where ${events.status} in ('acknowledged', 'resolved')),
            0
          )::numeric(10,2)
        `,
      })
      .from(events)
      .where(
        and(
          eq(events.tenantId, context.tenantId),
          gte(events.createdAt, dateFrom),
          lte(events.createdAt, dateTo),
        ),
      );

    // MTTR (Mean Time To Resolve) — average time from event creation to resolution
    const [mttrResult] = await db
      .select({
        avg_minutes: sql<number>`
          coalesce(
            avg(extract(epoch from (${events.resolvedAt} - ${events.createdAt})) / 60)
            filter (where ${events.resolvedAt} is not null),
            0
          )::numeric(10,2)
        `,
      })
      .from(events)
      .where(
        and(
          eq(events.tenantId, context.tenantId),
          gte(events.createdAt, dateFrom),
          lte(events.createdAt, dateTo),
        ),
      );

    // Device uptime — percentage of devices currently online
    const [deviceStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        online: sql<number>`count(*) filter (where ${devices.status} = 'online')::int`,
      })
      .from(devices)
      .where(eq(devices.tenantId, context.tenantId));

    const deviceUptimePct =
      deviceStats?.total && deviceStats.total > 0
        ? Math.round(((deviceStats.online ?? 0) / deviceStats.total) * 10000) / 100
        : 0;

    return {
      period: {
        from: dateFrom.toISOString(),
        to: dateTo.toISOString(),
        granularity: period,
      },
      kpis: {
        mtta_minutes: Number(mttaResult?.avg_minutes ?? 0),
        mttr_minutes: Number(mttrResult?.avg_minutes ?? 0),
        events_total: eventStats?.total ?? 0,
        events_critical: eventStats?.critical ?? 0,
        events_high: eventStats?.high ?? 0,
        events_resolved: eventStats?.resolved ?? 0,
        incidents_total: incidentStats?.total ?? 0,
        incidents_open: incidentStats?.open ?? 0,
        incidents_resolved: incidentStats?.resolved ?? 0,
        device_uptime_pct: deviceUptimePct,
        devices_total: deviceStats?.total ?? 0,
        devices_online: deviceStats?.online ?? 0,
      },
      historical_snapshots: snapshots.map((s) => ({
        period_start: s.periodStart.toISOString(),
        period_end: s.periodEnd.toISOString(),
        metrics: s.metrics,
      })),
      generated_at: new Date().toISOString(),
    };
  },
};

// ── get_analytics ─────────────────────────────────────────────

export const getAnalytics: MCPServerTool = {
  name: 'get_analytics',
  description:
    'Get analytics for a time period including events by severity, incidents by status, device health distribution, and event type breakdown.',
  parameters: {
    date_from: {
      type: 'string',
      description: 'Start date (ISO 8601). Defaults to last 7 days.',
      required: false,
    },
    date_to: {
      type: 'string',
      description: 'End date (ISO 8601). Defaults to now.',
      required: false,
    },
    site_id: {
      type: 'string',
      description: 'Optional site UUID to scope analytics to',
      required: false,
    },
  },
  execute: async (params, context) => {
    const dateTo = params.date_to ? new Date(params.date_to as string) : new Date();
    const dateFrom = params.date_from
      ? new Date(params.date_from as string)
      : new Date(dateTo.getTime() - 7 * 24 * 60 * 60 * 1000);
    const siteId = params.site_id as string | undefined;

    // Events by severity
    const eventConditions = [
      eq(events.tenantId, context.tenantId),
      gte(events.createdAt, dateFrom),
      lte(events.createdAt, dateTo),
    ];
    if (siteId) {
      eventConditions.push(eq(events.siteId, siteId));
    }

    const [eventsBySeverity] = await db
      .select({
        total: sql<number>`count(*)::int`,
        critical: sql<number>`count(*) filter (where ${events.severity} = 'critical')::int`,
        high: sql<number>`count(*) filter (where ${events.severity} = 'high')::int`,
        medium: sql<number>`count(*) filter (where ${events.severity} = 'medium')::int`,
        low: sql<number>`count(*) filter (where ${events.severity} = 'low')::int`,
        info: sql<number>`count(*) filter (where ${events.severity} = 'info')::int`,
      })
      .from(events)
      .where(and(...eventConditions));

    // Events by status
    const [eventsByStatus] = await db
      .select({
        new_count: sql<number>`count(*) filter (where ${events.status} = 'new')::int`,
        acknowledged: sql<number>`count(*) filter (where ${events.status} = 'acknowledged')::int`,
        resolved: sql<number>`count(*) filter (where ${events.status} = 'resolved')::int`,
        dismissed: sql<number>`count(*) filter (where ${events.status} = 'dismissed')::int`,
      })
      .from(events)
      .where(and(...eventConditions));

    // Events by type
    const eventTypeRows = await db
      .select({
        type: events.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(events)
      .where(and(...eventConditions))
      .groupBy(events.eventType)
      .orderBy(sql`count(*) desc`)
      .limit(20);

    // Incidents by status
    const incidentConditions = [
      eq(incidents.tenantId, context.tenantId),
      gte(incidents.createdAt, dateFrom),
      lte(incidents.createdAt, dateTo),
    ];
    if (siteId) {
      incidentConditions.push(eq(incidents.siteId, siteId));
    }

    const [incidentsByStatus] = await db
      .select({
        total: sql<number>`count(*)::int`,
        open: sql<number>`count(*) filter (where ${incidents.status} = 'open')::int`,
        investigating: sql<number>`count(*) filter (where ${incidents.status} = 'investigating')::int`,
        resolved: sql<number>`count(*) filter (where ${incidents.status} = 'resolved')::int`,
        closed: sql<number>`count(*) filter (where ${incidents.status} = 'closed')::int`,
      })
      .from(incidents)
      .where(and(...incidentConditions));

    // Incidents by priority
    const [incidentsByPriority] = await db
      .select({
        critical: sql<number>`count(*) filter (where ${incidents.priority} = 'critical')::int`,
        high: sql<number>`count(*) filter (where ${incidents.priority} = 'high')::int`,
        medium: sql<number>`count(*) filter (where ${incidents.priority} = 'medium')::int`,
        low: sql<number>`count(*) filter (where ${incidents.priority} = 'low')::int`,
      })
      .from(incidents)
      .where(and(...incidentConditions));

    // Device health (current snapshot)
    const deviceConditions = [eq(devices.tenantId, context.tenantId)];
    if (siteId) {
      deviceConditions.push(eq(devices.siteId, siteId));
    }

    const [deviceHealth] = await db
      .select({
        total: sql<number>`count(*)::int`,
        online: sql<number>`count(*) filter (where ${devices.status} = 'online')::int`,
        offline: sql<number>`count(*) filter (where ${devices.status} = 'offline')::int`,
        unknown: sql<number>`count(*) filter (where ${devices.status} = 'unknown')::int`,
      })
      .from(devices)
      .where(and(...deviceConditions));

    // Device types breakdown
    const deviceTypeRows = await db
      .select({
        type: devices.type,
        count: sql<number>`count(*)::int`,
        online: sql<number>`count(*) filter (where ${devices.status} = 'online')::int`,
      })
      .from(devices)
      .where(and(...deviceConditions))
      .groupBy(devices.type)
      .orderBy(sql`count(*) desc`);

    // Events per day trend
    const dailyEventTrend = await db
      .select({
        date: sql<string>`date_trunc('day', ${events.createdAt})::date::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(events)
      .where(and(...eventConditions))
      .groupBy(sql`date_trunc('day', ${events.createdAt})`)
      .orderBy(sql`date_trunc('day', ${events.createdAt})`);

    return {
      period: {
        from: dateFrom.toISOString(),
        to: dateTo.toISOString(),
        site_id: siteId ?? null,
      },
      events: {
        by_severity: {
          total: eventsBySeverity?.total ?? 0,
          critical: eventsBySeverity?.critical ?? 0,
          high: eventsBySeverity?.high ?? 0,
          medium: eventsBySeverity?.medium ?? 0,
          low: eventsBySeverity?.low ?? 0,
          info: eventsBySeverity?.info ?? 0,
        },
        by_status: {
          new: eventsByStatus?.new_count ?? 0,
          acknowledged: eventsByStatus?.acknowledged ?? 0,
          resolved: eventsByStatus?.resolved ?? 0,
          dismissed: eventsByStatus?.dismissed ?? 0,
        },
        by_type: eventTypeRows,
        daily_trend: dailyEventTrend,
      },
      incidents: {
        by_status: {
          total: incidentsByStatus?.total ?? 0,
          open: incidentsByStatus?.open ?? 0,
          investigating: incidentsByStatus?.investigating ?? 0,
          resolved: incidentsByStatus?.resolved ?? 0,
          closed: incidentsByStatus?.closed ?? 0,
        },
        by_priority: {
          critical: incidentsByPriority?.critical ?? 0,
          high: incidentsByPriority?.high ?? 0,
          medium: incidentsByPriority?.medium ?? 0,
          low: incidentsByPriority?.low ?? 0,
        },
      },
      device_health: {
        total: deviceHealth?.total ?? 0,
        online: deviceHealth?.online ?? 0,
        offline: deviceHealth?.offline ?? 0,
        unknown: deviceHealth?.unknown ?? 0,
        uptime_pct:
          deviceHealth?.total && deviceHealth.total > 0
            ? Math.round(((deviceHealth.online ?? 0) / deviceHealth.total) * 10000) / 100
            : 0,
        by_type: deviceTypeRows,
      },
      generated_at: new Date().toISOString(),
    };
  },
};

/** All report tools */
export const reportServerTools: MCPServerTool[] = [
  generateReport,
  getKpis,
  getAnalytics,
];
