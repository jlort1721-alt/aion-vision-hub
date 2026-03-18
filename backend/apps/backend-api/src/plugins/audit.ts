import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { db } from '../db/client.js';
import { auditLogs } from '../db/schema/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    audit(action: string, entityType: string, entityId?: string, details?: Record<string, unknown>): Promise<void>;
  }
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function auditPlugin(app: FastifyInstance) {
  app.decorateRequest('audit', function () { throw new Error('audit not initialized'); } as any);

  app.addHook('onRequest', async (request: FastifyRequest) => {
    request.audit = async (action, entityType, entityId?, details?) => {
      if (!request.userId || !request.tenantId) return;

      await db.insert(auditLogs).values({
        tenantId: request.tenantId,
        userId: request.userId,
        userEmail: request.userEmail ?? 'unknown',
        action,
        entityType,
        entityId,
        afterState: details ?? null,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });
    };
  });

  // Auto-audit on mutation responses
  app.addHook('onResponse', async (request) => {
    if (!MUTATION_METHODS.has(request.method)) return;
    if (!request.userId) return;

    const action = `${request.method.toLowerCase()}:${request.url.split('?')[0]}`;
    await request.audit(action, request.url.split('/')[2] ?? 'unknown').catch(() => {
      // Non-blocking audit log failure
    });
  });
}

export default fp(auditPlugin, {
  name: 'audit',
  dependencies: ['auth'],
});
