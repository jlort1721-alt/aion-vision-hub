import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('../db/client.js', () => ({
  db: { execute: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../lib/redis.js', () => ({ redis: null }));

vi.mock('@aion/common-utils', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

import { registerHealthRoutes } from '../modules/health/routes.js';

describe('Health Liveness Probe', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(registerHealthRoutes, { prefix: '/health' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/liveness returns 200 with alive status', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/liveness' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('alive');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('pid');
    expect(typeof body.pid).toBe('number');
  });

  it('GET /health/liveness is lightweight (no DB check)', async () => {
    const { db } = await import('../db/client.js');
    vi.mocked(db.execute).mockClear();

    await app.inject({ method: 'GET', url: '/health/liveness' });
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('GET /health/ready includes checks object', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.checks).toHaveProperty('database', 'ok');
  });

  it('GET /health/metrics returns Prometheus format', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
  });

  it('GET /health/metrics/json returns JSON process metrics', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/metrics/json' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('memory');
    expect(body).toHaveProperty('cpu');
    expect(body).toHaveProperty('timestamp');
  });
});
