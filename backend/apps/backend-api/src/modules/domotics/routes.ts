import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { domoticService } from './service.js';
import { ewelinkMCP } from '../../services/ewelink-mcp.js';
import {
  createDomoticDeviceSchema, updateDomoticDeviceSchema,
  domoticFiltersSchema, domoticActionSchema,
} from './schemas.js';
import type { CreateDomoticDeviceInput, UpdateDomoticDeviceInput, DomoticFilters, DomoticActionInput } from './schemas.js';

export async function registerDomoticRoutes(app: FastifyInstance) {
  // ── eWeLink MCP endpoints ──────────────────────────────────
  app.get('/ewelink/status', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (_request, reply) => {
    return reply.send({ success: true, data: { configured: ewelinkMCP.isConfigured() } });
  });

  app.get('/ewelink/devices', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (_request, reply) => {
    if (!ewelinkMCP.isConfigured()) return reply.send({ success: true, data: [], message: 'eWeLink MCP not configured' });
    try {
      const devices = await ewelinkMCP.getDevices();
      return reply.send({ success: true, data: devices });
    } catch (err) {
      return reply.send({ success: false, error: (err as Error).message });
    }
  });

  app.post('/ewelink/:deviceId/toggle', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const { on } = request.body as { on: boolean };
    try {
      await ewelinkMCP.toggleDevice(deviceId, on);
      await request.audit('domotics.ewelink.toggle', 'ewelink', deviceId, { on });
      return reply.send({ success: true });
    } catch (err) {
      return reply.send({ success: false, error: (err as Error).message });
    }
  });

  app.post('/ewelink/:deviceId/control', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const { action } = request.body as { action: string };
    try {
      await ewelinkMCP.controlDevice(deviceId, action);
      await request.audit('domotics.ewelink.control', 'ewelink', deviceId, { action });
      return reply.send({ success: true });
    } catch (err) {
      return reply.send({ success: false, error: (err as Error).message });
    }
  });
  app.get<{ Querystring: DomoticFilters }>('/', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const filters = domoticFiltersSchema.parse(request.query);
    const data = await domoticService.list(request.tenantId, filters);
    return reply.send({ success: true, data });
  });

  // /devices sub-path (frontend calls /domotics/devices)
  app.get('/devices', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const data = await domoticService.list(request.tenantId, {});
    return reply.send({ success: true, data });
  });

  // /actions list (frontend calls /domotics/actions)
  app.get('/actions', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (_request, reply) => {
    return reply.send({ success: true, data: [] });
  });

  app.get<{ Params: { id: string } }>('/:id', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    // Validate UUID format to prevent "invalid input syntax" errors
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.params.id)) {
      return reply.code(400).send({ success: false, error: 'Invalid ID format' });
    }
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

  app.get<{ Params: { id: string } }>('/:id/actions', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const data = await domoticService.getActions(request.params.id, request.tenantId);
    return reply.send({ success: true, data });
  });
}
