import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { sql } from 'drizzle-orm';
import { redis } from '../../lib/redis.js';
import { appRegistry } from '../../lib/metrics.js';

const startTime = Date.now();

export async function registerHealthRoutes(app: FastifyInstance) {
  // Basic health check — always returns 200 if the process is alive
  app.get('/', async () => ({
    status: 'healthy',
    version: '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  }));

  // Liveness probe — lightweight, confirms the event loop is responsive
  app.get('/liveness', async () => ({
    status: 'alive',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    pid: process.pid,
  }));

  // Readiness probe — checks external dependencies (DB, Redis)
  app.get('/ready', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = {};

    // Database check
    try {
      await db.execute(sql`SELECT 1`);
      checks.database = 'ok';
    } catch {
      checks.database = 'fail';
    }

    // Redis check (optional — missing Redis is not a failure if not configured)
    if (redis) {
      try {
        await redis.ping();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'fail';
      }
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');
    if (!allOk) {
      return reply.code(503).send({
        status: 'not_ready',
        checks,
        timestamp: new Date().toISOString(),
      });
    }

    return { status: 'ready', checks, timestamp: new Date().toISOString() };
  });

  // Prometheus metrics endpoint — returns app-level custom metrics
  app.get('/metrics', async (_request, reply) => {
    const metrics = await appRegistry.metrics();
    reply.header('Content-Type', appRegistry.contentType);
    return metrics;
  });

  // JSON process metrics (for dashboards that prefer JSON)
  app.get('/metrics/json', async () => ({
    uptime: Math.floor((Date.now() - startTime) / 1000),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    timestamp: new Date().toISOString(),
  }));
}
