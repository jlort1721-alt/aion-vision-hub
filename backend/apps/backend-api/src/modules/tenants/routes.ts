import type { FastifyInstance } from 'fastify';
import { TenantService } from './service.js';
import { createTenantSchema, updateTenantSchema } from './schemas.js';
import { requireRole } from '../../plugins/auth.js';

export async function registerTenantRoutes(app: FastifyInstance) {
  const service = new TenantService();

  // /current MUST be before /:id to avoid "current" being treated as UUID
  app.get('/current', async (request) => {
    try {
      if (request.tenantId) {
        const data = await service.getById(request.tenantId, request.tenantId, request.userRole);
        return { success: true, data };
      }
    } catch { /* fallthrough to default */ }
    return {
      success: true,
      data: {
        id: request.tenantId || 'default',
        name: 'Clave Seguridad CTA',
        slug: 'clave-seguridad',
        settings: {
          branding: { company_name: 'Clave Seguridad CTA', primary_color: '#C8232A', secondary_color: '#1A2332' },
          features: { ai_assistant: true, video_surveillance: true, access_control: true, intercom: true, domotics: true },
        },
      },
    };
  });

  app.get('/', { preHandler: [requireRole('super_admin', 'tenant_admin')] }, async (request) => {
    const data = await service.list(request.tenantId, request.userRole);
    return { success: true, data };
  });

  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return { success: false, error: 'Invalid tenant ID format' };
    }
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
