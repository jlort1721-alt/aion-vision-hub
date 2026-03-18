import { eq, and, sql, desc, gte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  sites,
  devices,
  events,
  incidents,
} from '../../db/schema/index.js';
import { config } from '../../config/env.js';
import { healthCheckCache } from '../../workers/health-check-worker.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OperationsDashboard {
  timestamp: string;
  sites: {
    total: number;
    withWanIp: number;
    withoutWanIp: number;
    byStatus: Record<string, number>;
  };
  devices: {
    total: number;
    active: number;
    pending: number;
    online: number;
    offline: number;
    byType: Record<string, number>;
    byBrand: Record<string, number>;
  };
  events: {
    last24h: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    topTypes: { type: string; count: number }[];
  };
  incidents: {
    total: number;
    open: number;
    resolved: number;
  };
  healthCheck: {
    lastRun: string | null;
    sitesChecked: number;
    devicesChecked: number;
    devicesOnline: number;
    devicesOffline: number;
  };
  siteDetails: SiteDetail[];
  integrations: IntegrationStatus;
  pendingActions: PendingAction[];
}

interface SiteDetail {
  siteId: string;
  name: string;
  slug: string;
  wanIp: string | null;
  status: string;
  deviceCount: number;
  devicesOnline: number;
  devicesOffline: number;
  devicesPending: number;
  lastEvent: string | null;
  riskLevel: string;
}

interface IntegrationStatus {
  ewelink: { configured: boolean; accountCount: number; domoticDevices: number };
  hikConnect: { configured: boolean; accountCount: number };
  whatsapp: { configured: boolean };
  email: { configured: boolean; provider: string };
  sip: { configured: boolean };
  ai: { configured: boolean; providers: string[] };
}

