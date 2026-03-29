/**
 * MCP Server Tool — Anomaly Detection
 *
 * Provides tools for detecting anomalous patterns in security events
 * and computing baseline statistics for comparison. Uses statistical
 * analysis on event frequency and severity distributions. All
 * operations are tenant-scoped.
 */

import { eq, and, sql, gte } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { events, sites } from '../../../db/schema/index.js';
import type { MCPServerTool } from './index.js';

// ── detect_anomalies ─────────────────────────────────────────

export const detectAnomalies: MCPServerTool = {
  name: 'detect_anomalies',
  description:
    'Run anomaly detection for a specific site or all sites. Compares the last 24 hours of events against the 7-day baseline to identify unusual patterns in event volume and severity distribution.',
  parameters: {
    site_id: {
      type: 'string',
      description: 'Site UUID to analyze. If omitted, analyzes all sites.',
      required: false,
    },
  },
  execute: async (params, context) => {
    try {
      const siteId = params.site_id as string | undefined;
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Build site filter conditions
      const baseConditions = [eq(events.tenantId, context.tenantId)];
      if (siteId) {
        baseConditions.push(eq(events.siteId, siteId));
      }

      // Last 24h stats
      const [recent] = await db
        .select({
          total: sql<number>`count(*)::int`,
          critical: sql<number>`count(*) filter (where ${events.severity} = 'critical')::int`,
          high: sql<number>`count(*) filter (where ${events.severity} = 'high')::int`,
          medium: sql<number>`count(*) filter (where ${events.severity} = 'medium')::int`,
          low: sql<number>`count(*) filter (where ${events.severity} = 'low')::int`,
        })
        .from(events)
        .where(and(...baseConditions, gte(events.createdAt, last24h)));

      // 7-day baseline (daily average)
      const [baseline] = await db
        .select({
          total: sql<number>`count(*)::int`,
          critical: sql<number>`count(*) filter (where ${events.severity} = 'critical')::int`,
          high: sql<number>`count(*) filter (where ${events.severity} = 'high')::int`,
          medium: sql<number>`count(*) filter (where ${events.severity} = 'medium')::int`,
          low: sql<number>`count(*) filter (where ${events.severity} = 'low')::int`,
        })
        .from(events)
        .where(and(...baseConditions, gte(events.createdAt, last7d)));

      const baselineDaily = {
        total: Math.round((baseline?.total ?? 0) / 7),
        critical: Math.round((baseline?.critical ?? 0) / 7),
        high: Math.round((baseline?.high ?? 0) / 7),
        medium: Math.round((baseline?.medium ?? 0) / 7),
        low: Math.round((baseline?.low ?? 0) / 7),
      };

      // Detect anomalies (>2x baseline = anomaly)
      const anomalies: Array<{
        type: string;
        description: string;
        severity: string;
        current: number;
        baseline_daily: number;
        deviation_factor: number;
      }> = [];

      const recentTotal = recent?.total ?? 0;
      const recentCritical = recent?.critical ?? 0;
      const recentHigh = recent?.high ?? 0;

      if (baselineDaily.total > 0 && recentTotal > baselineDaily.total * 2) {
        anomalies.push({
          type: 'volume_spike',
          description: `Event volume (${recentTotal}) is ${(recentTotal / baselineDaily.total).toFixed(1)}x the daily average (${baselineDaily.total})`,
          severity: 'high',
          current: recentTotal,
          baseline_daily: baselineDaily.total,
          deviation_factor: Number((recentTotal / baselineDaily.total).toFixed(2)),
        });
      }

      if (baselineDaily.critical > 0 && recentCritical > baselineDaily.critical * 2) {
        anomalies.push({
          type: 'critical_spike',
          description: `Critical events (${recentCritical}) are ${(recentCritical / baselineDaily.critical).toFixed(1)}x the daily average (${baselineDaily.critical})`,
          severity: 'critical',
          current: recentCritical,
          baseline_daily: baselineDaily.critical,
          deviation_factor: Number((recentCritical / baselineDaily.critical).toFixed(2)),
        });
      }

      if (baselineDaily.high > 0 && recentHigh > baselineDaily.high * 2) {
        anomalies.push({
          type: 'high_severity_spike',
          description: `High-severity events (${recentHigh}) are ${(recentHigh / baselineDaily.high).toFixed(1)}x the daily average (${baselineDaily.high})`,
          severity: 'high',
          current: recentHigh,
          baseline_daily: baselineDaily.high,
          deviation_factor: Number((recentHigh / baselineDaily.high).toFixed(2)),
        });
      }

      // Check for unusual silence (events drop to <25% of baseline)
      if (baselineDaily.total > 10 && recentTotal < baselineDaily.total * 0.25) {
        anomalies.push({
          type: 'unusual_silence',
          description: `Event volume (${recentTotal}) is unusually low compared to daily average (${baselineDaily.total}). Possible sensor or connectivity issue.`,
          severity: 'medium',
          current: recentTotal,
          baseline_daily: baselineDaily.total,
          deviation_factor: baselineDaily.total > 0
            ? Number((recentTotal / baselineDaily.total).toFixed(2))
            : 0,
        });
      }

      // Per-site breakdown when no specific site is given
      let siteSummary: Array<{ site_id: string; site_name: string | null; event_count: number }> = [];
      if (!siteId) {
        const siteBreakdown = await db
          .select({
            siteId: events.siteId,
            siteName: sites.name,
            count: sql<number>`count(*)::int`,
          })
          .from(events)
          .leftJoin(sites, eq(events.siteId, sites.id))
          .where(and(eq(events.tenantId, context.tenantId), gte(events.createdAt, last24h)))
          .groupBy(events.siteId, sites.name)
          .orderBy(sql`count(*) desc`)
          .limit(20);

        siteSummary = siteBreakdown.map((r) => ({
          site_id: r.siteId,
          site_name: r.siteName,
          event_count: r.count,
        }));
      }

      return {
        period: {
          analyzed: 'last_24h',
          baseline: 'last_7d_daily_avg',
        },
        last_24h: {
          total: recentTotal,
          critical: recentCritical,
          high: recentHigh,
          medium: recent?.medium ?? 0,
          low: recent?.low ?? 0,
        },
        baseline_daily_avg: baselineDaily,
        anomalies_detected: anomalies.length,
        anomalies,
        ...(siteSummary.length > 0 ? { site_breakdown: siteSummary } : {}),
        site_filter: siteId ?? 'all',
        generated_at: now.toISOString(),
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to detect anomalies' };
    }
  },
};

// ── get_anomaly_baseline ─────────────────────────────────────

export const getAnomalyBaseline: MCPServerTool = {
  name: 'get_anomaly_baseline',
  description:
    'Get baseline statistics for anomaly comparison including average events per hour, peak hours, and severity distribution over the last 7 days.',
  parameters: {
    site_id: {
      type: 'string',
      description: 'Site UUID to compute baseline for. If omitted, computes for all sites.',
      required: false,
    },
  },
  execute: async (params, context) => {
    try {
      const siteId = params.site_id as string | undefined;
      const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const baseConditions = [
        eq(events.tenantId, context.tenantId),
        gte(events.createdAt, last7d),
      ];
      if (siteId) {
        baseConditions.push(eq(events.siteId, siteId));
      }

      // Overall stats
      const [overall] = await db
        .select({
          total: sql<number>`count(*)::int`,
          critical: sql<number>`count(*) filter (where ${events.severity} = 'critical')::int`,
          high: sql<number>`count(*) filter (where ${events.severity} = 'high')::int`,
          medium: sql<number>`count(*) filter (where ${events.severity} = 'medium')::int`,
          low: sql<number>`count(*) filter (where ${events.severity} = 'low')::int`,
          info: sql<number>`count(*) filter (where ${events.severity} = 'info')::int`,
        })
        .from(events)
        .where(and(...baseConditions));

      // Hourly distribution (0-23)
      const hourlyDist = await db
        .select({
          hour: sql<number>`extract(hour from ${events.createdAt})::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(events)
        .where(and(...baseConditions))
        .groupBy(sql`extract(hour from ${events.createdAt})`)
        .orderBy(sql`extract(hour from ${events.createdAt})`);

      // Find peak hours
      const sortedHours = [...hourlyDist].sort((a, b) => b.count - a.count);
      const peakHours = sortedHours.slice(0, 3).map((h) => ({
        hour: h.hour,
        avg_events: Math.round(h.count / 7),
      }));

      // Daily distribution
      const dailyDist = await db
        .select({
          day: sql<string>`to_char(${events.createdAt}, 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(events)
        .where(and(...baseConditions))
        .groupBy(sql`to_char(${events.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${events.createdAt}, 'YYYY-MM-DD')`);

      // Top event types
      const topEventTypes = await db
        .select({
          eventType: events.eventType,
          count: sql<number>`count(*)::int`,
        })
        .from(events)
        .where(and(...baseConditions))
        .groupBy(events.eventType)
        .orderBy(sql`count(*) desc`)
        .limit(10);

      const totalEvents = overall?.total ?? 0;
      const avgPerHour = Math.round(totalEvents / (7 * 24));
      const avgPerDay = Math.round(totalEvents / 7);

      return {
        period: '7_days',
        total_events: totalEvents,
        averages: {
          per_hour: avgPerHour,
          per_day: avgPerDay,
        },
        severity_distribution: {
          critical: overall?.critical ?? 0,
          high: overall?.high ?? 0,
          medium: overall?.medium ?? 0,
          low: overall?.low ?? 0,
          info: overall?.info ?? 0,
        },
        peak_hours: peakHours,
        daily_counts: dailyDist,
        top_event_types: topEventTypes,
        site_filter: siteId ?? 'all',
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get anomaly baseline' };
    }
  },
};

/** All anomaly detection tools */
export const anomalyTools: MCPServerTool[] = [
  detectAnomalies,
  getAnomalyBaseline,
];
