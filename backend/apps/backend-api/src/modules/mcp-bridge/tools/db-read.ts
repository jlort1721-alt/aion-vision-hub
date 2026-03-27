/**
 * MCP Server Tool — Database Read Server
 *
 * Provides read-only query tools for events, incidents, devices,
 * site status, and dashboard summaries. All queries are tenant-scoped.
 */

import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { events, incidents, devices, sites } from '../../../db/schema/index.js';
import type { MCPServerTool } from './index.js';

// ── query_events ──────────────────────────────────────────────

export const queryEvents: MCPServerTool = {
  name: 'query_events',
  description:
    'Query security events with optional filters. Returns events matching severity, status, site, device, and date range criteria.',
  parameters: {
    severity: {
      type: 'string',
      description: 'Filter by severity level',
      required: false,
      enum: ['critical', 'high', 'medium', 'low', 'info'],
    },
    status: {
      type: 'string',
      description: 'Filter by event status',
      required: false,
      enum: ['new', 'acknowledged', 'resolved', 'dismissed'],
    },
    site_id: {
      type: 'string',
      description: 'Filter by site UUID',
      required: false,
    },
    device_id: {
      type: 'string',
      description: 'Filter by device UUID',
      required: false,
    },
    date_from: {
      type: 'string',
      description: 'Start date for range filter (ISO 8601)',
      required: false,
    },
    date_to: {
      type: 'string',
      description: 'End date for range filter (ISO 8601)',
      required: false,
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results (default: 50, max: 200)',
      required: false,
    },
  },
  execute: async (params, context) => {
    const conditions = [eq(events.tenantId, context.tenantId)];

    if (params.severity) {
      conditions.push(eq(events.severity, params.severity as string));
    }
    if (params.status) {
      conditions.push(eq(events.status, params.status as string));
    }
    if (params.site_id) {
      conditions.push(eq(events.siteId, params.site_id as string));
    }
    if (params.device_id) {
      conditions.push(eq(events.deviceId, params.device_id as string));
    }
    if (params.date_from) {
      conditions.push(gte(events.createdAt, new Date(params.date_from as string)));
    }
    if (params.date_to) {
      conditions.push(lte(events.createdAt, new Date(params.date_to as string)));
    }

    const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(events)
      .where(and(...conditions));

    const rows = await db
      .select()
      .from(events)
      .where(and(...conditions))
      .orderBy(desc(events.createdAt))
      .limit(limit);

    return {
      events: rows,
      total: countResult?.count ?? 0,
      returned: rows.length,
      limit,
    };
  },
};

// ── query_incidents ───────────────────────────────────────────

export const queryIncidents: MCPServerTool = {
  name: 'query_incidents',
  description:
    'Query incidents with optional filters. Returns incidents matching status, priority, site, and date range criteria.',
  parameters: {
    status: {
      type: 'string',
      description: 'Filter by incident status',
      required: false,
      enum: ['open', 'investigating', 'resolved', 'closed'],
    },
    priority: {
      type: 'string',
      description: 'Filter by priority level',
      required: false,
      enum: ['critical', 'high', 'medium', 'low'],
    },
    site_id: {
      type: 'string',
      description: 'Filter by site UUID',
      required: false,
    },
    date_from: {
      type: 'string',
      description: 'Start date for range filter (ISO 8601)',
      required: false,
    },
    date_to: {
      type: 'string',
      description: 'End date for range filter (ISO 8601)',
      required: false,
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results (default: 50, max: 200)',
      required: false,
    },
  },
  execute: async (params, context) => {
    const conditions = [eq(incidents.tenantId, context.tenantId)];

    if (params.status) {
      conditions.push(eq(incidents.status, params.status as string));
    }
    if (params.priority) {
      conditions.push(eq(incidents.priority, params.priority as string));
    }
    if (params.site_id) {
      conditions.push(eq(incidents.siteId, params.site_id as string));
    }
    if (params.date_from) {
      conditions.push(gte(incidents.createdAt, new Date(params.date_from as string)));
    }
    if (params.date_to) {
      conditions.push(lte(incidents.createdAt, new Date(params.date_to as string)));
    }

    const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(incidents)
      .where(and(...conditions));

    const rows = await db
      .select()
      .from(incidents)
      .where(and(...conditions))
      .orderBy(desc(incidents.createdAt))
      .limit(limit);

    return {
      incidents: rows,
      total: countResult?.count ?? 0,
      returned: rows.length,
      limit,
    };
  },
};

