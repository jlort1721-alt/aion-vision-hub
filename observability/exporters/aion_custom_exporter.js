#!/usr/bin/env node
/**
 * aion_custom_exporter.js — exports AION-specific metrics that don't fit
 * elsewhere. Polls internal endpoints/DB and re-exposes them in Prometheus
 * format on :9210.
 *
 * Metrics:
 *   aion_vision_hub_total_services
 *   aion_vision_hub_healthy_services
 *   aion_pg_tables_without_rls
 *   aion_ai_cost_usd_total{model}        (counter, daily)
 *   aion_whatsapp_queue_pending
 *   aion_camera_online_total
 *   aion_iot_device_online_total
 *
 * Run: pm2 start aion_custom_exporter.js --name aion-exporter
 */
import http from 'node:http';
import pkg from 'pg';
const { Pool } = pkg;

const PORT             = Number(process.env.PORT ?? 9210);
const VISION_HUB_URL   = process.env.VISION_HUB_URL   ?? 'http://127.0.0.1:3030/api/vision-hub/health';
const COMMS_QUEUE_URL  = process.env.COMMS_QUEUE_URL  ?? 'http://127.0.0.1:3300/api/queue/whatsapp/stats';
const VISION_AUTH      = process.env.VISION_HUB_TOKEN ?? '';
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 30_000);

const pg = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://aion@127.0.0.1:5432/aion',
  max: 3,
});

// ---- Metric state -----------------------------------------------------------
const state = {
  vh_total: 0,
  vh_healthy: 0,
  rls_missing: 0,
  ai_cost: {},          // model -> usd
  wa_pending: 0,
  cameras_online: 0,
  iot_online: 0,
  last_scrape_ok: 0,
  last_scrape_ts: 0,
};

// ---- Pollers ----------------------------------------------------------------
async function pollVisionHub() {
  try {
    const r = await fetch(VISION_HUB_URL, {
      headers: VISION_AUTH ? { Authorization: `Bearer ${VISION_AUTH}` } : {},
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = await r.json();
    const services = body.services ?? [];
    state.vh_total   = services.length;
    state.vh_healthy = services.filter(s => s.status === 'healthy').length;
  } catch (e) {
    console.error('vision-hub poll error:', e.message);
  }
}

async function pollPgRls() {
  try {
    const { rows } = await pg.query(`
      SELECT count(*)::int AS n FROM pg_tables
      WHERE schemaname='public' AND rowsecurity=false AND tablename<>'schema_migrations'
    `);
    state.rls_missing = rows[0]?.n ?? 0;
  } catch (e) {
    console.error('pg rls poll error:', e.message);
  }
}

async function pollAiCost() {
  try {
    const { rows } = await pg.query(`
      SELECT model, COALESCE(SUM(cost_usd),0)::float AS usd
      FROM ai_usage
      WHERE date = current_date
      GROUP BY model
    `);
    state.ai_cost = Object.fromEntries(rows.map(r => [r.model, r.usd]));
  } catch (e) {
    // ai_usage table may not exist in early environments
    if (!/relation .* does not exist/.test(e.message)) {
      console.error('ai_cost poll error:', e.message);
    }
  }
}

async function pollDeviceCounts() {
  try {
    const { rows } = await pg.query(`
      SELECT
        (SELECT count(*) FROM cameras    WHERE status='online')::int AS cams,
        (SELECT count(*) FROM iot_devices WHERE status='online')::int AS iot
    `);
    state.cameras_online = rows[0]?.cams ?? 0;
    state.iot_online     = rows[0]?.iot  ?? 0;
  } catch (e) {
    if (!/relation .* does not exist/.test(e.message)) {
      console.error('device counts poll error:', e.message);
    }
  }
}

async function pollWhatsappQueue() {
  try {
    const r = await fetch(COMMS_QUEUE_URL, { signal: AbortSignal.timeout(5_000) });
    if (!r.ok) return;
    const body = await r.json();
    state.wa_pending = body.pending ?? 0;
  } catch {
    // best-effort, comms may be down
  }
}

async function pollAll() {
  const t0 = Date.now();
  await Promise.allSettled([
    pollVisionHub(),
    pollPgRls(),
    pollAiCost(),
    pollDeviceCounts(),
    pollWhatsappQueue(),
  ]);
  state.last_scrape_ts = Date.now();
  state.last_scrape_ok = (Date.now() - t0 < 20_000) ? 1 : 0;
}

// ---- Render Prometheus exposition ------------------------------------------
function renderMetrics() {
  const lines = [];
  const push = (help, type, name, value, labels = {}) => {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} ${type}`);
    const lbl = Object.keys(labels).length
      ? '{' + Object.entries(labels).map(([k,v]) => `${k}="${v}"`).join(',') + '}'
      : '';
    lines.push(`${name}${lbl} ${value}`);
  };

  push('Total Vision Hub services',    'gauge', 'aion_vision_hub_total_services',   state.vh_total);
  push('Healthy Vision Hub services',  'gauge', 'aion_vision_hub_healthy_services', state.vh_healthy);
  push('Tables in public without RLS', 'gauge', 'aion_pg_tables_without_rls',       state.rls_missing);
  push('WhatsApp queue pending',       'gauge', 'aion_whatsapp_queue_pending',      state.wa_pending);
  push('Cameras online',               'gauge', 'aion_camera_online_total',         state.cameras_online);
  push('IoT devices online',           'gauge', 'aion_iot_device_online_total',     state.iot_online);
  push('Last scrape OK (1) or failed (0)', 'gauge', 'aion_exporter_scrape_ok',      state.last_scrape_ok);
  push('Last scrape timestamp ms',     'gauge', 'aion_exporter_last_scrape_ms',     state.last_scrape_ts);

  // AI cost per model (counter — cumulative for the day)
  lines.push('# HELP aion_ai_cost_usd_total Cumulative AI spend today');
  lines.push('# TYPE aion_ai_cost_usd_total counter');
  for (const [model, usd] of Object.entries(state.ai_cost)) {
    lines.push(`aion_ai_cost_usd_total{model="${model}"} ${usd}`);
  }

  return lines.join('\n') + '\n';
}

// ---- HTTP server -----------------------------------------------------------
const server = http.createServer((req, res) => {
  if (req.url === '/metrics' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
    return res.end(renderMetrics());
  }
  if (req.url === '/healthz') {
    res.writeHead(200);
    return res.end('ok\n');
  }
  res.writeHead(404);
  res.end('not found\n');
});

// ---- Bootstrap -------------------------------------------------------------
await pollAll();
setInterval(pollAll, POLL_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`aion_custom_exporter listening on :${PORT}/metrics`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    console.log(`Received ${sig}, shutting down.`);
    server.close();
    await pg.end();
    process.exit(0);
  });
}
