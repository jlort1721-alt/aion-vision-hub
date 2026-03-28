import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { keyService } from './service.js';
import { CreateKeyInput, UpdateKeyInput, KeyFilters, AssignKeyInput, ReturnKeyInput, KeyLogFilters } from './schemas.js';

export async function registerKeyRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest) => {
    const filters = KeyFilters.parse(request.query);
    const result = await keyService.listKeys(request.tenantId, filters);
    return { success: true, data: result.items, meta: result.meta };
  });

  // Alias: GET /inventory maps to the same list handler
  app.get('/inventory', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest) => {
    const filters = KeyFilters.parse(request.query);
    const result = await keyService.listKeys(request.tenantId, filters);
    return { success: true, data: result.items, meta: result.meta };
  });

  app.post('/', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateKeyInput.parse(request.body);
    const result = await keyService.createKey(request.tenantId, data);
    request.audit('create', 'key', result.id, { keyCode: data.keyCode });
    return reply.code(201).send({ success: true, data: result });
  });

  app.get('/stats', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest) => {
    const stats = await keyService.getKeyStats(request.tenantId);
    return { success: true, data: stats };
  });

  app.get('/logs', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest) => {
    const filters = KeyLogFilters.parse(request.query);
    const result = await keyService.listKeyLogs(request.tenantId, filters);
    return { success: true, data: result.items, meta: result.meta };
  });

  app.get('/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await keyService.getKey(request.tenantId, id);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Key not found' } });
    return { success: true, data: result };
  });

  app.patch('/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = UpdateKeyInput.parse(request.body);
    const result = await keyService.updateKey(request.tenantId, id, data);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Key not found' } });
    request.audit('update', 'key', result.id, data);
    return { success: true, data: result };
  });

  app.delete('/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await keyService.deleteKey(request.tenantId, id);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Key not found' } });
    request.audit('delete', 'key', result.id, {});
    return reply.code(204).send();
  });

  app.post('/:id/assign', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = AssignKeyInput.parse(request.body);
    const result = await keyService.assignKey(request.tenantId, id, data.toHolder, request.userId, data.notes);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Key not found' } });
    request.audit('assign', 'key', result.id, { toHolder: data.toHolder });
    return { success: true, data: result };
  });

  app.post('/:id/return', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = ReturnKeyInput.parse(request.body || {});
    const result = await keyService.returnKey(request.tenantId, id, request.userId, data.notes);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Key not found' } });
    request.audit('return', 'key', result.id, {});
    return { success: true, data: result };
  });
}
