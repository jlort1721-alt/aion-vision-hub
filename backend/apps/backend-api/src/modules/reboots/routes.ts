import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { rebootService } from './service.js';
import { createRebootTaskSchema, completeRebootSchema, rebootFiltersSchema } from './schemas.js';
import type { CreateRebootTaskInput, CompleteRebootInput, RebootFilters } from './schemas.js';

export async function registerRebootRoutes(app: FastifyInstance) {
  app.get<{ Querystring: RebootFilters }>('/', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const filters = rebootFiltersSchema.parse(request.query);
    const data = await rebootService.list(request.tenantId, filters);
    return reply.send({ success: true, data });
  });

  app.get<{ Params: { id: string } }>('/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const data = await rebootService.getById(request.params.id, request.tenantId);
    return reply.send({ success: true, data });
  });

  app.post<{ Body: CreateRebootTaskInput }>(
    '/', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createRebootTaskSchema.parse(request.body);
      const data = await rebootService.create(body, request.userId, request.tenantId);
      await request.audit('reboot.create', 'reboot_tasks', data.id, { reason: data.reason });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.post<{ Params: { id: string }; Body: CompleteRebootInput }>(
    '/:id/complete', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = completeRebootSchema.parse(request.body);
      const data = await rebootService.complete(request.params.id, body, request.tenantId);
      await request.audit('reboot.complete', 'reboot_tasks', data.id, { status: data.status });
      return reply.send({ success: true, data });
    },
  );
}
