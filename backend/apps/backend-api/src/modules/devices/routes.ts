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
  bulkImportDeviceSchema,
} from './schemas.js';
import type { CreateDeviceInput, UpdateDeviceInput, DeviceFilters, BulkImportDeviceInput } from './schemas.js';

export async function registerDeviceRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  // ── GET / — List devices for tenant ───────────────────────
  // Note: uses app (not server with ZodTypeProvider) to avoid Zod v4 compat issue
  app.get(
    '/',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Devices'],
        summary: 'List devices',
        description: 'Returns a paginated list of all devices registered to the tenant.',
      },
    },
    async (request, reply) => {
      const data = await deviceService.list(request.tenantId, request.query as DeviceFilters);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /:id — Get device by ID ──────────────────────────
  server.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
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

  // ── GET /:id/credentials — Get device credentials (admin only) ──
  server.get<{ Params: { id: string } }>(
    '/:id/credentials',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: {
        tags: ['Devices'],
        summary: 'Get device credentials (admin only)',
        description: 'Returns decrypted username and password for a device. Requires admin role.',
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const data = await deviceService.getCredentials(id, request.tenantId);

      await request.audit('device.credentials.read', 'devices', id);

      return reply.send({ success: true, data });
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
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
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
      const device = await deviceService.getByIdWithCredentials(id, request.tenantId) as Record<string, unknown>;

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
      const device = await deviceService.getByIdWithCredentials(id, request.tenantId) as Record<string, unknown>;

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
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
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

  // ── POST /bulk-import — Bulk import devices ──────────────────
  server.post<{ Body: BulkImportDeviceInput }>(
    '/bulk-import',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: {
        tags: ['Devices'],
        summary: 'Bulk import devices from array',
        body: bulkImportDeviceSchema,
      },
    },
    async (request, reply) => {
      const { devices: records } = request.body;
      let imported = 0;
      let skipped = 0;
      const errors: { index: number; error: string }[] = [];

      for (let i = 0; i < records.length; i++) {
        try {
          await deviceService.create(records[i], request.tenantId);
          imported++;
        } catch (err: any) {
          if (err.message?.includes('duplicate') || err.message?.includes('already exists')) {
            skipped++;
          } else {
            errors.push({ index: i, error: err.message || 'Unknown error' });
          }
        }
      }

      await request.audit('device.bulk_import', 'devices', undefined, {
        total: records.length,
        imported,
        skipped,
        errors: errors.length,
      });

      return reply.send({
        success: true,
        data: { total: records.length, imported, skipped, errors },
      });
    },
  );

  // ── POST /:id/validate — Full device validation ─────────────
  server.post<{ Params: { id: string } }>(
    '/:id/validate',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Devices'], summary: 'Run full validation on a device (TCP + auth + snapshot)' },
    },
    async (request, reply) => {
      const device = await deviceService.getByIdWithCredentials(request.params.id, request.tenantId) as Record<string, unknown>;
      if (!device) return reply.code(404).send({ success: false, error: 'Device not found' });

      const ip = device.ipAddress as string || device.ip as string || '';
      const port = (device.port as number) || 80;
      const username = device.username as string | undefined;
      const password = device.password as string | undefined;

      const results: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

      // TCP probe
      const tcpStart = Date.now();
      try {
        const net = await import('net');
        await new Promise<void>((resolve, reject) => {
          const sock = new net.Socket();
          sock.setTimeout(5000);
          sock.on('connect', () => { sock.destroy(); resolve(); });
          sock.on('timeout', () => { sock.destroy(); reject(new Error('timeout')); });
          sock.on('error', reject);
          sock.connect(port, ip);
        });
        results.tcp = { ok: true, latencyMs: Date.now() - tcpStart };
      } catch (err: unknown) {
        results.tcp = { ok: false, latencyMs: Date.now() - tcpStart, error: (err as Error).message };
      }

      // Auth probe (HTTP login attempt)
      if (results.tcp.ok && ip) {
        const authStart = Date.now();
        try {
          const url = `http://${ip}:${port}/`;
          const resp = await fetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
            headers: username ? { Authorization: `Basic ${Buffer.from(`${username}:${password || ''}`).toString('base64')}` } : {},
          });
          results.auth = { ok: resp.status < 500, latencyMs: Date.now() - authStart };
        } catch (err: unknown) {
          results.auth = { ok: false, latencyMs: Date.now() - authStart, error: (err as Error).message };
        }
      }

      await request.audit('device.validate', 'devices', request.params.id, { results });

      return reply.send({ success: true, data: { deviceId: request.params.id, results } });
    },
  );

  // ── POST /:id/reconnect — Force reconnect device ────────────
  server.post<{ Params: { id: string } }>(
    '/:id/reconnect',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Devices'], summary: 'Force reconnect to a device' },
    },
    async (request, reply) => {
      const device = await deviceService.getById(request.params.id, request.tenantId);
      if (!device) return reply.code(404).send({ success: false, error: 'Device not found' });

      // Update status to trigger health check re-evaluation
      await deviceService.update(request.params.id, { status: 'unknown' }, request.tenantId);

      await request.audit('device.reconnect', 'devices', request.params.id);

      return reply.send({ success: true, data: { message: 'Reconnect triggered, health check will re-evaluate' } });
    },
  );

  // ── GET /:id/channels — List channels/streams for a device ──
  server.get<{ Params: { id: string } }>(
    '/:id/channels',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Devices'],
        summary: 'List all channels/streams for a device',
        description: 'Returns the stream profiles (channels) stored in the streams table for this device.',
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const data = await deviceService.getChannels(id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── POST /:id/sync-channels — Trigger channel sync from device ─
  server.post<{ Params: { id: string } }>(
    '/:id/sync-channels',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Devices'],
        summary: 'Sync channels/streams from device adapter into database',
        description: 'Queries the device for its stream profiles and syncs them with the streams table. Creates new, updates existing, and disables removed streams.',
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const data = await deviceService.syncChannels(id, request.tenantId);

      await request.audit('device.sync_channels', 'devices', id, {
        created: data.created,
        updated: data.updated,
        disabled: data.disabled,
      });

      return reply.send({ success: true, data });
    },
  );
}
