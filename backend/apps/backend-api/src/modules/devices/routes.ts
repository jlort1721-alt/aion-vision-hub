import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { enforcePlanLimit } from '../../plugins/plan-limits.js';
import { deviceService } from './service.js';
import { registerDeviceStreams, removeStreamFromMediaMTX, listMediaMTXStreams, buildRtspUrl } from '../../services/stream-bridge.js';
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
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin'), enforcePlanLimit('devices')],
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

  // ── POST /:id/register-stream — Register device stream in MediaMTX ─
  server.post<{ Params: { id: string } }>(
    '/:id/register-stream',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Devices'],
        summary: 'Register device RTSP stream in MediaMTX for live view',
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const device = await deviceService.getById(id, request.tenantId) as Record<string, unknown>;

      const result = await registerDeviceStreams({
        id: String(device.id),
        brand: String(device.brand || 'generic_onvif'),
        ipAddress: (device.ipAddress || device.ip_address || null) as string | null,
        port: (device.port || null) as number | null,
        rtspPort: (device.rtspPort || device.rtsp_port || 554) as number | null,
        username: (device.username || null) as string | null,
        password: (device.password || null) as string | null,
        channels: Number(device.channels) || 1,
        type: String(device.type || 'camera'),
        connectionType: (device.connectionType || device.connection_type || 'ip') as string | null,
      });

      await request.audit('device.stream.register', 'devices', id, {
        registered: result.registered,
        errors: result.errors,
      });

      return reply.send({ success: true, data: result });
    },
  );

  // ── POST /:id/unregister-stream — Remove device stream from MediaMTX ─
  server.post<{ Params: { id: string } }>(
    '/:id/unregister-stream',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Devices'],
        summary: 'Remove device stream from MediaMTX',
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      await removeStreamFromMediaMTX(id);
      return reply.send({ success: true });
    },
  );

  // ── GET /:id/rtsp-url — Get the generated RTSP URL for a device ─
  server.get<{ Params: { id: string }; Querystring: { channel?: string; substream?: string } }>(
    '/:id/rtsp-url',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Devices'],
        summary: 'Get generated RTSP URL for device (credentials masked)',
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const channel = parseInt(request.query.channel || '1', 10);
      const substream = request.query.substream === 'true';
      const device = await deviceService.getById(id, request.tenantId) as Record<string, unknown>;

      const rtspUrl = buildRtspUrl({
        brand: String(device.brand || 'generic_onvif'),
        ip: String(device.ipAddress || device.ip_address || ''),
        port: Number(device.rtspPort || device.rtsp_port || 554),
        username: device.username ? String(device.username) : undefined,
        password: device.password ? '****' : undefined,
        channel,
        substream,
      });

      const channels = Number(device.channels) || 1;
      return reply.send({
        success: true,
        data: {
          deviceId: id,
          channel,
          substream,
          rtspUrl,
          streamId: channels > 1 ? `${id}-ch${channel}` : id,
        },
      });
    },
  );

  // ── GET /streams/active — List active MediaMTX streams ────
  server.get(
    '/streams/active',
    {
      schema: {
        tags: ['Devices'],
        summary: 'List all active streams in MediaMTX',
      },
    },
    async (_request, reply) => {
      const data = await listMediaMTXStreams();
      return reply.send({ success: true, data });
    },
  );
}
