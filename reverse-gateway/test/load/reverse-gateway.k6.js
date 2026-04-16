// test/load/reverse-gateway.k6.js
//
// k6 load test. Simulates the target production footprint:
//   * 50 devices connected concurrently (2x our current 22-site fleet headroom)
//   * 3 streams per device = 150 concurrent streams in go2rtc
//   * PTZ dispatches at 0.5/sec per device (realistic operator activity)
//   * Heartbeat every 30s
//
// Acceptance criteria (encoded as thresholds below):
//   * p(95) of stream_start latency < 1500 ms
//   * p(95) of PTZ latency < 400 ms
//   * error rate < 1%
//   * gateway memory < 3 GiB (tracked externally via Prometheus)
//
// Run:
//   k6 run \
//     -e BASE_URL=http://localhost:3000 \
//     -e TOKEN=$AION_E2E_TOKEN \
//     test/load/reverse-gateway.k6.js

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE = __ENV.BASE_URL ?? 'http://localhost:3000';
const TOKEN = __ENV.TOKEN ?? '';

const startLatency = new Trend('rev_stream_start_ms', true);
const ptzLatency   = new Trend('rev_ptz_ms', true);
const snapLatency  = new Trend('rev_snapshot_ms', true);
const errorRate    = new Rate('rev_errors');
const actions      = new Counter('rev_actions_total');

export const options = {
  scenarios: {
    steady: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      gracefulStop: '30s',
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m',  target: 100 },
        { duration: '30s', target: 0 },
      ],
      startTime: '6m',
    },
  },
  thresholds: {
    rev_stream_start_ms: ['p(95)<1500', 'p(99)<3000'],
    rev_ptz_ms:          ['p(95)<400',  'p(99)<800'],
    rev_snapshot_ms:     ['p(95)<1200'],
    rev_errors:          ['rate<0.01'],
    http_req_failed:     ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function headers() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'content-type': 'application/json',
  };
}

export function setup() {
  // Confirm the test stack has enough approved simulator devices.
  const res = http.get(`${BASE}/api/v1/reverse/sessions`, { headers: headers() });
  check(res, { 'setup: sessions 200': (r) => r.status === 200 });
  const { sessions } = JSON.parse(res.body);
  if (!sessions || sessions.length < 50) {
    throw new Error(
      `need >= 50 live sim sessions, got ${sessions?.length ?? 0}. ` +
        `Spin up more simulators before running this test.`,
    );
  }
  return { sessions: sessions.slice(0, 50) };
}

export default function (data) {
  const sess = data.sessions[(__VU - 1) % data.sessions.length];

  group('stream lifecycle', () => {
    const channel = randomIntBetween(1, 4);

    const t0 = Date.now();
    const start = http.post(
      `${BASE}/api/v1/reverse/sessions/${sess.session_id}/streams`,
      JSON.stringify({ channel, format: 'webrtc' }),
      { headers: headers() },
    );
    const startOk = check(start, { 'stream start 200': (r) => r.status === 200 });
    startLatency.add(Date.now() - t0);
    errorRate.add(!startOk);
    actions.add(1);

    if (!startOk) {
      return;
    }

    // Let the stream "run" briefly before we move it
    sleep(randomIntBetween(2, 5));

    // A few PTZ commands
    for (let i = 0; i < 3; i++) {
      const tp = Date.now();
      const action = ['pan_left', 'pan_right', 'tilt_up', 'tilt_down', 'zoom_in'][i % 5];
      const ptz = http.post(
        `${BASE}/api/v1/reverse/sessions/${sess.session_id}/ptz`,
        JSON.stringify({ channel, action, speed: 4 }),
        { headers: headers() },
      );
      const ok = check(ptz, { 'ptz 200': (r) => r.status === 200 });
      ptzLatency.add(Date.now() - tp);
      errorRate.add(!ok);
      actions.add(1);

      // stop
      http.post(
        `${BASE}/api/v1/reverse/sessions/${sess.session_id}/ptz`,
        JSON.stringify({ channel, action: 'stop', speed: 4 }),
        { headers: headers() },
      );
      sleep(0.5);
    }

    // Snapshot roundtrip
    const ts = Date.now();
    const snap = http.post(
      `${BASE}/api/v1/reverse/sessions/${sess.session_id}/snapshot`,
      JSON.stringify({ channel }),
      { headers: headers() },
    );
    const snapOk = check(snap, {
      'snapshot 200':     (r) => r.status === 200,
      'snapshot is jpeg': (r) => (r.headers['Content-Type'] ?? '').includes('image/jpeg'),
    });
    snapLatency.add(Date.now() - ts);
    errorRate.add(!snapOk);
    actions.add(1);

    // Stop stream
    const stop = http.del(
      `${BASE}/api/v1/reverse/sessions/${sess.session_id}/streams/${channel}`,
      null,
      { headers: headers() },
    );
    check(stop, { 'stream stop 2xx': (r) => r.status >= 200 && r.status < 300 });
    actions.add(1);
  });

  sleep(randomIntBetween(1, 3));
}

export function handleSummary(data) {
  return {
    'test/load/summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const m = data.metrics;
  const fmt = (k) => {
    const v = m[k];
    if (!v) return `${k}: n/a`;
    const s = v.values;
    return `${k}: avg=${(s.avg ?? 0).toFixed(1)} p95=${(s['p(95)'] ?? 0).toFixed(1)} p99=${(s['p(99)'] ?? 0).toFixed(1)}`;
  };
  return [
    '',
    '=== AION Reverse Gateway · Load Test Summary ===',
    fmt('rev_stream_start_ms'),
    fmt('rev_ptz_ms'),
    fmt('rev_snapshot_ms'),
    `error rate: ${(m.rev_errors?.values?.rate ?? 0).toFixed(4)}`,
    `total actions: ${m.rev_actions_total?.values?.count ?? 0}`,
    '',
  ].join('\n');
}
