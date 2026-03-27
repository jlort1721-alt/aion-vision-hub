/**
 * Anomaly Detection Service
 * Detects unusual patterns in security events, device behavior, and access patterns.
 * Compares current state against learned baselines to flag anomalies.
 */

import { eq, and, gte, sql, count } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { events, devices, accessLogs, incidents } from '../../db/schema/index.js';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'anomaly-detection' });

export interface Anomaly {
  type: 'time_anomaly' | 'volume_anomaly' | 'device_anomaly' | 'access_anomaly' | 'pattern_anomaly';
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  description: string;
  deviceId?: string;
  siteId?: string;
  confidence: number;
  suggestedAction: string;
  detectedAt: string;
  metadata?: Record<string, unknown>;
}

interface BaselineStats {
  avgEventsPerHour: number;
  avgDeviceOnlineRatio: number;
  peakHours: number[];
  quietHours: number[];
  avgAccessesPerDay: number;
  computedAt: string;
}

// In-memory baseline cache per tenant
const baselineCache = new Map<string, { stats: BaselineStats; computedAt: number }>();
const BASELINE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function buildBaseline(tenantId: string, days = 30): Promise<BaselineStats> {
  logger.info({ tenantId, days }, 'Building anomaly detection baseline');

  const since = new Date();
  since.setDate(since.getDate() - days);

  // Average events per hour
  const eventCounts = await db
    .select({ cnt: count() })
    .from(events)
    .where(and(eq(events.tenantId, tenantId), gte(events.createdAt, since)));

  const totalEvents = eventCounts[0]?.cnt || 0;
  const totalHours = days * 24;
  const avgEventsPerHour = totalHours > 0 ? totalEvents / totalHours : 0;

  // Device online ratio
  const deviceStats = await db
    .select({
      total: count(),
      online: sql<number>`COUNT(*) FILTER (WHERE ${devices.status} = 'online')`,
    })
    .from(devices)
    .where(eq(devices.tenantId, tenantId));

  const totalDevices = deviceStats[0]?.total || 1;
  const onlineDevices = deviceStats[0]?.online || 0;
  const avgDeviceOnlineRatio = onlineDevices / totalDevices;

  // Access patterns
  const accessCounts = await db
    .select({ cnt: count() })
    .from(accessLogs)
    .where(and(eq(accessLogs.tenantId, tenantId), gte(accessLogs.createdAt, since)));

  const totalAccesses = accessCounts[0]?.cnt || 0;
  const avgAccessesPerDay = days > 0 ? totalAccesses / days : 0;

  // Peak/quiet hours (simplified: 8am-8pm peak, rest quiet)
  const peakHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const quietHours = [0, 1, 2, 3, 4, 5, 6, 23];

  const stats: BaselineStats = {
    avgEventsPerHour,
    avgDeviceOnlineRatio,
    peakHours,
    quietHours,
    avgAccessesPerDay,
    computedAt: new Date().toISOString(),
  };

  baselineCache.set(tenantId, { stats, computedAt: Date.now() });
  logger.info({ tenantId, stats }, 'Baseline computed');

  return stats;
}

export async function getBaseline(tenantId: string): Promise<BaselineStats> {
  const cached = baselineCache.get(tenantId);
  if (cached && Date.now() - cached.computedAt < BASELINE_TTL_MS) {
    return cached.stats;
  }
  return buildBaseline(tenantId);
}

