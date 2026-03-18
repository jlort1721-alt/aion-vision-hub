/**
 * Cloud Account Mapping & Validation Service
 *
 * Analyses cloud account usage across sites to identify shared-account
 * security risks and provides device inventory / pending-config summaries.
 */

import { eq, and, sql, or, ilike } from 'drizzle-orm';
import { db as defaultDb } from '../../db/client.js';
import { devices, sites } from '../../db/schema/index.js';

// ── Types ────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface SiteRef {
  siteId: string;
  siteName: string;
  siteSlug: string;
}

interface DomoticDeviceRef {
  deviceId: string;
  deviceName: string;
  appId: string;
  appName: string;
  siteSlug: string;
}

interface HikDeviceRef {
  deviceId: string;
  deviceName: string;
  serialNumber: string;
  siteSlug: string;
}

interface EwelinkAccountEntry {
  email: string;
  sites: SiteRef[];
  domoticDevices: DomoticDeviceRef[];
  riskLevel: RiskLevel;
  recommendation: string;
}

interface HikConnectAccountEntry {
  email: string;
  sites: SiteRef[];
  connectedDevices: HikDeviceRef[];
  riskLevel: RiskLevel;
  recommendation: string;
}

export interface CloudAccountMapping {
  ewelinkAccounts: EwelinkAccountEntry[];
  hikConnectAccounts: HikConnectAccountEntry[];
  summary: {
    totalEwelinkAccounts: number;
    totalHikConnectAccounts: number;
    totalDomoticDevices: number;
    totalHikDevices: number;
    sharedAccountRisk: RiskLevel;
    recommendations: string[];
  };
}

interface InventoryByType {
  type: string;
  count: number;
}

interface InventoryBySite {
  siteId: string;
  siteName: string;
  siteSlug: string;
  deviceCount: number;
}

interface InventoryByStatus {
  status: string;
  count: number;
}

export interface DeviceInventorySummary {
  totalDevices: number;
  byType: InventoryByType[];
  bySite: InventoryBySite[];
  byStatus: InventoryByStatus[];
}

export interface PendingDevice {
  deviceId: string;
  deviceName: string;
  type: string;
  siteId: string;
  siteName: string;
  siteSlug: string;
  status: string;
  missingFields: string | null;
  createdAt: Date;
}

// ── Helpers ──────────────────────────────────────────────────────

function calculateRisk(siteCount: number): RiskLevel {
  if (siteCount >= 13) return 'critical';
  if (siteCount >= 7) return 'high';
  if (siteCount >= 4) return 'medium';
  return 'low';
}

function worstRisk(levels: RiskLevel[]): RiskLevel {
  const order: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
  let worst = 0;
  for (const l of levels) {
    const idx = order.indexOf(l);
    if (idx > worst) worst = idx;
  }
  return order[worst];
}

// ── Service ──────────────────────────────────────────────────────

