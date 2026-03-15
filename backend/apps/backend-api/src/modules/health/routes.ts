import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { sql } from 'drizzle-orm';

const startTime = Date.now();

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/', async () => ({
    status: 'healthy',
    version: '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  }));

  app.get('/ready', async (_request, reply) => {
    try {
      await db.execute(sql`SELECT 1`);
      return { status: 'ready', timestamp: new Date().toISOString() };
    } catch (err) {
      app.log.error({ err }, 'Readiness check failed: database unreachable');
      return reply.code(503).send({
        status: 'not_ready',
        reason: 'database_unreachable',
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get('/metrics', async () => ({
    uptime: Math.floor((Date.now() - startTime) / 1000),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    timestamp: new Date().toISOString(),
  }));
}
