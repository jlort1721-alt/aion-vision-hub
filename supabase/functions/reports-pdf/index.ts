import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { getCorsHeaders } from "../_shared/cors.ts";
const corsHeaders = getCorsHeaders();

// HTML escape to prevent XSS in report output
function escHtml(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateBarChartSVG(data: { label: string; value: number; color?: string }[], title: string, width = 700, height = 220): string {
  if (!data.length) return '';
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.min(30, (width - 80) / data.length - 4);
  const chartLeft = 50;
  const chartBottom = height - 40;
  const chartTop = 30;
  const chartHeight = chartBottom - chartTop;

  let bars = '';
  data.forEach((d, i) => {
    const x = chartLeft + i * (barWidth + 4) + 2;
    const barH = (d.value / maxVal) * chartHeight;
    const y = chartBottom - barH;
    const color = d.color || '#3b82f6';
    bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${color}" rx="2"/>`;
    if (data.length <= 24) {
      bars += `<text x="${x + barWidth / 2}" y="${chartBottom + 14}" text-anchor="middle" font-size="8" fill="#666">${escHtml(d.label)}</text>`;
    }
  });

  // Y-axis ticks
  let yAxis = '';
  for (let i = 0; i <= 4; i++) {
    const val = Math.round((maxVal / 4) * i);
    const y = chartBottom - (i / 4) * chartHeight;
    yAxis += `<text x="${chartLeft - 8}" y="${y + 3}" text-anchor="end" font-size="9" fill="#999">${val}</text>`;
    yAxis += `<line x1="${chartLeft}" y1="${y}" x2="${width - 10}" y2="${y}" stroke="#e5e7eb" stroke-width="0.5"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <text x="${width / 2}" y="18" text-anchor="middle" font-size="12" font-weight="600" fill="#1a1a2e">${escHtml(title)}</text>
    ${yAxis}${bars}
  </svg>`;
}

function generateDonutSVG(data: { label: string; value: number; color: string }[], title: string, size = 200): string {
  if (!data.length) return '';
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return '';
  const cx = size / 2, cy = size / 2, r = 70, innerR = 45;
  let startAngle = -Math.PI / 2;
  let paths = '';
  let legend = '';

  data.forEach((d, i) => {
    const angle = (d.value / total) * Math.PI * 2;
    const endAngle = startAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle), iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle), iy2 = cy + innerR * Math.sin(startAngle);
    paths += `<path d="M${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} L${ix1},${iy1} A${innerR},${innerR} 0 ${largeArc},0 ${ix2},${iy2} Z" fill="${d.color}"/>`;
    legend += `<rect x="${size + 10}" y="${30 + i * 20}" width="10" height="10" rx="2" fill="${d.color}"/>
      <text x="${size + 26}" y="${39 + i * 20}" font-size="10" fill="#333">${escHtml(d.label)}: ${d.value} (${Math.round(d.value / total * 100)}%)</text>`;
    startAngle = endAngle;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size + 160}" height="${Math.max(size, 30 + data.length * 20)}" viewBox="0 0 ${size + 160} ${Math.max(size, 30 + data.length * 20)}">
    <text x="${cx}" y="14" text-anchor="middle" font-size="12" font-weight="600" fill="#1a1a2e">${escHtml(title)}</text>
    ${paths}
    <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="16" font-weight="700" fill="#1a1a2e">${total}</text>
    ${legend}
  </svg>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = claims.claims.sub as string;
    const url = new URL(req.url);
    const reportType = url.searchParams.get("type") || "summary";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    // Get user's tenant — ensures reports are scoped to their tenant via RLS
    const { data: userTenantId } = await supabase.rpc("get_user_tenant_id", { _user_id: userId });
    const { data: tenant } = userTenantId
      ? await supabase.from("tenants").select("*").eq("id", userTenantId).single()
      : { data: null };
    const tenantName = tenant?.name || "AION Vision Hub";
    const tz = tenant?.timezone || "UTC";

    // Gather all data
    const [{ data: devices = [] }, { data: events = [] }, { data: incidents = [] }, { data: sites = [] }] = await Promise.all([
      supabase.from("devices").select("*").order("name"),
      supabase.from("events").select("*").order("created_at", { ascending: false }),
      supabase.from("incidents").select("*").order("created_at", { ascending: false }),
      supabase.from("sites").select("*").order("name"),
    ]);

    // Filter by date range if provided
    const filterByDate = (items: any[]) => {
      let filtered = items;
      if (from) filtered = filtered.filter(i => i.created_at >= from);
      if (to) filtered = filtered.filter(i => i.created_at <= to);
      return filtered;
    };

    const filteredEvents = filterByDate(events || []);
    const filteredIncidents = filterByDate(incidents || []);

    // Build report-specific content
    let reportTitle = "Platform Summary Report";
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];
    let summaryStats: { label: string; value: string }[] = [];
    let charts = '';

    // ── Events per hour (last 24h) chart ──
    const now = new Date();
    const hoursData: { label: string; value: number; color?: string }[] = [];
    for (let i = 23; i >= 0; i--) {
      const h = new Date(now);
      h.setHours(h.getHours() - i, 0, 0, 0);
      const nextH = new Date(h);
      nextH.setHours(nextH.getHours() + 1);
      const count = (events || []).filter((e: any) => {
        const t = new Date(e.created_at);
        return t >= h && t < nextH;
      }).length;
      hoursData.push({ label: h.toISOString().slice(11, 13), value: count, color: '#3b82f6' });
    }

    // ── Severity distribution ──
    const sevCounts: Record<string, number> = {};
    const sevColors: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', info: '#3b82f6' };
    (filteredEvents).forEach((e: any) => { sevCounts[e.severity] = (sevCounts[e.severity] || 0) + 1; });
    const sevData = Object.entries(sevCounts).map(([label, value]) => ({ label, value, color: sevColors[label] || '#94a3b8' }));

    // ── Device status donut ──
    const devCounts: Record<string, number> = {};
    const devColors: Record<string, string> = { online: '#22c55e', offline: '#ef4444', unknown: '#eab308' };
    (devices || []).forEach((d: any) => { devCounts[d.status] = (devCounts[d.status] || 0) + 1; });
    const devData = Object.entries(devCounts).map(([label, value]) => ({ label, value, color: devColors[label] || '#94a3b8' }));

    // Always include charts
    charts = `
      <div style="margin-bottom:24px;">${generateBarChartSVG(hoursData, 'Events per Hour (Last 24h)')}</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:24px;">
        <div>${generateDonutSVG(sevData, 'Severity Distribution')}</div>
        <div>${generateDonutSVG(devData, 'Device Status')}</div>
      </div>
    `;

    if (reportType === "events") {
      reportTitle = "Events Report";
      tableHeaders = ["Title", "Type", "Severity", "Status", "Created"];
      tableRows = filteredEvents.map((e: any) => [e.title, e.event_type, e.severity, e.status, new Date(e.created_at).toLocaleString()]);
      const critical = filteredEvents.filter((e: any) => e.severity === "critical").length;
      const resolved = filteredEvents.filter((e: any) => e.status === "resolved").length;
      summaryStats = [
        { label: "Total Events", value: String(filteredEvents.length) },
        { label: "Critical", value: String(critical) },
        { label: "High", value: String(filteredEvents.filter((e: any) => e.severity === "high").length) },
        { label: "Resolved", value: String(resolved) },
        { label: "Active", value: String(filteredEvents.filter((e: any) => e.status === "new" || e.status === "acknowledged").length) },
      ];
    } else if (reportType === "incidents") {
      reportTitle = "Incidents Report";
      tableHeaders = ["Title", "Priority", "Status", "Created"];
      tableRows = filteredIncidents.map((i: any) => [i.title, i.priority, i.status, new Date(i.created_at).toLocaleString()]);
      const open = filteredIncidents.filter((i: any) => i.status === "open").length;
      summaryStats = [
        { label: "Total Incidents", value: String(filteredIncidents.length) },
        { label: "Open", value: String(open) },
        { label: "Closed", value: String(filteredIncidents.filter((i: any) => i.status === "closed").length) },
      ];
    } else if (reportType === "devices") {
      reportTitle = "Devices Report";
      tableHeaders = ["Name", "Brand", "Model", "IP", "Status", "Site"];
      const siteMap = Object.fromEntries((sites || []).map((s: any) => [s.id, s.name]));
      tableRows = (devices || []).map((d: any) => [d.name, d.brand, d.model, d.ip_address, d.status, siteMap[d.site_id] || '—']);
      const online = (devices || []).filter((d: any) => d.status === "online").length;
      summaryStats = [
        { label: "Total Devices", value: String((devices || []).length) },
        { label: "Online", value: String(online) },
        { label: "Offline", value: String((devices || []).filter((d: any) => d.status === "offline").length) },
        { label: "Sites", value: String((sites || []).length) },
      ];
    } else {
      reportTitle = "Platform Summary Report";
      const critical = (events || []).filter((e: any) => e.severity === "critical").length;
      const openIncidents = (incidents || []).filter((i: any) => i.status === "open").length;
      const onlineDev = (devices || []).filter((d: any) => d.status === "online").length;
      summaryStats = [
        { label: "Total Devices", value: String((devices || []).length) },
        { label: "Devices Online", value: String(onlineDev) },
        { label: "Total Events", value: String((events || []).length) },
        { label: "Critical Events", value: String(critical) },
        { label: "Open Incidents", value: String(openIncidents) },
        { label: "Total Sites", value: String((sites || []).length) },
      ];
    }

    const dateRange = from && to ? `${from} — ${to}` : "All time";

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; color: #1a1a2e; max-width: 800px; margin: 0 auto; }
  .header { border-bottom: 3px solid #0f3460; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { margin: 0; font-size: 24px; color: #0f3460; }
  .header .subtitle { font-size: 12px; color: #666; margin-top: 4px; }
  .meta { display: flex; gap: 24px; margin-bottom: 24px; font-size: 11px; color: #666; }
  .stats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
  .stat { background: #f0f4ff; border-radius: 8px; padding: 12px 20px; text-align: center; min-width: 100px; }
  .stat .value { font-size: 28px; font-weight: 700; color: #0f3460; }
  .stat .label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .charts { margin-bottom: 24px; page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; page-break-inside: auto; }
  th { background: #0f3460; color: white; padding: 8px 10px; text-align: left; font-weight: 600; }
  td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; }
  tr:nth-child(even) { background: #f8f9fa; }
  tr { page-break-inside: avoid; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 10px; color: #999; text-align: center; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
  .badge-critical { background: #fee2e2; color: #991b1b; }
  .badge-high { background: #fef3c7; color: #92400e; }
  .badge-online { background: #d1fae5; color: #065f46; }
  .badge-offline { background: #fee2e2; color: #991b1b; }
  .severity-critical td:nth-child(3) { color: #991b1b; font-weight: 600; }
  .severity-high td:nth-child(3) { color: #92400e; font-weight: 600; }
  .status-online td:last-child { color: #065f46; font-weight: 600; }
  .status-offline td:last-child { color: #991b1b; font-weight: 600; }
</style>
</head>
<body>
  <div class="header">
    <h1>${escHtml(tenantName)}</h1>
    <div class="subtitle">${escHtml(reportTitle)} • Generated ${now.toISOString()}</div>
  </div>
  <div class="meta">
    <span>📅 Period: ${dateRange}</span>
    <span>🕐 Timezone: ${tz}</span>
    <span>📊 Records: ${tableRows.length || '—'}</span>
  </div>
  <div class="stats">
    ${summaryStats.map(s => `<div class="stat"><div class="value">${s.value}</div><div class="label">${s.label}</div></div>`).join("")}
  </div>
  <div class="charts">${charts}</div>
  ${tableRows.length > 0 ? `
  <table>
    <thead><tr>${tableHeaders.map(h => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${tableRows.slice(0, 200).map(row => `<tr>${row.map(cell => `<td>${escHtml(String(cell ?? ''))}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>
  ${tableRows.length > 200 ? `<p style="font-size:11px;color:#666;margin-top:8px;">Showing first 200 of ${tableRows.length} records</p>` : ""}
  ` : ""}
  <div class="footer">
    ${escHtml(tenantName)} — AION Vision Hub • Confidential Report • Page 1
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${reportType}-report-${now.toISOString().slice(0, 10)}.html"`,
      },
    });
  } catch (e) {
    console.error("reports-pdf error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
