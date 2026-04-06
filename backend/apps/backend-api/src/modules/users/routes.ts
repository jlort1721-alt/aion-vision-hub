import type { FastifyInstance } from 'fastify';
import { UserService } from './service.js';
import { createUserSchema, updateUserSchema } from './schemas.js';
import { requireRole } from '../../plugins/auth.js';
import { enforcePlanLimit } from '../../plugins/plan-limits.js';

export async function registerUserRoutes(app: FastifyInstance) {
  const service = new UserService();

  // List users scoped by tenant
  app.get('/', { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] }, async (request) => {
    const data = await service.list(request.tenantId);
    return { success: true, data };
  });

  // Get the requesting user's own profile
  app.get('/me', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request) => {
    const data = await service.getMe(request.userId);
    return { success: true, data };
  });

  // Get user by ID
  app.get('/:id', { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] }, async (request) => {
    const { id } = request.params as { id: string };
    const data = await service.getById(id, request.tenantId, request.userRole);
    return { success: true, data };
  });

  // Create a new user (tenant_admin or above)
  app.post('/', { preHandler: [requireRole('super_admin', 'tenant_admin'), enforcePlanLimit('users')] }, async (request, reply) => {
    const body = createUserSchema.parse(request.body);
    const data = await service.create(body, request.tenantId, request.userRole);
    await request.audit('create', 'users', data.id);
    reply.code(201);
    return { success: true, data };
  });

  // Update a user profile
  app.patch('/:id', { preHandler: [requireRole('super_admin', 'tenant_admin')] }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updateUserSchema.parse(request.body);
    const data = await service.update(id, body, request.tenantId, request.userRole);
    await request.audit('update', 'users', id, body);
    return { success: true, data };
  });

  // Delete a user
  app.delete('/:id', { preHandler: [requireRole('super_admin', 'tenant_admin')] }, async (request) => {
    const { id } = request.params as { id: string };
    await service.delete(id, request.tenantId, request.userRole);
    await request.audit('delete', 'users', id);
    return { success: true };
  });
}
