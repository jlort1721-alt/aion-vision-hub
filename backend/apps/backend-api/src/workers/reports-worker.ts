import { eq, and, lte, sql, count, gte } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { scheduledReports } from '../db/schema/index.js';
import { events } from '../db/schema/events.js';
import { incidents } from '../db/schema/incidents.js';
import { devices } from '../db/schema/devices.js';
import { sites } from '../db/schema/devices.js';
import { emailService } from '../modules/email/service.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKER_TAG = '[reports-worker]';
const DEFAULT_INTERVAL_MS = 900_000; // 15 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScheduledReport {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  schedule: unknown;
  recipients: unknown;
  filters: unknown;
  isActive: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
}

interface EventSummary {
  total: number;
  bySeverity: Record<string, number>;
  byType: Array<{ type: string; count: number }>;
}

interface IncidentSummary {
  total: number;
  open: number;
  resolved: number;
}

interface DeviceHealthSummary {
  total: number;
  online: number;
  offline: number;
  healthPercentage: number;
}

interface SiteActivity {
  siteName: string;
  eventCount: number;
}

// ---------------------------------------------------------------------------
// Helpers — determine period from report type / schedule
// ---------------------------------------------------------------------------

function getFrequencyFromType(type: string): 'daily' | 'weekly' | 'monthly' {
  if (type.includes('daily')) return 'daily';
  if (type.includes('monthly')) return 'monthly';
  return 'weekly'; // default
}

function getPeriodRange(frequency: 'daily' | 'weekly' | 'monthly'): { start: Date; end: Date; label: string } {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  switch (frequency) {
    case 'daily':
      start.setDate(start.getDate() - 1);
      break;
    case 'weekly':
      start.setDate(start.getDate() - 7);
      break;
    case 'monthly':
      start.setDate(start.getDate() - 30);
      break;
  }

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const label = `${fmt(start)} — ${fmt(end)}`;

  return { start, end, label };
}