export async function detectAnomalies(tenantId: string): Promise<Anomaly[]> {
  logger.info({ tenantId }, 'Running anomaly detection scan');

  const baseline = await getBaseline(tenantId);
  const anomalies: Anomaly[] = [];
  const now = new Date();
  const currentHour = now.getHours();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Volume anomaly: Event spike >3x baseline
  const recentEvents = await db
    .select({ cnt: count() })
    .from(events)
    .where(and(eq(events.tenantId, tenantId), gte(events.createdAt, oneHourAgo)));

  const eventsLastHour = recentEvents[0]?.cnt || 0;
  if (baseline.avgEventsPerHour > 0 && eventsLastHour > baseline.avgEventsPerHour * 3) {
    anomalies.push({
      type: 'volume_anomaly',
      severity: eventsLastHour > baseline.avgEventsPerHour * 5 ? 'critical' : 'high',
      description: `Event spike detected: ${eventsLastHour} events in last hour (baseline: ${Math.round(baseline.avgEventsPerHour)}/hr)`,
      confidence: Math.min(0.95, 0.6 + (eventsLastHour / (baseline.avgEventsPerHour * 10))),
      suggestedAction: 'Review recent events and check for active security incidents',
      detectedAt: now.toISOString(),
      metadata: { eventsLastHour, baselineAvg: baseline.avgEventsPerHour },
    });
  }

  // 2. Device anomaly: Devices going offline rapidly
  const offlineDevices = await db
    .select({ id: devices.id, name: devices.name, status: devices.status, lastSeen: devices.lastSeen })
    .from(devices)
    .where(and(eq(devices.tenantId, tenantId), eq(devices.status, 'offline')));

  const recentlyOffline = offlineDevices.filter(d => {
    if (!d.lastSeen) return false;
    return new Date(d.lastSeen).getTime() > oneHourAgo.getTime();
  });

  if (recentlyOffline.length > 3) {
    anomalies.push({
      type: 'device_anomaly',
      severity: recentlyOffline.length > 10 ? 'critical' : 'high',
      description: `${recentlyOffline.length} devices went offline in the last hour`,
      confidence: 0.85,
      suggestedAction: 'Check network infrastructure — possible network outage or targeted attack',
      detectedAt: now.toISOString(),
      metadata: { offlineCount: recentlyOffline.length, devices: recentlyOffline.map(d => d.name) },
    });
  }

  // 3. Time anomaly: Access events during quiet hours
  if (baseline.quietHours.includes(currentHour)) {
    const quietHourAccess = await db
      .select({ cnt: count() })
      .from(accessLogs)
      .where(and(eq(accessLogs.tenantId, tenantId), gte(accessLogs.createdAt, oneHourAgo)));

    const accessCount = quietHourAccess[0]?.cnt || 0;
    if (accessCount > 5) {
      anomalies.push({
        type: 'time_anomaly',
        severity: accessCount > 15 ? 'high' : 'medium',
        description: `${accessCount} access events during quiet hours (${currentHour}:00)`,
        confidence: 0.75,
        suggestedAction: 'Verify if authorized personnel are on-site or investigate unauthorized access',
        detectedAt: now.toISOString(),
        metadata: { accessCount, hour: currentHour },
      });
    }
  }

  // 4. Pattern anomaly: Repeated access denials
  const deniedAccess = await db
    .select({
      cnt: count(),
    })
    .from(accessLogs)
    .where(
      and(
        eq(accessLogs.tenantId, tenantId),
        gte(accessLogs.createdAt, oneDayAgo),
        eq(accessLogs.direction, 'denied'),
      ),
    );

  const deniedCount = deniedAccess[0]?.cnt || 0;
  if (deniedCount > 10) {
    anomalies.push({
      type: 'access_anomaly',
      severity: deniedCount > 25 ? 'high' : 'medium',
      description: `${deniedCount} access denials in last 24 hours — possible intrusion attempt`,
      confidence: 0.7,
      suggestedAction: 'Review denied access logs and check if any patterns indicate targeted entry attempts',
      detectedAt: now.toISOString(),
      metadata: { deniedCount },
    });
  }

  // 5. Open incidents without activity
  const staleIncidents = await db
    .select({ id: incidents.id, title: incidents.title, createdAt: incidents.createdAt })
    .from(incidents)
    .where(
      and(
        eq(incidents.tenantId, tenantId),
        eq(incidents.status, 'open'),
        gte(incidents.createdAt, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
      ),
    )
    .orderBy(incidents.createdAt);

  if (staleIncidents.length > 5) {
    anomalies.push({
      type: 'pattern_anomaly',
      severity: 'medium',
      description: `${staleIncidents.length} open incidents without resolution in the last 7 days`,
      confidence: 0.6,
      suggestedAction: 'Review and prioritize open incidents — assign operators or escalate',
      detectedAt: now.toISOString(),
      metadata: { staleCount: staleIncidents.length },
    });
  }

  logger.info({ tenantId, anomalyCount: anomalies.length }, 'Anomaly scan complete');
  return anomalies;
}
