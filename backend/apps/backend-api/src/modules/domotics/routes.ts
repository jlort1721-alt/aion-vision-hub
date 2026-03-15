import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { domoticService } from './service.js';
import {
  createDomoticDeviceSchema, updateDomoticDeviceSchema,
  domoticFiltersSchema, domoticActionSchema,
} from './schemas.js';
import type { CreateDomoticDeviceInput, UpdateDomoticDeviceInput, DomoticFilters, DomoticActionInput } from './schemas.js';

export async function registerDomoticRoutes(app: FastifyInstance) {
  app.get<{ Querystring: DomoticFilters }>('/', async (request, reply) => {
    const filters = domoticFiltersSchema.parse(request.query);
    const data = await domoticService.list(request.tenantId, filters);
    return reply.send({ success: true, data });
  });

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const data = await domoticService.getById(request.params.id, request.tenantId);
    return reply.send({ success: true, data });
  });

  app.post<{ Body: CreateDomoticDeviceInput }>(
    '/', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createDomoticDeviceSchema.parse(request.body);
      const data = await domoticService.create(body, request.tenantId);
      await request.audit('domotic.create', 'domotic_devices', data.id, { name: data.name });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateDomoticDeviceInput }>(
    '/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateDomoticDeviceSchema.parse(request.body);
      const data = await domoticService.update(request.params.id, body, request.tenantId);
      await request.audit('domotic.update', 'domotic_devices', data.id, body);
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await domoticService.delete(request.params.id, request.tenantId);
      await request.audit('domotic.delete', 'domotic_devices', request.params.id);
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string }; Body: DomoticActionInput }>(
    '/:id/action', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { action } = domoticActionSchema.parse(request.body);
      const data = await domoticService.executeAction(request.params.id, action, request.userId, request.tenantId);
      await request.audit('domotic.action', 'domotic_devices', request.params.id, { action });
      return reply.send({ success: true, data });
    },
  );

  app.get<{ Params: { id: string } }>('/:id/actions', async (request, reply) => {
    const data = await domoticService.getActions(request.params.id, request.tenantId);
    return reply.send({ success: true, data });
  });
}
