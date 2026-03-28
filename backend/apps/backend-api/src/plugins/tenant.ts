import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { tenants } from '../db/schema/index.js';
import { RedisCache } from '../lib/cache.js';

declare module 'fastify' {
  interface FastifyRequest {
    tenantActive: boolean;
  }
}

const tenantCache = new RedisCache<{ id: string }>('tenant', 300_000);

async function tenantPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.tenantId) return;

    // Check Redis cache first
    const cached = await tenantCache.get(request.tenantId);
    if (cached) {
      request.tenantActive = true;
      return;
    }

    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, request.tenantId))
      .limit(1);

    if (!tenant) {
      reply.code(403).send({
        success: false,
        error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' },
      });
      return;
    }

    // Cache tenant existence for 5 minutes
    await tenantCache.set(request.tenantId, tenant);
    request.tenantActive = true;
  });
}

export default fp(tenantPlugin, {
  name: 'tenant',
  dependencies: ['auth'],
});