// ── query_devices ─────────────────────────────────────────────

export const queryDevices: MCPServerTool = {
  name: 'query_devices',
  description:
    'Query devices with optional filters. Returns devices matching status, brand, site, and type criteria.',
  parameters: {
    status: {
      type: 'string',
      description: 'Filter by device status',
      required: false,
      enum: ['online', 'offline', 'unknown'],
    },
    brand: {
      type: 'string',
      description: 'Filter by device brand',
      required: false,
    },
    site_id: {
      type: 'string',
      description: 'Filter by site UUID',
      required: false,
    },
    type: {
      type: 'string',
      description: 'Filter by device type (e.g., camera, nvr, access_control, domotic)',
      required: false,
    },
  },
  execute: async (params, context) => {
    const conditions = [eq(devices.tenantId, context.tenantId)];

    if (params.status) {
      conditions.push(eq(devices.status, params.status as string));
    }
    if (params.brand) {
      conditions.push(eq(devices.brand, params.brand as string));
    }
    if (params.site_id) {
      conditions.push(eq(devices.siteId, params.site_id as string));
    }
    if (params.type) {
      conditions.push(eq(devices.type, params.type as string));
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(devices)
      .where(and(...conditions));

    const rows = await db
      .select({
        id: devices.id,
        name: devices.name,
        type: devices.type,
        brand: devices.brand,
        model: devices.model,
        status: devices.status,
        siteId: devices.siteId,
        ipAddress: devices.ipAddress,
        port: devices.port,
        channels: devices.channels,
        tags: devices.tags,
        lastSeen: devices.lastSeen,
        createdAt: devices.createdAt,
      })
      .from(devices)
      .where(and(...conditions))
      .orderBy(devices.name);

    return {
      devices: rows,
      total: countResult?.count ?? 0,
      returned: rows.length,
    };
  },
};

// ── get_site_status ───────────────────────────────────────────

export const getSiteStatus: MCPServerTool = {
  name: 'get_site_status',
  description:
    'Get a comprehensive status summary for a specific site, including device counts by status, active events, and recent incidents.',
  parameters: {
    site_id: {
      type: 'string',
      description: 'Site UUID to get status for',
      required: true,
    },
  },
  execute: async (params, context) => {
    const siteId = params.site_id as string;
    if (!siteId) {
      return { error: 'site_id is required' };
    }

    // Verify site belongs to tenant
    const [site] = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.tenantId, context.tenantId)))
      .limit(1);

    if (!site) {
      return { error: `Site '${siteId}' not found or does not belong to this tenant` };
    }

    // Device counts by status
    const [deviceStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        online: sql<number>`count(*) filter (where ${devices.status} = 'online')::int`,
        offline: sql<number>`count(*) filter (where ${devices.status} = 'offline')::int`,
        unknown: sql<number>`count(*) filter (where ${devices.status} = 'unknown')::int`,
      })
      .from(devices)
      .where(and(eq(devices.tenantId, context.tenantId), eq(devices.siteId, siteId)));

    // Active events (non-resolved)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [eventStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        critical: sql<number>`count(*) filter (where ${events.severity} = 'critical')::int`,
        high: sql<number>`count(*) filter (where ${events.severity} = 'high')::int`,
        new_events: sql<number>`count(*) filter (where ${events.status} = 'new')::int`,
        acknowledged: sql<number>`count(*) filter (where ${events.status} = 'acknowledged')::int`,
      })
      .from(events)
      .where(
        and(
          eq(events.tenantId, context.tenantId),
          eq(events.siteId, siteId),
          gte(events.createdAt, last24h),
        ),
      );

    // Recent incidents
    const recentIncidents = await db
      .select({
        id: incidents.id,
        title: incidents.title,
        status: incidents.status,
        priority: incidents.priority,
        createdAt: incidents.createdAt,
      })
      .from(incidents)
      .where(
        and(
          eq(incidents.tenantId, context.tenantId),
          eq(incidents.siteId, siteId),
        ),
      )
      .orderBy(desc(incidents.createdAt))
      .limit(5);

    return {
      site: {
        id: site.id,
        name: site.name,
        address: site.address,
        status: site.status,
        wanIp: site.wanIp,
      },
      devices: {
        total: deviceStats?.total ?? 0,
        online: deviceStats?.online ?? 0,
        offline: deviceStats?.offline ?? 0,
        unknown: deviceStats?.unknown ?? 0,
      },
      events_last_24h: {
        total: eventStats?.total ?? 0,
        critical: eventStats?.critical ?? 0,
        high: eventStats?.high ?? 0,
        new: eventStats?.new_events ?? 0,
        acknowledged: eventStats?.acknowledged ?? 0,
      },
      recent_incidents: recentIncidents,
    };
  },
};

