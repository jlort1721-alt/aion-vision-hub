// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Cross-Site API Service
// Provides aggregated stats across all sites for the
// cross-site dashboard view.
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────

export interface CrossSiteStats {
  totalDevices: number;
  devicesOnline: number;
  totalEvents24h: number;
  criticalEvents24h: number;
  activeIncidents: number;
  totalSites: number;
  sitesHealthy: number;
}

export interface SiteComparison {
  id: string;
  name: string;
  devicesOnline: number;
  devicesTotal: number;
  events24h: number;
  activeIncidents: number;
  riskScore: number;
  status: string;
}

// ── API calls ────────────────────────────────────────────

/**
 * Fetch aggregated dashboard stats across ALL sites (no site filter).
 * Falls back to client-side aggregation when the backend endpoint
 * does not support cross-site mode.
 */
export async function getCrossSiteStats(): Promise<CrossSiteStats> {
  try {
    const response = await apiClient.get<{ data: any }>('/analytics/dashboard', { scope: 'all' });
    const d = response?.data ?? response;

    return {
      totalDevices: d.totalDevices ?? d.total_devices ?? 0,
      devicesOnline: d.devicesOnline ?? d.devices_online ?? 0,
      totalEvents24h: d.totalEvents24h ?? d.total_events_24h ?? 0,
      criticalEvents24h: d.criticalEvents24h ?? d.critical_events_24h ?? 0,
      activeIncidents: d.activeIncidents ?? d.active_incidents ?? 0,
      totalSites: d.totalSites ?? d.total_sites ?? 0,
      sitesHealthy: d.sitesHealthy ?? d.sites_healthy ?? 0,
    };
  } catch {
    // Fallback: aggregate from individual endpoints
    const [devicesRes, eventsRes, incidentsRes, sitesRes] = await Promise.allSettled([
      apiClient.get<{ data: any[] }>('/devices', { limit: '1000' }),
      apiClient.get<{ data: any[] }>('/events', { limit: '500' }),
      apiClient.get<{ data: any[] }>('/incidents', { limit: '200' }),
      apiClient.get<{ data: any[] }>('/sites'),
    ]);

    const devices = devicesRes.status === 'fulfilled'
      ? (devicesRes.value?.data ?? devicesRes.value ?? [])
      : [];
    const events = eventsRes.status === 'fulfilled'
      ? (eventsRes.value?.data ?? eventsRes.value ?? [])
      : [];
    const incidents = incidentsRes.status === 'fulfilled'
      ? (incidentsRes.value?.data ?? incidentsRes.value ?? [])
      : [];
    const sites = sitesRes.status === 'fulfilled'
      ? (sitesRes.value?.data ?? sitesRes.value ?? [])
      : [];

    const devArr = Array.isArray(devices) ? devices : [];
    const evtArr = Array.isArray(events) ? events : [];
    const incArr = Array.isArray(incidents) ? incidents : [];
    const siteArr = Array.isArray(sites) ? sites : [];

    const now = Date.now();
    const h24 = 24 * 60 * 60 * 1000;
    const recent = evtArr.filter((e: any) => {
      const ts = new Date(e.created_at).getTime();
      return !isNaN(ts) && now - ts < h24;
    });

    return {
      totalDevices: devArr.length,
      devicesOnline: devArr.filter((d: any) => d.status === 'online').length,
      totalEvents24h: recent.length,
      criticalEvents24h: recent.filter((e: any) => e.severity === 'critical' || e.severity === 'high').length,
      activeIncidents: incArr.filter((i: any) => i.status === 'open' || i.status === 'investigating').length,
      totalSites: siteArr.length,
      sitesHealthy: siteArr.filter((s: any) => s.status === 'healthy').length,
    };
  }
}

/**
 * Fetch per-site comparison data sorted by risk score (highest first).
 * Falls back to client-side computation.
 */