export class CloudAccountService {
  /**
   * Build a full account-mapping with risk analysis for a tenant.
   */
  async getAccountMapping(
    database: typeof defaultDb,
    tenantId: string,
  ): Promise<CloudAccountMapping> {
    // 1. Fetch all ewelink cloud accounts
    const ewelinkRows = await database
      .select({
        id: devices.id,
        username: devices.username,
        siteId: devices.siteId,
        siteName: sites.name,
        siteSlug: sites.slug,
      })
      .from(devices)
      .innerJoin(sites, eq(devices.siteId, sites.id))
      .where(
        and(
          eq(devices.tenantId, tenantId),
          eq(devices.type, 'cloud_account_ewelink'),
        ),
      );

    // 2. Fetch all hik-connect cloud accounts
    const hikAccountRows = await database
      .select({
        id: devices.id,
        username: devices.username,
        siteId: devices.siteId,
        siteName: sites.name,
        siteSlug: sites.slug,
      })
      .from(devices)
      .innerJoin(sites, eq(devices.siteId, sites.id))
      .where(
        and(
          eq(devices.tenantId, tenantId),
          eq(devices.type, 'cloud_account_hik'),
        ),
      );

    // 3. Fetch all domotic devices (for ewelink mapping)
    const domoticRows = await database
      .select({
        id: devices.id,
        name: devices.name,
        appId: devices.appId,
        appName: devices.appName,
        siteId: devices.siteId,
        siteSlug: sites.slug,
      })
      .from(devices)
      .innerJoin(sites, eq(devices.siteId, sites.id))
      .where(
        and(
          eq(devices.tenantId, tenantId),
          eq(devices.type, 'domotic'),
        ),
      );

    // 4. Fetch all hik-connect connected devices
    const hikDeviceRows = await database
      .select({
        id: devices.id,
        name: devices.name,
        serialNumber: devices.serialNumber,
        siteId: devices.siteId,
        siteSlug: sites.slug,
        connectionType: devices.connectionType,
      })
      .from(devices)
      .innerJoin(sites, eq(devices.siteId, sites.id))
      .where(
        and(
          eq(devices.tenantId, tenantId),
          or(
            ilike(devices.connectionType, '%Hik-Connect%'),
            ilike(devices.connectionType, '%hik-connect%'),
          ),
        ),
      );

    // ── Group eWeLink accounts by email ──
    const ewelinkMap = new Map<string, { sites: Map<string, SiteRef>; domoticDevices: DomoticDeviceRef[] }>();

    for (const row of ewelinkRows) {
      const email = (row.username ?? 'unknown').toLowerCase();
      if (!ewelinkMap.has(email)) {
        ewelinkMap.set(email, { sites: new Map(), domoticDevices: [] });
      }
      const entry = ewelinkMap.get(email)!;
      if (!entry.sites.has(row.siteId)) {
        entry.sites.set(row.siteId, {
          siteId: row.siteId,
          siteName: row.siteName,
          siteSlug: row.siteSlug ?? '',
        });
      }
    }

    // Attach domotic devices to eWeLink accounts by site overlap
    for (const [_email, entry] of ewelinkMap) {
      const siteIds = new Set(entry.sites.keys());
      for (const d of domoticRows) {
        if (siteIds.has(d.siteId)) {
          entry.domoticDevices.push({
            deviceId: d.id,
            deviceName: d.name,
            appId: d.appId ?? '',
            appName: d.appName ?? '',
            siteSlug: d.siteSlug ?? '',
          });
        }
      }
    }

    const ewelinkAccounts: EwelinkAccountEntry[] = [];
    for (const [email, entry] of ewelinkMap) {
      const siteList = Array.from(entry.sites.values());
      const risk = calculateRisk(siteList.length);
      ewelinkAccounts.push({
        email,
        sites: siteList,
        domoticDevices: entry.domoticDevices,
        riskLevel: risk,
        recommendation:
          siteList.length > 3
            ? `Segregar cuenta ${email} en ${Math.ceil(siteList.length / 3)} cuentas para reducir riesgo`
            : 'Cuenta con nivel de riesgo aceptable',
      });
    }

    // ── Group Hik-Connect accounts by email ──
    const hikMap = new Map<string, { sites: Map<string, SiteRef>; devices: HikDeviceRef[] }>();

    for (const row of hikAccountRows) {
      const email = (row.username ?? 'unknown').toLowerCase();
      if (!hikMap.has(email)) {
        hikMap.set(email, { sites: new Map(), devices: [] });
      }
      const entry = hikMap.get(email)!;
      if (!entry.sites.has(row.siteId)) {
        entry.sites.set(row.siteId, {
          siteId: row.siteId,
          siteName: row.siteName,
          siteSlug: row.siteSlug ?? '',
        });
      }
    }

    // Attach hik devices by site overlap
    for (const [_email, entry] of hikMap) {
      const siteIds = new Set(entry.sites.keys());
      for (const d of hikDeviceRows) {
        if (siteIds.has(d.siteId)) {
          entry.devices.push({
            deviceId: d.id,
            deviceName: d.name,
            serialNumber: d.serialNumber ?? '',
            siteSlug: d.siteSlug ?? '',
          });
        }
      }
    }

    const hikConnectAccounts: HikConnectAccountEntry[] = [];
    for (const [email, entry] of hikMap) {
      const siteList = Array.from(entry.sites.values());
      const risk = calculateRisk(siteList.length);
      hikConnectAccounts.push({
        email,
        sites: siteList,
        connectedDevices: entry.devices,
        riskLevel: risk,
        recommendation:
          siteList.length > 3
            ? `Segregar cuenta ${email} en ${Math.ceil(siteList.length / 3)} cuentas para reducir riesgo`
            : 'Cuenta con nivel de riesgo aceptable',
      });
    }

    // ── Summary ──
    const allRisks = [
      ...ewelinkAccounts.map((a) => a.riskLevel),
      ...hikConnectAccounts.map((a) => a.riskLevel),
    ];

    const recommendations: string[] = [];
    for (const acct of [...ewelinkAccounts, ...hikConnectAccounts]) {
      if (acct.riskLevel === 'high' || acct.riskLevel === 'critical') {
        recommendations.push(acct.recommendation);
      }
    }
    if (recommendations.length === 0 && allRisks.length > 0) {
      recommendations.push('No se requieren acciones inmediatas — las cuentas tienen un nivel de riesgo aceptable');
    }

    const totalDomoticDevices = ewelinkAccounts.reduce((sum, a) => sum + a.domoticDevices.length, 0);
    const totalHikDevices = hikConnectAccounts.reduce((sum, a) => sum + a.connectedDevices.length, 0);

    return {
      ewelinkAccounts,
      hikConnectAccounts,
      summary: {
        totalEwelinkAccounts: ewelinkAccounts.length,
        totalHikConnectAccounts: hikConnectAccounts.length,
        totalDomoticDevices,
        totalHikDevices,
        sharedAccountRisk: allRisks.length > 0 ? worstRisk(allRisks) : 'low',
        recommendations,
      },
    };
  }