// ── get_dashboard_summary ─────────────────────────────────────

export const getDashboardSummary: MCPServerTool = {
  name: 'get_dashboard_summary',
  description:
    'Get an overall platform summary including total devices, online/offline counts, events today, and active incidents across all sites.',
  parameters: {},
  execute: async (_params, context) => {
    // Device summary
    const [deviceStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        online: sql<number>`count(*) filter (where ${devices.status} = 'online')::int`,
        offline: sql<number>`count(*) filter (where ${devices.status} = 'offline')::int`,
        unknown: sql<number>`count(*) filter (where ${devices.status} = 'unknown')::int`,
      })
      .from(devices)
      .where(eq(devices.tenantId, context.tenantId));

    // Events today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [eventStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        critical: sql<number>`count(*) filter (where ${events.severity} = 'critical')::int`,
        high: sql<number>`count(*) filter (where ${events.severity} = 'high')::int`,
        medium: sql<number>`count(*) filter (where ${events.severity} = 'medium')::int`,
        low: sql<number>`count(*) filter (where ${events.severity} = 'low')::int`,
        unresolved: sql<number>`count(*) filter (where ${events.status} in ('new', 'acknowledged'))::int`,
      })
      .from(events)
      .where(
        and(eq(events.tenantId, context.tenantId), gte(events.createdAt, todayStart)),
      );

    // Active incidents
    const [incidentStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        open: sql<number>`count(*) filter (where ${incidents.status} = 'open')::int`,
        investigating: sql<number>`count(*) filter (where ${incidents.status} = 'investigating')::int`,
        resolved_today: sql<number>`count(*) filter (where ${incidents.status} in ('resolved', 'closed') and ${incidents.closedAt} >= ${todayStart})::int`,
      })
      .from(incidents)
      .where(eq(incidents.tenantId, context.tenantId));

    // Site count
    const [siteCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sites)
      .where(eq(sites.tenantId, context.tenantId));

    return {
      sites: {
        total: siteCount?.count ?? 0,
      },
      devices: {
        total: deviceStats?.total ?? 0,
        online: deviceStats?.online ?? 0,
        offline: deviceStats?.offline ?? 0,
        unknown: deviceStats?.unknown ?? 0,
        healthPercentage:
          deviceStats?.total && deviceStats.total > 0
            ? Math.round(((deviceStats.online ?? 0) / deviceStats.total) * 100)
            : 0,
      },
      events_today: {
        total: eventStats?.total ?? 0,
        critical: eventStats?.critical ?? 0,
        high: eventStats?.high ?? 0,
        medium: eventStats?.medium ?? 0,
        low: eventStats?.low ?? 0,
        unresolved: eventStats?.unresolved ?? 0,
      },
      incidents: {
        total_active:
          (incidentStats?.open ?? 0) + (incidentStats?.investigating ?? 0),
        open: incidentStats?.open ?? 0,
        investigating: incidentStats?.investigating ?? 0,
        resolved_today: incidentStats?.resolved_today ?? 0,
      },
      generated_at: new Date().toISOString(),
    };
  },
};

/** All database read tools */
export const dbReadTools: MCPServerTool[] = [
  queryEvents,
  queryIncidents,
  queryDevices,
  getSiteStatus,
  getDashboardSummary,
];