interface PendingAction {
  type: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  affectedSites: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class OperationsService {
  /**
   * Full consolidated dashboard for the operations overview.
   */
  async getDashboard(tenantId: string): Promise<OperationsDashboard> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Run independent queries in parallel
    const [
      siteRows,
      deviceRows,
      eventStats,
      topEventTypes,
      incidentStats,
      domoticStats,
      ewelinkAccounts,
      hikAccounts,
      siteLastEvents,
    ] = await Promise.all([
      // All sites for this tenant
      db
        .select()
        .from(sites)
        .where(eq(sites.tenantId, tenantId))
        .orderBy(sites.name),

      // All devices for this tenant
      db
        .select({
          id: devices.id,
          siteId: devices.siteId,
          type: devices.type,
          brand: devices.brand,
          status: devices.status,
        })
        .from(devices)
        .where(eq(devices.tenantId, tenantId)),

      // Event counts by severity (last 24h)
      db
        .select({
          total: sql<number>`count(*)::int`,
          critical: sql<number>`count(*) filter (where ${events.severity} = 'critical')::int`,
          high: sql<number>`count(*) filter (where ${events.severity} = 'high')::int`,
          medium: sql<number>`count(*) filter (where ${events.severity} = 'medium')::int`,
          low: sql<number>`count(*) filter (where ${events.severity} = 'low')::int`,
        })
        .from(events)
        .where(
          and(eq(events.tenantId, tenantId), gte(events.createdAt, last24h)),
        ),

      // Top event types (last 24h)
      db
        .select({
          type: events.eventType,
          count: sql<number>`count(*)::int`,
        })
        .from(events)
        .where(
          and(eq(events.tenantId, tenantId), gte(events.createdAt, last24h)),
        )
        .groupBy(events.eventType)
        .orderBy(desc(sql`count(*)`))
        .limit(10),

      // Incident counts
      db
        .select({
          total: sql<number>`count(*)::int`,
          open: sql<number>`count(*) filter (where ${incidents.status} in ('open', 'investigating'))::int`,
          resolved: sql<number>`count(*) filter (where ${incidents.status} in ('resolved', 'closed'))::int`,
        })
        .from(incidents)
        .where(eq(incidents.tenantId, tenantId)),

      // Domotic device count (type='domotic' in devices table)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(devices)
        .where(and(eq(devices.tenantId, tenantId), eq(devices.type, 'domotic'))),

      // eWeLink cloud accounts
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(devices)
        .where(
          and(
            eq(devices.tenantId, tenantId),
            eq(devices.type, 'cloud_account_ewelink'),
          ),
        ),

      // Hik-Connect cloud accounts
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(devices)
        .where(
          and(
            eq(devices.tenantId, tenantId),
            eq(devices.type, 'cloud_account_hik'),
          ),
        ),

      // Latest event per site
      db.execute(sql`
        select distinct on (site_id)
          site_id as "siteId",
          created_at as "lastEvent"
        from events
        where tenant_id = ${tenantId}
        order by site_id, created_at desc
      `),
    ]);

    // ── Aggregate sites ──────────────────────────────────────────────────────
    const withWanIp = siteRows.filter((s) => s.wanIp).length;
    const withoutWanIp = siteRows.length - withWanIp;

    const siteStatusCounts: Record<string, number> = {};
    for (const s of siteRows) {
      siteStatusCounts[s.status] = (siteStatusCounts[s.status] ?? 0) + 1;
    }

    // ── Aggregate devices ────────────────────────────────────────────────────
    const byType: Record<string, number> = {};
    const byBrand: Record<string, number> = {};
    let activeCount = 0;
    let pendingCount = 0;
    let onlineCount = 0;
    let offlineCount = 0;

    for (const d of deviceRows) {
      byType[d.type] = (byType[d.type] ?? 0) + 1;
      const brand = d.brand ?? 'unknown';
      byBrand[brand] = (byBrand[brand] ?? 0) + 1;

      if (d.status === 'online') {
        onlineCount++;
        activeCount++;
      } else if (d.status === 'offline') {
        offlineCount++;
        activeCount++;
      } else if (d.status === 'pending' || d.status === 'unknown') {
        pendingCount++;
      } else {
        activeCount++;
      }
    }

    // ── Health check cache summary ───────────────────────────────────────────
    let lastRun: string | null = null;
    let hcDevicesChecked = 0;
    let hcOnline = 0;
    let hcOffline = 0;
    const checkedSiteIds = new Set<string>();

    for (const [deviceId, result] of healthCheckCache) {
      hcDevicesChecked++;
      if (result.reachable) hcOnline++;
      else hcOffline++;

      // Track last run time (most recent checkedAt)
      const ts = result.checkedAt.toISOString();
      if (!lastRun || ts > lastRun) lastRun = ts;

      // Determine which site this device belongs to
      const device = deviceRows.find((d) => d.id === deviceId);
      if (device) checkedSiteIds.add(device.siteId);
    }

    // ── Build siteDetails ────────────────────────────────────────────────────
    const lastEventMap = new Map<string, string>();
    for (const row of siteLastEvents as unknown as { siteId: string; lastEvent: string }[]) {
      lastEventMap.set(row.siteId, row.lastEvent);
    }

    const siteDetails: SiteDetail[] = siteRows.map((site) => {
      const siteDevices = deviceRows.filter((d) => d.siteId === site.id);
      const devOnline = siteDevices.filter((d) => d.status === 'online').length;
      const devOffline = siteDevices.filter((d) => d.status === 'offline').length;
      const devPending = siteDevices.filter(
        (d) => d.status === 'pending' || d.status === 'unknown',
      ).length;

      const riskLevel = this.calculateRiskLevel(
        site.wanIp,
        siteDevices.length,
        devOnline,
        devOffline,
      );

      return {
        siteId: site.id,
        name: site.name,
        slug: site.slug ?? '',
        wanIp: site.wanIp,
        status: site.status,
        deviceCount: siteDevices.length,
        devicesOnline: devOnline,
        devicesOffline: devOffline,
        devicesPending: devPending,
        lastEvent: lastEventMap.get(site.id) ?? null,
        riskLevel,
      };
    });

    // ── Integrations status ──────────────────────────────────────────────────
    const aiProviders: string[] = [];
    if (config.OPENAI_API_KEY) aiProviders.push('openai');
    if (config.ANTHROPIC_API_KEY) aiProviders.push('anthropic');

    let emailProvider = 'none';
    if (config.RESEND_API_KEY) emailProvider = 'resend';
    else if (config.SENDGRID_API_KEY) emailProvider = 'sendgrid';
    else if (config.SMTP_HOST) emailProvider = 'smtp';

    const integrationStatus: IntegrationStatus = {
      ewelink: {
        configured: !!config.EWELINK_APP_ID,
        accountCount: ewelinkAccounts[0]?.count ?? 0,
        domoticDevices: domoticStats[0]?.count ?? 0,
      },
      hikConnect: {
        configured: true, // Hik-Connect works via device credentials
        accountCount: hikAccounts[0]?.count ?? 0,
      },
      whatsapp: {
        configured: !!config.WHATSAPP_PHONE_NUMBER_ID && !!config.WHATSAPP_ACCESS_TOKEN,
      },
      email: {
        configured: emailProvider !== 'none',
        provider: emailProvider,
      },
      sip: {
        configured: !!config.SIP_HOST,
      },
      ai: {
        configured: aiProviders.length > 0,
        providers: aiProviders,
      },
    };

    // ── Pending actions ──────────────────────────────────────────────────────
    const pendingActions: PendingAction[] = [];

    if (withoutWanIp > 0) {
      pendingActions.push({
        type: 'missing_wan_ip',
        description: `${withoutWanIp} sedes sin IP WAN — sin monitoreo remoto`,
        priority: 'critical',
        affectedSites: withoutWanIp,
      });
    }

    if (pendingCount > 0) {
      pendingActions.push({
        type: 'pending_devices',
        description: `${pendingCount} dispositivos pendientes de configuración`,
        priority: 'high',
        affectedSites: new Set(
          deviceRows
            .filter((d) => d.status === 'pending' || d.status === 'unknown')
            .map((d) => d.siteId),
        ).size,
      });
    }

    if (!integrationStatus.whatsapp.configured) {
      pendingActions.push({
        type: 'whatsapp_not_configured',
        description: 'WhatsApp API no configurado',
        priority: 'medium',
        affectedSites: siteRows.length,
      });
    }

    if (!config.EWELINK_APP_ID) {
      pendingActions.push({
        type: 'ewelink_not_configured',
        description: 'eWeLink APP_ID no configurado',
        priority: 'medium',
        affectedSites: siteRows.length,
      });
    }

    if (!config.SIP_HOST) {
      pendingActions.push({
        type: 'sip_not_configured',
        description: 'PBX/SIP no configurado',
        priority: 'low',
        affectedSites: siteRows.length,
      });
    }

    // ── Assemble response ────────────────────────────────────────────────────
    const evtStats = eventStats[0];

    return {
      timestamp: now.toISOString(),
      sites: {
        total: siteRows.length,
        withWanIp,
        withoutWanIp,
        byStatus: siteStatusCounts,
      },
      devices: {
        total: deviceRows.length,
        active: activeCount,
        pending: pendingCount,
        online: onlineCount,
        offline: offlineCount,
        byType,
        byBrand,
      },
      events: {
        last24h: evtStats?.total ?? 0,
        critical: evtStats?.critical ?? 0,
        high: evtStats?.high ?? 0,
        medium: evtStats?.medium ?? 0,
        low: evtStats?.low ?? 0,
        topTypes: topEventTypes.map((r) => ({ type: r.type, count: r.count })),
      },
      incidents: {
        total: incidentStats[0]?.total ?? 0,
        open: incidentStats[0]?.open ?? 0,
        resolved: incidentStats[0]?.resolved ?? 0,
      },
      healthCheck: {
        lastRun,
        sitesChecked: checkedSiteIds.size,
        devicesChecked: hcDevicesChecked,
        devicesOnline: hcOnline,
        devicesOffline: hcOffline,
      },
      siteDetails,
      integrations: integrationStatus,
      pendingActions,
    };
  }