export async function getSiteComparison(): Promise<SiteComparison[]> {
  try {
    const response = await apiClient.get<{ data: any[] }>('/analytics/risk-score', { scope: 'all' });
    const items = response?.data ?? response ?? [];

    if (Array.isArray(items) && items.length > 0 && items[0].riskScore != null) {
      return items
        .map((s: any) => ({
          id: s.id ?? s.site_id ?? '',
          name: s.name ?? s.site_name ?? 'Unknown',
          devicesOnline: s.devicesOnline ?? s.devices_online ?? 0,
          devicesTotal: s.devicesTotal ?? s.devices_total ?? 0,
          events24h: s.events24h ?? s.events_24h ?? 0,
          activeIncidents: s.activeIncidents ?? s.active_incidents ?? 0,
          riskScore: s.riskScore ?? s.risk_score ?? 0,
          status: s.status ?? 'unknown',
        }))
        .sort((a: SiteComparison, b: SiteComparison) => b.riskScore - a.riskScore);
    }
    // If the response shape doesn't match, fall through to client-side
    throw new Error('Unexpected response shape');
  } catch {
    // Client-side aggregation fallback
    const [sitesRes, devicesRes, eventsRes, incidentsRes] = await Promise.allSettled([
      apiClient.get<{ data: any[] }>('/sites'),
      apiClient.get<{ data: any[] }>('/devices', { limit: '1000' }),
      apiClient.get<{ data: any[] }>('/events', { limit: '500' }),
      apiClient.get<{ data: any[] }>('/incidents', { limit: '200' }),
    ]);

    const sites = sitesRes.status === 'fulfilled'
      ? (Array.isArray(sitesRes.value?.data) ? sitesRes.value.data : Array.isArray(sitesRes.value) ? sitesRes.value : [])
      : [];
    const devices = devicesRes.status === 'fulfilled'
      ? (Array.isArray(devicesRes.value?.data) ? devicesRes.value.data : Array.isArray(devicesRes.value) ? devicesRes.value : [])
      : [];
    const events = eventsRes.status === 'fulfilled'
      ? (Array.isArray(eventsRes.value?.data) ? eventsRes.value.data : Array.isArray(eventsRes.value) ? eventsRes.value : [])
      : [];
    const incidents = incidentsRes.status === 'fulfilled'
      ? (Array.isArray(incidentsRes.value?.data) ? incidentsRes.value.data : Array.isArray(incidentsRes.value) ? incidentsRes.value : [])
      : [];

    const now = Date.now();
    const h24 = 24 * 60 * 60 * 1000;

    return sites
      .map((site: any) => {
        const siteDevices = devices.filter((d: any) => d.site_id === site.id);
        const siteEvents = events.filter((e: any) => {
          if (e.site_id !== site.id) return false;
          const ts = new Date(e.created_at).getTime();
          return !isNaN(ts) && now - ts < h24;
        });
        const siteIncidents = incidents.filter(
          (i: any) => i.site_id === site.id && (i.status === 'open' || i.status === 'investigating'),
        );

        // Simple risk score: weighted sum of critical events, incidents, offline devices
        const criticalCount = siteEvents.filter(
          (e: any) => e.severity === 'critical' || e.severity === 'high',
        ).length;
        const offlineDevices = siteDevices.filter((d: any) => d.status === 'offline').length;
        const riskScore = Math.min(
          100,
          criticalCount * 15 + siteIncidents.length * 20 + offlineDevices * 10,
        );

        return {
          id: site.id,
          name: site.name ?? 'Unknown',
          devicesOnline: siteDevices.filter((d: any) => d.status === 'online').length,
          devicesTotal: siteDevices.length,
          events24h: siteEvents.length,
          activeIncidents: siteIncidents.length,
          riskScore,
          status: site.status ?? 'unknown',
        };
      })
      .sort((a: SiteComparison, b: SiteComparison) => b.riskScore - a.riskScore);
  }
}
