import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { deviceService } from './service.js';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import '@fastify/swagger';
import {
  createDeviceSchema,
  updateDeviceSchema,
  deviceFiltersSchema,
} from './schemas.js';
import type { CreateDeviceInput, UpdateDeviceInput, DeviceFilters } from './schemas.js';

export async function registerDeviceRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // ── GET / — List devices for tenant ───────────────────────
  server.get<{ Querystring: DeviceFilters }>(
    '/',
    {
      schema: {
        tags: ['Devices'],
        summary: 'List devices',
        description: 'Returns a paginated list of all devices registered to the tenant.',
        querystring: deviceFiltersSchema,
      },
    },
    async (request, reply) => {
      const data = await deviceService.list(request.tenantId, request.query);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /:id — Get device by ID ──────────────────────────
  server.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        tags: ['Devices'],
        summary: 'Get device details',
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const data = await deviceService.getById(id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── POST / — Create device (operator+) ───────────────────
  server.post<{ Body: CreateDeviceInput }>(
    '/',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Devices'],
        summary: 'Create a new device',
        body: createDeviceSchema,
      },
    },
    async (request, reply) => {
      const data = await deviceService.create(request.body, request.tenantId);

      await request.audit('device.create', 'devices', data.id, {
        name: data.name,
        brand: data.brand,
        siteId: data.siteId,
      });

      return reply.code(201).send({ success: true, data });
    },
  );

  // ── PATCH /:id — Update device ───────────────────────────
  server.patch<{ Params: { id: string }; Body: UpdateDeviceInput }>(
    '/:id',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Devices'],
        summary: 'Update an existing device',
        body: updateDeviceSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const data = await deviceService.update(id, request.body, request.tenantId);

      await request.audit('device.update', 'devices', data.id, request.body);

      return reply.send({ success: true, data });
    },
  );

  // ── DELETE /:id — Delete device (admin only) ─────────────
  server.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: {
        tags: ['Devices'],
        summary: 'Delete a device',
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      await deviceService.delete(id, request.tenantId);

      await request.audit('device.delete', 'devices', id);

      return reply.code(204).send();
    },
  );

  // ── POST /:id/test — Test device connection via public IP ─
  server.post<{ Params: { id: string } }>(
    '/:id/test',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Devices'],
        summary: 'Test connectivity to the device endpoint',
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const data = await deviceService.healthCheck(id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /:id/health — Real TCP health check via WAN IP ────
  server.get<{ Params: { id: string } }>(
    '/:id/health',
    {
      schema: {
        tags: ['Devices'],
        summary: 'Get health report for device over TCP',
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const data = await deviceService.healthCheck(id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );
}
