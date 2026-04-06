import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { databaseRecordService } from './service.js';
import { createRecordSchema, updateRecordSchema, recordFiltersSchema } from './schemas.js';
import type { CreateRecordInput, UpdateRecordInput, RecordFilters } from './schemas.js';

export async function registerDatabaseRecordRoutes(app: FastifyInstance) {
  app.get<{ Querystring: RecordFilters }>('/', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const filters = recordFiltersSchema.parse(request.query);
    const data = await databaseRecordService.list(request.tenantId, filters);
    return reply.send({ success: true, data });
  });

  app.get<{ Params: { id: string } }>('/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const data = await databaseRecordService.getById(request.params.id, request.tenantId);
    return reply.send({ success: true, data });
  });

  app.post<{ Body: CreateRecordInput }>(
    '/', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createRecordSchema.parse(request.body);
      const data = await databaseRecordService.create(body, request.userId, request.tenantId);
      await request.audit('record.create', 'database_records', data.id, { title: data.title });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateRecordInput }>(
    '/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateRecordSchema.parse(request.body);
      const data = await databaseRecordService.update(request.params.id, body, request.tenantId);
      await request.audit('record.update', 'database_records', data.id, body);
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await databaseRecordService.delete(request.params.id, request.tenantId);
      await request.audit('record.delete', 'database_records', request.params.id);
      return reply.code(204).send();
    },
  );
}
