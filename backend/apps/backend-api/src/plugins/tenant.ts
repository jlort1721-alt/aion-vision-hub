import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { tenants } from '../db/schema/index.js';

declare module 'fastify' {
  interface FastifyRequest {
    tenantActive: boolean;
  }
}

async function tenantPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.tenantId) return;

    const [tenant] = await db
      .select({ isActive: tenants.isActive })
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

    if (!tenant.isActive) {
      reply.code(403).send({
        success: false,
        error: { code: 'TENANT_INACTIVE', message: 'Tenant account is inactive' },
      });
      return;
    }

    request.tenantActive = true;
  });
}

export default fp(tenantPlugin, {
  name: 'tenant',
  dependencies: ['auth'],
});