function computeNextRun(frequency: 'daily' | 'weekly' | 'monthly'): Date {
  const next = new Date();
  switch (frequency) {
    case 'daily':
      next.setTime(next.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'weekly':
      next.setTime(next.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      next.setTime(next.getTime() + 30 * 24 * 60 * 60 * 1000);
      break;
  }
  return next;
}

// ---------------------------------------------------------------------------
// Data queries
// ---------------------------------------------------------------------------

async function queryEventSummary(
  db: Database,
  tenantId: string,
  start: Date,
  end: Date,
): Promise<EventSummary> {
  // Total events
  const totalRows = await db
    .select({ count: count() })
    .from(events)
    .where(
      and(
        eq(events.tenantId, tenantId),
        gte(events.createdAt, start),
        lte(events.createdAt, end),
      ),
    );
  const total = totalRows[0]?.count ?? 0;

  // By severity
  const severityRows = await db
    .select({
      severity: events.severity,
      count: count(),
    })
    .from(events)
    .where(
      and(
        eq(events.tenantId, tenantId),
        gte(events.createdAt, start),
        lte(events.createdAt, end),
      ),
    )
    .groupBy(events.severity);

  const bySeverity: Record<string, number> = {};
  for (const row of severityRows) {
    bySeverity[row.severity] = row.count;
  }

  // By type (top 5)
  const typeRows = await db
    .select({
      type: events.eventType,
      count: count(),
    })
    .from(events)
    .where(
      and(
        eq(events.tenantId, tenantId),
        gte(events.createdAt, start),
        lte(events.createdAt, end),
      ),
    )
    .groupBy(events.eventType)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const byType = typeRows.map((r) => ({ type: r.type, count: r.count }));

  return { total, bySeverity, byType };
}

async function queryIncidentSummary(
  db: Database,
  tenantId: string,
  start: Date,
  end: Date,
): Promise<IncidentSummary> {
  const rows = await db
    .select({
      status: incidents.status,
      count: count(),
    })
    .from(incidents)
    .where(
      and(
        eq(incidents.tenantId, tenantId),
        gte(incidents.createdAt, start),
        lte(incidents.createdAt, end),
      ),
    )
    .groupBy(incidents.status);

  let total = 0;
  let open = 0;
  let resolved = 0;
  for (const row of rows) {
    total += row.count;
    if (row.status === 'open' || row.status === 'in_progress') {
      open += row.count;
    } else if (row.status === 'resolved' || row.status === 'closed') {
      resolved += row.count;
    }
  }

  return { total, open, resolved };
}

async function queryDeviceHealth(
  db: Database,
  tenantId: string,
): Promise<DeviceHealthSummary> {
  const rows = await db
    .select({
      status: devices.status,
      count: count(),
    })
    .from(devices)
    .where(eq(devices.tenantId, tenantId))
    .groupBy(devices.status);

  let total = 0;
  let online = 0;
  let offline = 0;
  for (const row of rows) {
    total += row.count;
    if (row.status === 'online') {
      online += row.count;
    } else if (row.status === 'offline') {
      offline += row.count;
    }
  }

  const healthPercentage = total > 0 ? Math.round((online / total) * 100) : 0;

  return { total, online, offline, healthPercentage };
}

async function queryTopSites(
  db: Database,
  tenantId: string,
  start: Date,
  end: Date,
): Promise<SiteActivity[]> {
  const rows = await db
    .select({
      siteName: sites.name,
      eventCount: count(),
    })
    .from(events)
    .innerJoin(sites, eq(events.siteId, sites.id))
    .where(
      and(
        eq(events.tenantId, tenantId),
        gte(events.createdAt, start),
        lte(events.createdAt, end),
      ),
    )
    .groupBy(sites.name)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  return rows.map((r) => ({ siteName: r.siteName, eventCount: r.eventCount }));
}

// ---------------------------------------------------------------------------
// HTML builder
// ---------------------------------------------------------------------------

function buildReportHtml(params: {
  reportName: string;
  period: string;
  eventSummary: EventSummary;
  incidentSummary: IncidentSummary;
  deviceHealth: DeviceHealthSummary;
  topSites: SiteActivity[];
  topEventTypes: Array<{ type: string; count: number }>;
}): string {
  const { reportName, period, eventSummary, incidentSummary, deviceHealth, topSites, topEventTypes } = params;

  const severityRows = Object.entries(eventSummary.bySeverity)
    .map(([sev, cnt]) => `<tr><td style="padding:4px 12px;text-transform:capitalize;">${sev}</td><td style="padding:4px 12px;text-align:right;">${cnt}</td></tr>`)
    .join('');

  const topSiteRows = topSites
    .map((s, i) => `<tr><td style="padding:4px 12px;">${i + 1}. ${s.siteName}</td><td style="padding:4px 12px;text-align:right;">${s.eventCount}</td></tr>`)
    .join('');

  const topTypeRows = topEventTypes
    .map((t, i) => `<tr><td style="padding:4px 12px;">${i + 1}. ${t.type}</td><td style="padding:4px 12px;text-align:right;">${t.count}</td></tr>`)
    .join('');

  const healthColor = deviceHealth.healthPercentage >= 90 ? '#22c55e' : deviceHealth.healthPercentage >= 70 ? '#f59e0b' : '#ef4444';

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f5;margin:0;padding:20px;">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:#1e293b;color:#fff;padding:24px 32px;">
    <h1 style="margin:0;font-size:20px;">AION Vision Hub</h1>
    <h2 style="margin:8px 0 0;font-size:16px;font-weight:400;opacity:0.9;">${reportName}</h2>
    <p style="margin:8px 0 0;font-size:13px;opacity:0.7;">${period}</p>
  </div>

  <div style="padding:24px 32px;">

    <!-- Device Health -->
    <h3 style="color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">Salud de Dispositivos</h3>
    <div style="display:flex;gap:16px;margin-bottom:16px;">
      <div style="flex:1;text-align:center;padding:12px;background:#f8fafc;border-radius:6px;">
        <div style="font-size:28px;font-weight:700;color:${healthColor};">${deviceHealth.healthPercentage}%</div>
        <div style="font-size:12px;color:#64748b;">En linea</div>
      </div>
      <div style="flex:1;text-align:center;padding:12px;background:#f8fafc;border-radius:6px;">
        <div style="font-size:28px;font-weight:700;color:#1e293b;">${deviceHealth.total}</div>
        <div style="font-size:12px;color:#64748b;">Total</div>
      </div>
      <div style="flex:1;text-align:center;padding:12px;background:#f8fafc;border-radius:6px;">
        <div style="font-size:28px;font-weight:700;color:#22c55e;">${deviceHealth.online}</div>
        <div style="font-size:12px;color:#64748b;">Online</div>
      </div>
      <div style="flex:1;text-align:center;padding:12px;background:#f8fafc;border-radius:6px;">
        <div style="font-size:28px;font-weight:700;color:#ef4444;">${deviceHealth.offline}</div>
        <div style="font-size:12px;color:#64748b;">Offline</div>
      </div>
    </div>

    <!-- Events -->
    <h3 style="color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">Resumen de Eventos</h3>
    <p style="margin:4px 0 12px;"><strong>Total:</strong> ${eventSummary.total}</p>
    ${severityRows ? `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead><tr style="background:#f1f5f9;"><th style="padding:6px 12px;text-align:left;">Severidad</th><th style="padding:6px 12px;text-align:right;">Cantidad</th></tr></thead>
      <tbody>${severityRows}</tbody>
    </table>` : ''}

    <!-- Incidents -->
    <h3 style="color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">Resumen de Incidentes</h3>
    <div style="display:flex;gap:16px;margin-bottom:16px;">
      <div style="flex:1;text-align:center;padding:12px;background:#f8fafc;border-radius:6px;">
        <div style="font-size:24px;font-weight:700;">${incidentSummary.total}</div>
        <div style="font-size:12px;color:#64748b;">Total</div>
      </div>
      <div style="flex:1;text-align:center;padding:12px;background:#fef3c7;border-radius:6px;">
        <div style="font-size:24px;font-weight:700;color:#d97706;">${incidentSummary.open}</div>
        <div style="font-size:12px;color:#92400e;">Abiertos</div>
      </div>
      <div style="flex:1;text-align:center;padding:12px;background:#dcfce7;border-radius:6px;">
        <div style="font-size:24px;font-weight:700;color:#16a34a;">${incidentSummary.resolved}</div>
        <div style="font-size:12px;color:#166534;">Resueltos</div>
      </div>
    </div>

    <!-- Top Sites -->
    ${topSiteRows ? `
    <h3 style="color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">Top 5 Sedes Mas Activas</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead><tr style="background:#f1f5f9;"><th style="padding:6px 12px;text-align:left;">Sede</th><th style="padding:6px 12px;text-align:right;">Eventos</th></tr></thead>
      <tbody>${topSiteRows}</tbody>
    </table>` : ''}

    <!-- Top Event Types -->
    ${topTypeRows ? `
    <h3 style="color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:8px;">Top 5 Tipos de Evento</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead><tr style="background:#f1f5f9;"><th style="padding:6px 12px;text-align:left;">Tipo</th><th style="padding:6px 12px;text-align:right;">Cantidad</th></tr></thead>
      <tbody>${topTypeRows}</tbody>
    </table>` : ''}

  </div>

  <!-- Footer -->
  <div style="background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8;">
    Generado automaticamente por AION Vision Hub &mdash; ${new Date().toISOString()}
  </div>

</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Process a single scheduled report
// ---------------------------------------------------------------------------

async function processReport(db: Database, report: ScheduledReport): Promise<void> {
  const frequency = getFrequencyFromType(report.type);
  const { start, end, label } = getPeriodRange(frequency);

  console.log(`${WORKER_TAG} Processing report "${report.name}" (${report.id}) for period ${label}`);

  // Gather data
  const [eventSummary, incidentSummary, deviceHealth, topSites] = await Promise.all([
    queryEventSummary(db, report.tenantId, start, end),
    queryIncidentSummary(db, report.tenantId, start, end),
    queryDeviceHealth(db, report.tenantId),
    queryTopSites(db, report.tenantId, start, end),
  ]);

  // Build HTML
  const html = buildReportHtml({
    reportName: report.name,
    period: label,
    eventSummary,
    incidentSummary,
    deviceHealth,
    topSites,
    topEventTypes: eventSummary.byType,
  });

  // Resolve recipient emails
  const recipients = report.recipients as Record<string, unknown> | null;
  const recipientEmails: string[] = [];
  if (recipients && Array.isArray(recipients.email)) {
    recipientEmails.push(...recipients.email.filter((e): e is string => typeof e === 'string'));
  }

  if (recipientEmails.length === 0) {
    console.warn(`${WORKER_TAG} Report "${report.name}" has no email recipients — skipping send`);
    return;
  }

  // Send email
  const result = await emailService.sendGeneric({
    to: recipientEmails,
    subject: `${report.name} — ${label}`,
    html,
  });

  if (!result.success) {
    throw new Error(`Email send failed: ${result.error}`);
  }

  console.log(`${WORKER_TAG} Report "${report.name}" sent to ${recipientEmails.join(', ')}`);

  // Update next_run_at and last_run_at
  const nextRunAt = computeNextRun(frequency);

  await db
    .update(scheduledReports)
    .set({
      lastRunAt: new Date(),
      nextRunAt,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(scheduledReports.id, report.id));
}

// ---------------------------------------------------------------------------
// Main tick — find and process all due reports
// ---------------------------------------------------------------------------

async function runReportsTick(db: Database): Promise<void> {
  const now = new Date();

  // Find reports that are due
  const dueReports = await db
    .select()
    .from(scheduledReports)
    .where(
      and(
        eq(scheduledReports.isActive, true),
        lte(scheduledReports.nextRunAt, now),
      ),
    );

  if (dueReports.length === 0) {
    return; // Nothing due — silent return
  }

  console.log(`${WORKER_TAG} Found ${dueReports.length} report(s) due for processing`);

  for (const report of dueReports) {
    try {
      await processReport(db, report as unknown as ScheduledReport);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`${WORKER_TAG} Failed to process report "${report.name}" (${report.id}):`, errorMsg);

      // Persist error but don't crash — move next_run_at forward to avoid retry-storm
      const frequency = getFrequencyFromType(report.type);
      try {
        await db
          .update(scheduledReports)
          .set({
            lastError: errorMsg,
            lastRunAt: new Date(),
            nextRunAt: computeNextRun(frequency),
            updatedAt: new Date(),
          })
          .where(eq(scheduledReports.id, report.id));
      } catch (updateErr) {
        console.error(`${WORKER_TAG} Failed to update error state for report ${report.id}:`, updateErr);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API — start / stop
// ---------------------------------------------------------------------------

let timerHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Start the scheduled reports worker.
 *
 * Checks every 15 minutes for reports whose next_run_at <= NOW().
 */
export function startReportsWorker(
  db: Database,
  interval: number = DEFAULT_INTERVAL_MS,
): () => void {
  if (timerHandle) {
    console.warn(`${WORKER_TAG} Worker already running — skipping duplicate start`);
    return () => stopReportsWorker();
  }

  console.log(`${WORKER_TAG} Starting reports worker (interval: ${interval / 1000}s)`);

  // Run once on start
  runReportsTick(db).catch((err) => {
    console.error(`${WORKER_TAG} Initial tick failed:`, err);
  });

  timerHandle = setInterval(() => {
    runReportsTick(db).catch((err) => {
      console.error(`${WORKER_TAG} Tick failed:`, err);
    });
  }, interval);

  return () => stopReportsWorker();
}

/**
 * Stop the reports worker if running.
 */
export function stopReportsWorker(): void {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
    console.log(`${WORKER_TAG} Worker stopped`);
  }
}
