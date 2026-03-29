import { createLogger } from '@aion/common-utils';
import { db } from '../../db/client.js';
import { sql } from 'drizzle-orm';

const logger = createLogger({ name: 'internal-agent' });

interface AgentReport {
  module: string;
  status: 'healthy' | 'warning' | 'critical';
  score: number; // 0-100
  findings: string[];
  timestamp: string;
}

export interface ProactiveAlert {
  type: 'unresolved_critical' | 'device_offline' | 'volume_spike';
  message: string;
  severity: 'high' | 'medium' | 'low';
  count: number;
}

export interface Prediction {
  type: 'peak_hour';
  message: string;
  confidence: number;
  data: Record<string, unknown>;
}

export class InternalAgentService {
  private intervalId: NodeJS.Timeout | null = null;
  private proactiveIntervalId: NodeJS.Timeout | null = null;
  private reports: AgentReport[] = [];
  private proactiveAlerts: ProactiveAlert[] = [];

  async start(intervalMs = 300000) { // 5 minutes default
    logger.info({ interval: intervalMs }, 'Internal agent started');
    // Run immediately on start
    await this.runHealthCheck();
    await this.runProactiveAnalysis();
    // Then on interval
    this.intervalId = setInterval(() => this.runHealthCheck(), intervalMs);
    this.proactiveIntervalId = setInterval(() => this.runProactiveAnalysis(), intervalMs);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.proactiveIntervalId) clearInterval(this.proactiveIntervalId);
    logger.info('Internal agent stopped');
  }

  async runHealthCheck(): Promise<AgentReport[]> {
    const reports: AgentReport[] = [];

    try {
      // Check each module
      reports.push(await this.checkDevices());
      reports.push(await this.checkEvents());
      reports.push(await this.checkSites());
      reports.push(await this.checkDatabase());
      reports.push(await this.checkAuth());
      reports.push(await this.checkAlerts());

      this.reports = reports;

      // Log summary
      const critical = reports.filter(r => r.status === 'critical').length;
      const warnings = reports.filter(r => r.status === 'warning').length;
      const avgScore = Math.round(reports.reduce((s, r) => s + r.score, 0) / reports.length);

      logger.info({
        modules: reports.length, critical, warnings, avgScore,
      }, 'Health check complete');

      // Auto-create alert for critical findings
      if (critical > 0) {
        const criticalFindings = reports
          .filter(r => r.status === 'critical')
          .flatMap(r => r.findings);
        logger.warn({ findings: criticalFindings }, 'Critical findings detected');
      }
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Health check failed');
    }

    return reports;
  }

  getLatestReports(): AgentReport[] {
    return this.reports;
  }

  getOverallScore(): number {
    if (this.reports.length === 0) return 0;
    return Math.round(this.reports.reduce((s, r) => s + r.score, 0) / this.reports.length);
  }

  async runProactiveAnalysis(): Promise<ProactiveAlert[]> {
    const alerts: ProactiveAlert[] = [];

    try {
      // 1. Unresolved critical events > 15 min
      const criticals = await db.execute(sql`
        SELECT count(*) as cnt FROM events
        WHERE tenant_id IS NOT NULL AND status = 'new' AND severity IN ('critical', 'high')
        AND created_at < NOW() - INTERVAL '15 minutes'
      `);
      const critCount = parseInt((criticals as unknown as Record<string, unknown>[])[0]?.cnt as string || '0');
      if (critCount > 0) {
        alerts.push({ type: 'unresolved_critical', message: `${critCount} eventos criticos sin atender por mas de 15 minutos`, severity: 'high', count: critCount });
      }

      // 2. Recently offline devices
      const offline = await db.execute(sql`
        SELECT count(*) as cnt FROM devices
        WHERE status = 'offline' AND updated_at > NOW() - INTERVAL '5 minutes'
      `);
      const offCount = parseInt((offline as unknown as Record<string, unknown>[])[0]?.cnt as string || '0');
      if (offCount > 0) {
        alerts.push({ type: 'device_offline', message: `${offCount} dispositivos se desconectaron en los ultimos 5 minutos`, severity: 'medium', count: offCount });
      }

      // 3. Event volume spike (>3x normal)
      const recent = await db.execute(sql`
        SELECT count(*) as cnt FROM events WHERE created_at > NOW() - INTERVAL '1 hour'
      `);
      const baseline = await db.execute(sql`
        SELECT count(*)::float / 24 as avg FROM events WHERE created_at > NOW() - INTERVAL '24 hours'
      `);
      const recentCount = parseInt((recent as unknown as Record<string, unknown>[])[0]?.cnt as string || '0');
      const avgCount = parseFloat((baseline as unknown as Record<string, unknown>[])[0]?.avg as string || '1');
      if (recentCount > avgCount * 3 && recentCount > 5) {
        alerts.push({ type: 'volume_spike', message: `Volumen de eventos ${Math.round(recentCount / avgCount)}x por encima del promedio`, severity: 'high', count: recentCount });
      }

      this.proactiveAlerts = alerts;

      if (alerts.length > 0) {
        logger.info({ alertCount: alerts.length }, 'Proactive analysis found anomalies');
      }
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Proactive analysis failed');
    }
    return alerts;
  }

  getProactiveAlerts(): ProactiveAlert[] {
    return this.proactiveAlerts;
  }

  async getPredictions(): Promise<Prediction[]> {
    const predictions: Prediction[] = [];

    try {
      // Predict based on day-of-week patterns
      const dayOfWeek = new Date().getDay();
      const historicalForDay = await db.execute(sql`
        SELECT EXTRACT(HOUR FROM created_at) as hour, count(*) as cnt, avg(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_ratio
        FROM events
        WHERE EXTRACT(DOW FROM created_at) = ${dayOfWeek}
        AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `);

      const rows = historicalForDay as unknown as Record<string, unknown>[];
      const currentHour = new Date().getHours();
      const upcomingPeak = rows.find(r => parseInt(r.hour as string) > currentHour && parseInt(r.cnt as string) > 10);
      if (upcomingPeak) {
        predictions.push({
          type: 'peak_hour',
          message: `Se espera pico de actividad a las ${upcomingPeak.hour as string}:00 (basado en patron de 30 dias)`,
          confidence: 0.75,
          data: upcomingPeak,
        });
      }
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Predictions analysis failed');
    }

    return predictions;
  }

  private async checkDevices(): Promise<AgentReport> {
    const findings: string[] = [];
    let score = 100;
    try {
      const result = await db.execute(sql`SELECT
        count(*) as total,
        count(*) FILTER (WHERE status = 'online' OR status = 'active') as online,
        count(*) FILTER (WHERE status = 'offline') as offline,
        count(*) FILTER (WHERE last_seen < NOW() - INTERVAL '1 hour') as stale
      FROM devices WHERE tenant_id IS NOT NULL`);

      const row = (result as unknown as Record<string, string>[])[0] ?? {};
      const totalNum = parseInt(row.total || '0');
      const offlineNum = parseInt(row.offline || '0');
      const staleNum = parseInt(row.stale || '0');

      if (totalNum === 0) {
        findings.push('No devices registered');
        score = 50;
      }
      if (offlineNum > 0) {
        findings.push(`${offlineNum} devices offline`);
        score -= Math.min(30, offlineNum * 5);
      }
      if (staleNum > 0) {
        findings.push(`${staleNum} devices not seen in 1+ hours`);
        score -= Math.min(20, staleNum * 3);
      }
      if (findings.length === 0) findings.push('All devices healthy');
    } catch (err) {
      findings.push(`DB error: ${(err as Error).message}`);
      score = 0;
    }
    return {
      module: 'devices',
      status: score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical',
      score: Math.max(0, score),
      findings,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkEvents(): Promise<AgentReport> {
    const findings: string[] = [];
    let score = 100;
    try {
      const result = await db.execute(sql`SELECT
        count(*) FILTER (WHERE status = 'new' AND severity IN ('critical', 'high')) as unresolved_critical,
        count(*) FILTER (WHERE status = 'new' AND created_at < NOW() - INTERVAL '30 minutes') as stale_events
      FROM events WHERE tenant_id IS NOT NULL`);

      const row = (result as unknown as Record<string, string>[])[0] ?? {};
      const critNum = parseInt(row.unresolved_critical || '0');
      const staleNum = parseInt(row.stale_events || '0');

      if (critNum > 0) { findings.push(`${critNum} unresolved critical/high events`); score -= critNum * 10; }
      if (staleNum > 0) { findings.push(`${staleNum} events unattended >30min`); score -= staleNum * 5; }
      if (findings.length === 0) findings.push('All events handled');
    } catch {
      score = 100;
      findings.push('Events module OK (no data)');
    }
    return {
      module: 'events',
      status: score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical',
      score: Math.max(0, score),
      findings,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkSites(): Promise<AgentReport> {
    const findings: string[] = [];
    let score = 100;
    try {
      const result = await db.execute(sql`SELECT count(*) as total FROM sites WHERE tenant_id IS NOT NULL`);
      const row = (result as unknown as Record<string, string>[])[0] ?? {};
      const total = parseInt(row.total || '0');
      if (total === 0) { findings.push('No sites configured'); score = 50; }
      else findings.push(`${total} sites registered`);
    } catch {
      findings.push('Sites check skipped');
    }
    return {
      module: 'sites',
      status: score >= 80 ? 'healthy' : 'warning',
      score,
      findings,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<AgentReport> {
    const findings: string[] = [];
    let score = 100;
    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      const latency = Date.now() - start;
      findings.push(`DB latency: ${latency}ms`);
      if (latency > 1000) { score -= 30; findings.push('High latency (>1s)'); }
      else if (latency > 500) { score -= 10; findings.push('Moderate latency (>500ms)'); }
    } catch (err) {
      findings.push(`DB unreachable: ${(err as Error).message}`);
      score = 0;
    }
    return {
      module: 'database',
      status: score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical',
      score: Math.max(0, score),
      findings,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkAuth(): Promise<AgentReport> {
    const findings: string[] = [];
    let score = 100;
    try {
      const result = await db.execute(sql`SELECT count(*) as total FROM profiles WHERE tenant_id IS NOT NULL`);
      const row = (result as unknown as Record<string, string>[])[0] ?? {};
      const total = parseInt(row.total || '0');
      findings.push(`${total} user profiles`);
      if (total === 0) { score = 30; findings.push('No user profiles - auth will fail'); }
    } catch {
      findings.push('Auth check skipped');
      score = 80;
    }
    return {
      module: 'auth',
      status: score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical',
      score,
      findings,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkAlerts(): Promise<AgentReport> {
    const findings: string[] = [];
    let score = 100;
    try {
      const result = await db.execute(sql`SELECT count(*) FILTER (WHERE status = 'active') as active FROM alert_instances WHERE tenant_id IS NOT NULL`);
      const row = (result as unknown as Record<string, string>[])[0] ?? {};
      const active = parseInt(row.active || '0');
      if (active > 0) { findings.push(`${active} active alerts`); score -= Math.min(20, active * 5); }
      else findings.push('No active alerts');
    } catch {
      findings.push('Alerts module OK');
    }
    return {
      module: 'alerts',
      status: score >= 80 ? 'healthy' : 'warning',
      score,
      findings,
      timestamp: new Date().toISOString(),
    };
  }
}

export const internalAgent = new InternalAgentService();
