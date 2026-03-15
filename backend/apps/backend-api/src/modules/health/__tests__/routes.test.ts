import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// ── Mock the database client ────────────────────────────────────
vi.mock('../../../db/client.js', () => ({
  db: {
    execute: vi.fn(),
  },
}));

import { registerHealthRoutes } from '../routes.js';
import { db } from '../../../db/client.js';

const mockedDb = vi.mocked(db);

// ── Test Suite ──────────────────────────────────────────────────
describe('Health routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(registerHealthRoutes, { prefix: '/health' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /health ────────────────────────────────────────────
  describe('GET /health', () => {
    it('returns 200 with status "healthy"', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('healthy');
    });

    it('includes version, uptime, and timestamp fields', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = res.json();
      expect(body).toHaveProperty('version');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('timestamp');
      expect(typeof body.version).toBe('string');
      expect(typeof body.uptime).toBe('number');
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('returns a valid ISO 8601 timestamp', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = res.json();
      const parsed = new Date(body.timestamp);
      expect(parsed.toISOString()).toBe(body.timestamp);
    });
  });

  // ── GET /health/ready ──────────────────────────────────────
  describe('GET /health/ready', () => {
    it('returns 200 with status "ready" when database is reachable', async () => {
      mockedDb.execute.mockResolvedValueOnce([] as any);

      const res = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ready');
      expect(body).toHaveProperty('timestamp');
    });

    it('returns 503 with status "not_ready" when database is unreachable', async () => {
      mockedDb.execute.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const res = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(res.statusCode).toBe(503);
      const body = res.json();
      expect(body.status).toBe('not_ready');
      expect(body.reason).toBe('database_unreachable');
      expect(body).toHaveProperty('timestamp');
    });
  });

  // ── GET /health/metrics ────────────────────────────────────
  describe('GET /health/metrics', () => {
    it('returns 200 with uptime, memory, cpu, and timestamp', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health/metrics',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('memory');
      expect(body).toHaveProperty('cpu');
      expect(body).toHaveProperty('timestamp');
      expect(typeof body.uptime).toBe('number');
      expect(typeof body.memory).toBe('object');
      expect(typeof body.cpu).toBe('object');
    });

    it('memory object contains expected memoryUsage fields', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health/metrics',
      });

      const body = res.json();
      expect(body.memory).toHaveProperty('rss');
      expect(body.memory).toHaveProperty('heapUsed');
      expect(body.memory).toHaveProperty('heapTotal');
      expect(body.memory).toHaveProperty('external');
    });
  });
});
