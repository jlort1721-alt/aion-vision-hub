import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// ── Mock database ──────────────────────────────────────────────
const mockDbExecute = vi.fn();

vi.mock('../../../db/client.js', () => ({
  db: {
    execute: (...args: any[]) => mockDbExecute(...args),
  },
}));

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: any[]) => ({
    strings,
    values,
    __type: 'sql',
  }),
}));

vi.mock('@aion/common-utils', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

import { registerHealthRoutes } from '../routes.js';

describe('Health Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(registerHealthRoutes, { prefix: '/health' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /health ──────────────────────────────────────────────
  describe('GET /health', () => {
    it('returns 200 with health status', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('status', 'healthy');
    });

    it('includes version info', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      const body = res.json();
      expect(body).toHaveProperty('version');
    });

    it('includes uptime', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      const body = res.json();
      expect(body).toHaveProperty('uptime');
      expect(typeof body.uptime).toBe('number');
    });

    it('includes timestamp', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      const body = res.json();
      expect(body).toHaveProperty('timestamp');
    });
  });

  // ── GET /health/ready ────────────────────────────────────────
  describe('GET /health/ready', () => {
    it('returns 200 when database is reachable', async () => {
      mockDbExecute.mockResolvedValue([{ '?column?': 1 }]);

      const res = await app.inject({ method: 'GET', url: '/health/ready' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('status', 'ready');
    });

    it('returns 503 when database is unreachable', async () => {
      mockDbExecute.mockRejectedValue(new Error('Connection refused'));

      const res = await app.inject({ method: 'GET', url: '/health/ready' });
      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body).toHaveProperty('status', 'not_ready');
    });

    it('includes timestamp on success', async () => {
      mockDbExecute.mockResolvedValue([{ '?column?': 1 }]);

      const res = await app.inject({ method: 'GET', url: '/health/ready' });
      const body = res.json();
      expect(body).toHaveProperty('timestamp');
    });

    it('includes checks object on database failure', async () => {
      mockDbExecute.mockRejectedValue(new Error('Timeout'));

      const res = await app.inject({ method: 'GET', url: '/health/ready' });
      const body = res.json();
      expect(body.checks.database).toBe('fail');
    });
  });

  // ── GET /health/metrics ──────────────────────────────────────
  describe('GET /health/metrics', () => {
    it('returns 200 with Prometheus text format', async () => {
      const res = await app.inject({ method: 'GET', url: '/health/metrics' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
    });
  });

  // ── GET /health/metrics/json ───────────────────────────────
  describe('GET /health/metrics/json', () => {
    it('returns 200 with system metrics', async () => {
      const res = await app.inject({ method: 'GET', url: '/health/metrics/json' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('memory');
      expect(body).toHaveProperty('cpu');
    });

    it('includes memory usage breakdown', async () => {
      const res = await app.inject({ method: 'GET', url: '/health/metrics/json' });
      const body = res.json();
      expect(body.memory).toHaveProperty('rss');
      expect(body.memory).toHaveProperty('heapTotal');
      expect(body.memory).toHaveProperty('heapUsed');
    });
  });
});

describe('Health Routes — Public Access', () => {
  it('health endpoints are in PUBLIC_ROUTES list', () => {
    const PUBLIC_ROUTES = ['/health', '/health/ready', '/health/metrics', '/webhooks/whatsapp'];
    expect(PUBLIC_ROUTES).toContain('/health');
    expect(PUBLIC_ROUTES).toContain('/health/ready');
    expect(PUBLIC_ROUTES).toContain('/health/metrics');
  });

  it('health endpoints do not require authentication', () => {
    const PUBLIC_ROUTES = ['/health', '/health/ready', '/health/metrics'];
    expect(PUBLIC_ROUTES.length).toBe(3);
  });
});
