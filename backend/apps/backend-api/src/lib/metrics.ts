/**
 * Custom application-level Prometheus metrics for AION Vision Hub.
 *
 * These supplement the auto-instrumented OTel metrics with
 * domain-specific counters and gauges.
 */

import { Counter, Gauge, Histogram, Registry } from 'prom-client';

export const appRegistry = new Registry();

// ── HTTP request metrics ────────────────────────────────────────────
export const httpRequestDuration = new Histogram({
  name: 'aion_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [appRegistry],
});

export const httpRequestsTotal = new Counter({
  name: 'aion_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [appRegistry],
});

// ── WebSocket metrics ───────────────────────────────────────────────
export const wsConnectionsActive = new Gauge({
  name: 'aion_ws_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['tenant_id'] as const,
  registers: [appRegistry],
});

export const wsBroadcastsTotal = new Counter({
  name: 'aion_ws_broadcasts_total',
  help: 'Total WebSocket broadcast messages sent',
  labelNames: ['channel'] as const,
  registers: [appRegistry],
});

// ── Stream registry metrics ─────────────────────────────────────────
export const streamsActive = new Gauge({
  name: 'aion_streams_active',
  help: 'Number of active stream registrations',
  registers: [appRegistry],
});

// ── Auth metrics ────────────────────────────────────────────────────
export const authAttemptsTotal = new Counter({
  name: 'aion_auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['result'] as const, // success, failure, token_reuse
  registers: [appRegistry],
});

// ── Event processing metrics ────────────────────────────────────────
export const eventsIngestedTotal = new Counter({
  name: 'aion_events_ingested_total',
  help: 'Total events ingested',
  labelNames: ['severity'] as const,
  registers: [appRegistry],
});

// ── Redis connectivity ──────────────────────────────────────────────
export const redisConnected = new Gauge({
  name: 'aion_redis_connected',
  help: 'Whether Redis is connected (1) or not (0)',
  registers: [appRegistry],
});

// ── Database metrics ────────────────────────────────────────────────
export const dbQueryDuration = new Histogram({
  name: 'aion_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [appRegistry],
});

export const dbPoolActive = new Gauge({
  name: 'aion_db_pool_active',
  help: 'Number of active database pool connections',
  registers: [appRegistry],
});

// ── Cache metrics ───────────────────────────────────────────────────
export const cacheHitRate = new Gauge({
  name: 'aion_cache_hit_rate',
  help: 'Cache hit rate ratio (0-1)',
  labelNames: ['namespace'] as const,
  registers: [appRegistry],
});

// ── Backup metrics ──────────────────────────────────────────────────
export const backupLastSuccess = new Gauge({
  name: 'aion_backup_last_success_timestamp',
  help: 'Unix timestamp of last successful backup',
  registers: [appRegistry],
});

// ── Worker metrics ──────────────────────────────────────────────────
export const workerErrors = new Counter({
  name: 'aion_worker_errors_total',
  help: 'Total worker errors by worker name',
  labelNames: ['worker'] as const,
  registers: [appRegistry],
});
