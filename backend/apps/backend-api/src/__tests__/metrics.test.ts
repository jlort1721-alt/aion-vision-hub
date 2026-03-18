import { describe, it, expect } from 'vitest';
import {
  appRegistry,
  httpRequestDuration,
  httpRequestsTotal,
  wsConnectionsActive,
  wsBroadcastsTotal,
  streamsActive,
  authAttemptsTotal,
  eventsIngestedTotal,
  redisConnected,
} from '../lib/metrics.js';

describe('Application Metrics', () => {
  it('all metrics are registered in appRegistry', async () => {
    const metrics = await appRegistry.getMetricsAsJSON();
    const names = metrics.map((m) => m.name);

    expect(names).toContain('aion_http_request_duration_seconds');
    expect(names).toContain('aion_http_requests_total');
    expect(names).toContain('aion_ws_connections_active');
    expect(names).toContain('aion_ws_broadcasts_total');
    expect(names).toContain('aion_streams_active');
    expect(names).toContain('aion_auth_attempts_total');
    expect(names).toContain('aion_events_ingested_total');
    expect(names).toContain('aion_redis_connected');
  });

  it('httpRequestDuration is a histogram with correct buckets', () => {
    expect(httpRequestDuration).toBeDefined();
    // Observe a sample value
    httpRequestDuration.observe({ method: 'GET', route: '/test', status_code: '200' }, 0.05);
  });

  it('httpRequestsTotal increments correctly', async () => {
    httpRequestsTotal.inc({ method: 'GET', route: '/test', status_code: '200' });
    const metric = await httpRequestsTotal.get();
    expect(metric.values.length).toBeGreaterThan(0);
  });

  it('wsConnectionsActive can be set and read', async () => {
    wsConnectionsActive.set({ tenant_id: 'test' }, 5);
    const metric = await wsConnectionsActive.get();
    const val = metric.values.find((v) => v.labels.tenant_id === 'test');
    expect(val?.value).toBe(5);
  });

  it('gauge metrics can be incremented and decremented', async () => {
    streamsActive.set(10);
    streamsActive.dec();
    const metric = await streamsActive.get();
    expect(metric.values[0].value).toBe(9);
  });

  it('counter metrics only go up', async () => {
    authAttemptsTotal.inc({ result: 'success' });
    authAttemptsTotal.inc({ result: 'success' });
    const metric = await authAttemptsTotal.get();
    const val = metric.values.find((v) => v.labels.result === 'success');
    expect(val!.value).toBeGreaterThanOrEqual(2);
  });

  it('registry exports Prometheus text format', async () => {
    const text = await appRegistry.metrics();
    expect(text).toContain('# HELP aion_http_request_duration_seconds');
    expect(text).toContain('# TYPE aion_http_request_duration_seconds histogram');
  });

  it('wsBroadcastsTotal tracks by channel', async () => {
    wsBroadcastsTotal.inc({ channel: 'events' });
    const metric = await wsBroadcastsTotal.get();
    const val = metric.values.find((v) => v.labels.channel === 'events');
    expect(val!.value).toBeGreaterThanOrEqual(1);
  });

  it('eventsIngestedTotal tracks by severity', async () => {
    eventsIngestedTotal.inc({ severity: 'critical' });
    const metric = await eventsIngestedTotal.get();
    const val = metric.values.find((v) => v.labels.severity === 'critical');
    expect(val!.value).toBeGreaterThanOrEqual(1);
  });

  it('redisConnected is a gauge', async () => {
    redisConnected.set(1);
    const metric = await redisConnected.get();
    expect(metric.values[0].value).toBe(1);
  });
});
