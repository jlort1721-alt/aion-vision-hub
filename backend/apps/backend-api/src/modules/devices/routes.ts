import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { deviceService } from './service.js';
import {
  createDeviceSchema,
  updateDeviceSchema,
  deviceFiltersSchema,
  testDeviceConnectionSchema,
} from './schemas.js';
import type { CreateDeviceInput, UpdateDeviceInput, DeviceFilters } from './schemas.js';

export async function registerDeviceRoutes(app: FastifyInstance) {
  // ── GET / — List devices for tenant ───────────────────────
  app.get<{ Querystring: DeviceFilters }>(
    '/',
    async (request, reply) => {
      const filters = deviceFiltersSchema.parse(request.query);
      const data = await deviceService.list(request.tenantId, filters);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /:id — Get device by ID ──────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const data = await deviceService.getById(request.params.id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── POST / — Create device (operator+) ───────────────────
  app.post<{ Body: CreateDeviceInput }>(
    '/',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createDeviceSchema.parse(request.body);
      const data = await deviceService.create(body, request.tenantId);

      await request.audit('device.create', 'devices', data.id, {
        name: data.name,
        brand: data.brand,
        siteId: data.siteId,
      });

      return reply.code(201).send({ success: true, data });
    },
  );

  // ── PATCH /:id — Update device ───────────────────────────
  app.patch<{ Params: { id: string }; Body: UpdateDeviceInput }>(
    '/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateDeviceSchema.parse(request.body);
      const data = await deviceService.update(request.params.id, body, request.tenantId);

      await request.audit('device.update', 'devices', data.id, body);

      return reply.send({ success: true, data });
    },
  );

  // ── DELETE /:id — Delete device (admin only) ─────────────
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await deviceService.delete(request.params.id, request.tenantId);

      await request.audit('device.delete', 'devices', request.params.id);

      return reply.code(204).send();
    },
  );

  // ── POST /:id/test — Test device connection ──────────────
  // Proxies the request to the gateway associated with the device.
  app.post<{ Params: { id: string } }>(
    '/:id/test',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const device = await deviceService.getById(request.params.id, request.tenantId);
      const overrides = testDeviceConnectionSchema.parse(request.body ?? {});

      // Build the payload to forward to the gateway
      const testPayload = {
        ip: overrides.ip ?? device.ip,
        port: overrides.port ?? device.port,
        brand: overrides.brand ?? device.brand,
        // Credentials would be resolved from the credentialRef in production
        credentialRef: device.credentialRef,
      };

      // TODO: proxy to gateway via internal HTTP/gRPC call
      // const result = await gatewayClient.testConnection(device.gatewayId, testPayload);

      // Placeholder response until gateway integration is wired
      const result = {
        success: true,
        message: 'Connection test queued',
        device: { id: device.id, ip: testPayload.ip, port: testPayload.port },
      };

      return reply.send({ success: true, data: result });
    },
  );

  // ── GET /:id/health — Get device health status ───────────
  app.get<{ Params: { id: string } }>(
    '/:id/health',
    async (request, reply) => {
      const device = await deviceService.getById(request.params.id, request.tenantId);

      // TODO: query the gateway for real-time health
      // const health = await gatewayClient.getHealth(device.gatewayId, device.id);

      const health = {
        deviceId: device.id,
        status: device.status,
        lastSeenAt: device.lastSeenAt,
        ip: device.ip,
        port: device.port,
        online: device.status === 'online',
        latencyMs: null as number | null,
        checkedAt: new Date().toISOString(),
      };

      return reply.send({ success: true, data: health });
    },
  );
}