  /**
   * Device inventory summary grouped by type, site, and status.
   */
  async getDeviceInventorySummary(
    database: typeof defaultDb,
    tenantId: string,
  ): Promise<DeviceInventorySummary> {
    // Total count
    const [totalRow] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(devices)
      .where(eq(devices.tenantId, tenantId));

    const totalDevices = totalRow?.count ?? 0;

    // By type
    const byTypeRows = await database
      .select({
        type: devices.type,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(eq(devices.tenantId, tenantId))
      .groupBy(devices.type)
      .orderBy(sql`count(*) desc`);

    // By site
    const bySiteRows = await database
      .select({
        siteId: devices.siteId,
        siteName: sites.name,
        siteSlug: sites.slug,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .innerJoin(sites, eq(devices.siteId, sites.id))
      .where(eq(devices.tenantId, tenantId))
      .groupBy(devices.siteId, sites.name, sites.slug)
      .orderBy(sql`count(*) desc`);

    // By status
    const byStatusRows = await database
      .select({
        status: devices.status,
        count: sql<number>`count(*)::int`,
      })
      .from(devices)
      .where(eq(devices.tenantId, tenantId))
      .groupBy(devices.status)
      .orderBy(sql`count(*) desc`);

    return {
      totalDevices,
      byType: byTypeRows.map((r) => ({ type: r.type, count: r.count })),
      bySite: bySiteRows.map((r) => ({
        siteId: r.siteId,
        siteName: r.siteName,
        siteSlug: r.siteSlug ?? '',
        deviceCount: r.count,
      })),
      byStatus: byStatusRows.map((r) => ({ status: r.status, count: r.count })),
    };
  }

  /**
   * List all devices with status 'pending_configuration' and their missing fields.
   */
  async getPendingDevices(
    database: typeof defaultDb,
    tenantId: string,
  ): Promise<PendingDevice[]> {
    const rows = await database
      .select({
        id: devices.id,
        name: devices.name,
        type: devices.type,
        siteId: devices.siteId,
        siteName: sites.name,
        siteSlug: sites.slug,
        status: devices.status,
        missingFields: devices.missingFields,
        createdAt: devices.createdAt,
      })
      .from(devices)
      .innerJoin(sites, eq(devices.siteId, sites.id))
      .where(
        and(
          eq(devices.tenantId, tenantId),
          eq(devices.status, 'pending_configuration'),
        ),
      )
      .orderBy(devices.createdAt);

    return rows.map((r) => ({
      deviceId: r.id,
      deviceName: r.name,
      type: r.type,
      siteId: r.siteId,
      siteName: r.siteName,
      siteSlug: r.siteSlug ?? '',
      status: r.status,
      missingFields: r.missingFields,
      createdAt: r.createdAt,
    }));
  }
}

export const cloudAccountService = new CloudAccountService();
