import type { FastifyInstance } from 'fastify';
import { TenantService } from './service.js';
import { createTenantSchema, updateTenantSchema } from './schemas.js';
import { requireRole } from '../../plugins/auth.js';

export async function registerTenantRoutes(app: FastifyInstance) {
  const service = new TenantService();

  app.get('/', { preHandler: [requireRole('super_admin', 'tenant_admin')] }, async (request) => {
    const data = await service.list(request.tenantId, request.userRole);
    return { success: true, data };
  });

  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const data = await service.getById(id, request.tenantId, request.userRole);
    return { success: true, data };
  });

  app.post('/', { preHandler: [requireRole('super_admin')] }, async (request, reply) => {
    const body = createTenantSchema.parse(request.body);
    const data = await service.create(body);
    await request.audit('create', 'tenants', data.id);
    reply.code(201);
    return { success: true, data };
  });

  app.patch('/:id', { preHandler: [requireRole('super_admin', 'tenant_admin')] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updateTenantSchema.parse(request.body);
    const data = await service.update(id, body, request.tenantId, request.userRole);
    await request.audit('update', 'tenants', id, body);
    return { success: true, data };
  });

  app.delete('/:id', { preHandler: [requireRole('super_admin')] }, async (request) => {
    const { id } = request.params as { id: string };
    await service.delete(id);
    await request.audit('delete', 'tenants', id);
    return { success: true };
  });

  app.get('/:id/settings', async (request) => {
    const { id } = request.params as { id: string };
    const data = await service.getSettings(id, request.tenantId, request.userRole);
    return { success: true, data };
  });
}
