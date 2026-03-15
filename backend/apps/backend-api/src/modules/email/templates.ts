/**
 * Email HTML Templates — AION Vision Hub
 *
 * All templates follow a consistent design: dark header, card body, footer.
 * Inline styles only (email client compatibility).
 */

const BRAND_BG = '#0a0f1e';
const BRAND_TEXT = '#e2e8f0';
const ACCENT = '#3b82f6';
const BODY_BG = '#f8fafc';

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${BODY_BG};font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;">
  <tr><td style="background:${BRAND_BG};padding:24px 32px;border-radius:8px 8px 0 0;">
    <h1 style="color:${BRAND_TEXT};font-size:18px;margin:0;letter-spacing:0.5px;">AION Vision Hub</h1>
  </td></tr>
  <tr><td style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;">
    ${body}
  </td></tr>
  <tr><td style="padding:16px 32px;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">
      This message was sent by AION Vision Hub. Do not reply to this email.
    </p>
  </td></tr>
</table>
</body>
</html>`;
}

// ── Severity colors ──────────────────────────────────────
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  info: '#6b7280',
};

// ── Event Alert ──────────────────────────────────────────
export function eventAlertTemplate(params: {
  severity: string;
  eventType: string;
  title: string;
  description: string;
  deviceName?: string;
  siteName?: string;
  timestamp: string;
  snapshotUrl?: string;
}): { subject: string; html: string; text: string } {
  const color = SEVERITY_COLORS[params.severity] || '#6b7280';
  const ts = new Date(params.timestamp).toLocaleString('es-ES', { timeZone: 'America/Bogota' });

  const html = layout(
    `[${params.severity.toUpperCase()}] ${params.title}`,
    `<div style="display:inline-block;background:${color};color:#fff;padding:4px 14px;border-radius:4px;font-size:12px;text-transform:uppercase;font-weight:700;">
      ${params.severity}
    </div>
    <h2 style="margin:16px 0 8px;font-size:20px;color:#1a1a1a;">${params.title}</h2>
    <p style="color:#4a4a4a;line-height:1.6;">${params.description}</p>
    ${params.snapshotUrl ? `<img src="${params.snapshotUrl}" alt="Snapshot" style="width:100%;max-width:560px;border-radius:6px;margin:16px 0;" />` : ''}
    <table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666;width:120px;">Event Type</td><td style="padding:10px;border-bottom:1px solid #eee;">${params.eventType}</td></tr>
      ${params.deviceName ? `<tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666;">Device</td><td style="padding:10px;border-bottom:1px solid #eee;">${params.deviceName}</td></tr>` : ''}
      ${params.siteName ? `<tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666;">Site</td><td style="padding:10px;border-bottom:1px solid #eee;">${params.siteName}</td></tr>` : ''}
      <tr><td style="padding:10px;color:#666;">Time</td><td style="padding:10px;">${ts}</td></tr>
    </table>`,
  );

  const text = `[${params.severity.toUpperCase()}] ${params.title}\n\n${params.description}\n\nEvent: ${params.eventType}\nDevice: ${params.deviceName || 'N/A'}\nSite: ${params.siteName || 'N/A'}\nTime: ${ts}`;

  return {
    subject: `[${params.severity.toUpperCase()}] ${params.title} — AION Vision Hub`,
    html,
    text,
  };
}

// ── Incident Report ──────────────────────────────────────
export function incidentReportTemplate(params: {
  incidentId: string;
  title: string;
  status: string;
  priority: string;
  summary: string;
  assignedTo?: string;
  eventsCount?: number;
  createdAt: string;
}): { subject: string; html: string; text: string } {
  const ts = new Date(params.createdAt).toLocaleString('es-ES', { timeZone: 'America/Bogota' });

  const html = layout(
    `Incident Report: ${params.title}`,
    `<h2 style="margin:0 0 8px;font-size:20px;color:#1a1a1a;">${params.title}</h2>
    <p style="color:#666;margin:0 0 20px;">Incident #${params.incidentId.slice(0, 8)}</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666;width:120px;">Status</td><td style="padding:10px;border-bottom:1px solid #eee;text-transform:capitalize;font-weight:600;">${params.status}</td></tr>
      <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666;">Priority</td><td style="padding:10px;border-bottom:1px solid #eee;text-transform:capitalize;">${params.priority}</td></tr>
      ${params.assignedTo ? `<tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666;">Assigned To</td><td style="padding:10px;border-bottom:1px solid #eee;">${params.assignedTo}</td></tr>` : ''}
      ${params.eventsCount !== undefined ? `<tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666;">Related Events</td><td style="padding:10px;border-bottom:1px solid #eee;">${params.eventsCount}</td></tr>` : ''}
      <tr><td style="padding:10px;color:#666;">Created</td><td style="padding:10px;">${ts}</td></tr>
    </table>
    <h3 style="font-size:14px;color:#333;margin:24px 0 8px;">Summary</h3>
    <p style="color:#4a4a4a;line-height:1.6;">${params.summary}</p>`,
  );

  const text = `Incident Report: ${params.title}\nID: ${params.incidentId.slice(0, 8)}\nStatus: ${params.status}\nPriority: ${params.priority}\nCreated: ${ts}\n\n${params.summary}`;

  return {
    subject: `[Incident ${params.status.toUpperCase()}] ${params.title} — AION Vision Hub`,
    html,
    text,
  };
}

// ── Daily/Periodic Report ────────────────────────────────
export function periodicReportTemplate(params: {
  reportName: string;
  period: string;
  totalEvents: number;
  criticalEvents: number;
  activeIncidents: number;
  devicesOnline: number;
  devicesTotal: number;
  topEventTypes: Array<{ type: string; count: number }>;
  generatedAt: string;
}): { subject: string; html: string; text: string } {
  const ts = new Date(params.generatedAt).toLocaleString('es-ES', { timeZone: 'America/Bogota' });

  const topEventsRows = params.topEventTypes
    .slice(0, 5)
    .map(
      (e) =>
        `<tr><td style="padding:8px 10px;border-bottom:1px solid #eee;">${e.type}</td><td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${e.count}</td></tr>`,
    )
    .join('');

  const html = layout(
    `${params.reportName} — ${params.period}`,
    `<h2 style="margin:0 0 4px;font-size:20px;color:#1a1a1a;">${params.reportName}</h2>
    <p style="color:#666;margin:0 0 24px;">Period: ${params.period} &mdash; Generated: ${ts}</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        <td style="padding:16px;background:#f0f9ff;border-radius:6px;text-align:center;width:25%;">
          <div style="font-size:28px;font-weight:700;color:${ACCENT};">${params.totalEvents}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">Total Events</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:16px;background:#fef2f2;border-radius:6px;text-align:center;width:25%;">
          <div style="font-size:28px;font-weight:700;color:#dc2626;">${params.criticalEvents}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">Critical</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:16px;background:#fffbeb;border-radius:6px;text-align:center;width:25%;">
          <div style="font-size:28px;font-weight:700;color:#f59e0b;">${params.activeIncidents}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">Open Incidents</div>
        </td>
        <td style="width:8px;"></td>
        <td style="padding:16px;background:#f0fdf4;border-radius:6px;text-align:center;width:25%;">
          <div style="font-size:28px;font-weight:700;color:#16a34a;">${params.devicesOnline}/${params.devicesTotal}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">Devices Online</div>
        </td>
      </tr>
    </table>

    ${
      topEventsRows
        ? `<h3 style="font-size:14px;color:#333;margin:0 0 8px;">Top Event Types</h3>
    <table style="width:100%;border-collapse:collapse;">
      <tr><th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:12px;color:#666;">Type</th><th style="padding:8px 10px;text-align:right;border-bottom:2px solid #e2e8f0;font-size:12px;color:#666;">Count</th></tr>
      ${topEventsRows}
    </table>`
        : ''
    }`,
  );

  const text = `${params.reportName} — ${params.period}\nGenerated: ${ts}\n\nTotal Events: ${params.totalEvents}\nCritical: ${params.criticalEvents}\nOpen Incidents: ${params.activeIncidents}\nDevices Online: ${params.devicesOnline}/${params.devicesTotal}`;

  return {
    subject: `${params.reportName} (${params.period}) — AION Vision Hub`,
    html,
    text,
  };
}

// ── Evidence / Playback Package ──────────────────────────
export function evidencePackageTemplate(params: {
  eventId: string;
  eventType: string;
  title: string;
  description: string;
  deviceName: string;
  siteName: string;
  timestamp: string;
  hasSnapshot: boolean;
  hasPlaybackClip: boolean;
  recipientName?: string;
  exportedBy: string;
}): { subject: string; html: string; text: string } {
  const ts = new Date(params.timestamp).toLocaleString('es-ES', { timeZone: 'America/Bogota' });

  const attachmentsList: string[] = [];
  if (params.hasSnapshot) attachmentsList.push('Snapshot image (attached)');
  if (params.hasPlaybackClip) attachmentsList.push('Playback clip (attached)');

  const html = layout(
    `Evidence Package: ${params.title}`,
    `<div style="background:#eff6ff;border-left:4px solid ${ACCENT};padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:20px;">
      <strong style="color:${ACCENT};">Evidence Package</strong>
      <span style="color:#4a4a4a;"> — Exported by ${params.exportedBy}</span>
    </div>
    ${params.recipientName ? `<p style="color:#4a4a4a;">Dear ${params.recipientName},</p>` : ''}
    <p style="color:#4a4a4a;line-height:1.6;">Please find attached the evidence package for the following event:</p>
    <h2 style="margin:16px 0 8px;font-size:18px;color:#1a1a1a;">${params.title}</h2>
    <p style="color:#4a4a4a;line-height:1.6;">${params.description}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666;width:120px;">Event ID</td><td style="padding:10px;border-bottom:1px solid #eee;font-family:monospace;">${params.eventId.slice(0, 8)}</td></tr>
      <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666;">Event Type</td><td style="padding:10px;border-bottom:1px solid #eee;">${params.eventType}</td></tr>
      <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666;">Device</td><td style="padding:10px;border-bottom:1px solid #eee;">${params.deviceName}</td></tr>
      <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#666;">Site</td><td style="padding:10px;border-bottom:1px solid #eee;">${params.siteName}</td></tr>
      <tr><td style="padding:10px;color:#666;">Timestamp</td><td style="padding:10px;">${ts}</td></tr>
    </table>
    ${
      attachmentsList.length
        ? `<h3 style="font-size:14px;color:#333;margin:20px 0 8px;">Attachments</h3>
    <ul style="color:#4a4a4a;line-height:1.8;">
      ${attachmentsList.map((a) => `<li>${a}</li>`).join('')}
    </ul>`
        : ''
    }
    <p style="color:#94a3b8;font-size:12px;margin-top:24px;">This evidence package is confidential. Handle in accordance with your organization's data retention policies.</p>`,
  );

  const text = `Evidence Package: ${params.title}\n\nEvent ID: ${params.eventId.slice(0, 8)}\nType: ${params.eventType}\nDevice: ${params.deviceName}\nSite: ${params.siteName}\nTime: ${ts}\nExported by: ${params.exportedBy}\n\n${params.description}\n\nAttachments: ${attachmentsList.join(', ') || 'None'}`;

  return {
    subject: `Evidence Package: ${params.title} [${params.eventId.slice(0, 8)}] — AION Vision Hub`,
    html,
    text,
  };
}

// ── Test / Verification Email ────────────────────────────
export function testEmailTemplate(): { subject: string; html: string; text: string } {
  const ts = new Date().toISOString();
  const html = layout(
    'Email Configuration Test',
    `<div style="text-align:center;padding:20px 0;">
      <div style="display:inline-block;background:#f0fdf4;border-radius:50%;padding:16px;margin-bottom:16px;">
        <span style="font-size:32px;">&#10003;</span>
      </div>
      <h2 style="margin:0 0 8px;font-size:20px;color:#16a34a;">Email Connected Successfully</h2>
      <p style="color:#4a4a4a;">Your AION Vision Hub email integration is working correctly.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:16px;">Test sent at ${ts}</p>
    </div>`,
  );

  return {
    subject: 'AION Vision Hub — Email Configuration Test',
    html,
    text: `Email Configuration Test\n\nYour AION Vision Hub email integration is working correctly.\nTest sent at ${ts}`,
  };
}
