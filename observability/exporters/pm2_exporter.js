#!/usr/bin/env node
/**
 * pm2_exporter.js — exports PM2 process metrics in Prometheus format.
 *
 * Endpoint: GET / -> Prometheus exposition (port 9209).
 *
 * Metrics:
 *   pm2_status{app, color}            1=online, 0=otherwise
 *   pm2_uptime_seconds{app, color}
 *   pm2_restarts_total{app, color}
 *   pm2_memory_bytes{app, color}
 *   pm2_cpu_percent{app, color}
 *   pm2_unstable_restarts_total{app, color}
 *
 * Run: pm2 start pm2_exporter.js --name pm2-exporter --no-autorestart
 */
import http from 'node:http';
import pm2 from 'pm2';

const PORT = Number(process.env.PORT ?? 9209);

function fmt(metric, labels, value) {
  const labelStr = Object.entries(labels)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`)
    .join(',');
  return `${metric}{${labelStr}} ${value}`;
}

function colorFromName(name) {
  if (name.endsWith('-blue'))  return 'blue';
  if (name.endsWith('-green')) return 'green';
  return 'none';
}

function appBaseName(name) {
  return name.replace(/-(blue|green)$/, '');
}

function collect() {
  return new Promise((resolve, reject) => {
    pm2.connect(err => {
      if (err) return reject(err);
      pm2.list((err2, list) => {
        pm2.disconnect();
        if (err2) return reject(err2);
        resolve(list);
      });
    });
  });
}

const HELP = `
# HELP pm2_status PM2 app status: 1 if online, 0 otherwise
# TYPE pm2_status gauge
# HELP pm2_uptime_seconds Process uptime in seconds
# TYPE pm2_uptime_seconds gauge
# HELP pm2_restarts_total Total restarts since process started
# TYPE pm2_restarts_total counter
# HELP pm2_unstable_restarts_total Unstable (rapid) restarts
# TYPE pm2_unstable_restarts_total counter
# HELP pm2_memory_bytes Process resident memory
# TYPE pm2_memory_bytes gauge
# HELP pm2_cpu_percent Process CPU percentage
# TYPE pm2_cpu_percent gauge
`.trim();

const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok\n');
  }

  try {
    const procs = await collect();
    const lines = [HELP];
    const now = Date.now();

    for (const p of procs) {
      const labels = {
        app:   appBaseName(p.name),
        color: colorFromName(p.name),
        pm_id: p.pm_id,
      };
      const status = p.pm2_env?.status === 'online' ? 1 : 0;
      const uptime = p.pm2_env?.pm_uptime
        ? Math.floor((now - p.pm2_env.pm_uptime) / 1000)
        : 0;

      lines.push(fmt('pm2_status',                   labels, status));
      lines.push(fmt('pm2_uptime_seconds',           labels, uptime));
      lines.push(fmt('pm2_restarts_total',           labels, p.pm2_env?.restart_time ?? 0));
      lines.push(fmt('pm2_unstable_restarts_total', labels, p.pm2_env?.unstable_restarts ?? 0));
      lines.push(fmt('pm2_memory_bytes',             labels, p.monit?.memory ?? 0));
      lines.push(fmt('pm2_cpu_percent',              labels, p.monit?.cpu    ?? 0));

      // Errored state explicit metric
      lines.push(fmt('pm2_status', { ...labels, status: p.pm2_env?.status ?? 'unknown' },
        p.pm2_env?.status === 'errored' ? 1 : 0));
    }

    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
    res.end(lines.join('\n') + '\n');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`# pm2_exporter error: ${e.message}\n`);
  }
});

server.listen(PORT, () => {
  console.log(`pm2_exporter listening on :${PORT}/metrics`);
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`Received ${sig}, exiting.`);
    server.close(() => process.exit(0));
  });
}
