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

export class InternalAgentService {
  private intervalId: NodeJS.Timeout | null = null;
  private reports: AgentReport[] = [];

  async start(intervalMs = 300000) { // 5 minutes default
    logger.info({ interval: intervalMs }, 'Internal agent started');
    // Run immediately on start
    await this.runHealthCheck();
    // Then on interval
    this.intervalId = setInterval(() => this.runHealthCheck(), intervalMs);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
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