  /**
   * Lightweight endpoint: just site status array.
   */
  async getSitesStatus(tenantId: string): Promise<SiteDetail[]> {
    const [siteRows, deviceRows, siteLastEvents] = await Promise.all([
      db
        .select()
        .from(sites)
        .where(eq(sites.tenantId, tenantId))
        .orderBy(sites.name),

      db
        .select({
          id: devices.id,
          siteId: devices.siteId,
          status: devices.status,
        })
        .from(devices)
        .where(eq(devices.tenantId, tenantId)),

      db.execute(sql`
        select distinct on (site_id)
          site_id as "siteId",
          created_at as "lastEvent"
        from events
        where tenant_id = ${tenantId}
        order by site_id, created_at desc
      `),
    ]);

    const lastEventMap = new Map<string, string>();
    for (const row of siteLastEvents as unknown as { siteId: string; lastEvent: string }[]) {
      lastEventMap.set(row.siteId, row.lastEvent);
    }

    return siteRows.map((site) => {
      const siteDevices = deviceRows.filter((d) => d.siteId === site.id);
      const devOnline = siteDevices.filter((d) => d.status === 'online').length;
      const devOffline = siteDevices.filter((d) => d.status === 'offline').length;
      const devPending = siteDevices.filter(
        (d) => d.status === 'pending' || d.status === 'unknown',
      ).length;

      return {
        siteId: site.id,
        name: site.name,
        slug: site.slug ?? '',
        wanIp: site.wanIp,
        status: site.status,
        deviceCount: siteDevices.length,
        devicesOnline: devOnline,
        devicesOffline: devOffline,
        devicesPending: devPending,
        lastEvent: lastEventMap.get(site.id) ?? null,
        riskLevel: this.calculateRiskLevel(
          site.wanIp,
          siteDevices.length,
          devOnline,
          devOffline,
        ),
      };
    });
  }

  // ─── Risk Level Calculation ──────────────────────────────────────────────

  private calculateRiskLevel(
    wanIp: string | null,
    totalDevices: number,
    online: number,
    offline: number,
  ): string {
    // No WAN IP = no remote monitoring = critical risk
    if (!wanIp) return 'critical';

    // No devices registered yet
    if (totalDevices === 0) return 'high';

    // All devices offline
    if (online === 0 && offline > 0) return 'critical';

    // More than half offline
    const offlineRatio = totalDevices > 0 ? offline / totalDevices : 0;
    if (offlineRatio > 0.5) return 'high';

    // Some offline
    if (offlineRatio > 0.2) return 'medium';

    return 'low';
  }
}

export const operationsService = new OperationsService();
