import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { ApiKeyService } from './service.js';
import { createApiKeySchema } from './schemas.js';

export async function registerApiKeyRoutes(app: FastifyInstance) {
  const service = new ApiKeyService();

  // List API keys for tenant
  app.get('/', { preHandler: [requireRole('super_admin', 'tenant_admin')] }, async (request) => {
    const data = await service.list(request.tenantId);
    return { success: true, data };
  });

  // Create a new API key
  app.post('/', { preHandler: [requireRole('super_admin', 'tenant_admin')] }, async (request, reply) => {
    const body = createApiKeySchema.parse(request.body);
    const data = await service.create(body, request.tenantId, request.userId);

    await request.audit('api_key.create', 'api_keys', data.id, { name: data.name, scopes: data.scopes });

    return reply.code(201).send({
      success: true,
      data,
      warning: 'Store this API key securely. It will not be shown again.',
    });
  });

  // Revoke an API key
  app.delete('/:id', { preHandler: [requireRole('super_admin', 'tenant_admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await service.revoke(id, request.tenantId);

    if (!result) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'API key not found' },
      });
    }

    await request.audit('api_key.revoke', 'api_keys', id);

    return { success: true };
  });
}
