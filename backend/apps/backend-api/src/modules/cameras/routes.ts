import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { cameraService } from './service.js';
import type { CameraFilters, CreateCameraInput, UpdateCameraInput } from './service.js';

export async function registerCamerasRoutes(app: FastifyInstance) {
  // ── GET / — List cameras for tenant (optional filters) ──────────
  app.get<{ Querystring: CameraFilters }>(
    '/',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Cameras'],
        summary: 'List cameras',
        description: 'Returns all cameras for the tenant, optionally filtered by site_id, brand, or status.',
      },
    },
    async (request, reply) => {
      const filters: CameraFilters = {
        site_id: (request.query as Record<string, string>).site_id,
        brand: (request.query as Record<string, string>).brand,
        status: (request.query as Record<string, string>).status,
      };
      const data = await cameraService.list(request.tenantId, filters);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /by-site — Cameras grouped by site ──────────────────────
  app.get(
    '/by-site',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Cameras'],
        summary: 'Cameras grouped by site',
        description: 'Returns cameras organized as { [siteName]: Camera[] }.',
      },
    },
    async (request, reply) => {
      const data = await cameraService.getBySite(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /:id — Get camera by ID ────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Cameras'],
        summary: 'Get camera details',
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const data = await cameraService.getById(id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── POST / — Create camera (operator+) ─────────────────────────
  app.post<{ Body: CreateCameraInput }>(
    '/',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Cameras'],
        summary: 'Create a new camera',
      },
    },
    async (request, reply) => {
      const data = await cameraService.create(request.body, request.tenantId);

      await request.audit('camera.create', 'cameras', (data as Record<string, unknown>).id as string, {
        name: (data as Record<string, unknown>).name as string,
        brand: (data as Record<string, unknown>).brand as string,
      });

      return reply.code(201).send({ success: true, data });
    },
  );

  // ── PATCH /:id — Update camera ─────────────────────────────────
  app.patch<{ Params: { id: string }; Body: UpdateCameraInput }>(
    '/:id',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Cameras'],
        summary: 'Update an existing camera',
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const data = await cameraService.update(id, request.body, request.tenantId);

      await request.audit('camera.update', 'cameras', id, request.body as Record<string, unknown>);

      return reply.send({ success: true, data });
    },
  );

  // ── DELETE /:id — Delete camera (admin only) ───────────────────
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: {
        tags: ['Cameras'],
        summary: 'Delete a camera',
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      await cameraService.delete(id, request.tenantId);

      await request.audit('camera.delete', 'cameras', id);

      return reply.code(204).send();
    },
  );

  // ── POST /sync-status — Sync camera statuses from go2rtc ───────
  app.post(
    '/sync-status',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Cameras'],
        summary: 'Sync camera statuses from go2rtc',
        description: 'Queries go2rtc API at http://localhost:1984/api/streams and updates camera status based on active producers.',
      },
    },
    async (request, reply) => {
      const data = await cameraService.syncStatus(request.tenantId);

      await request.audit('camera.sync_status', 'cameras', undefined, data as Record<string, unknown>);

      return reply.send({ success: true, data });
    },
  );

  // ── POST /bulk-create — Bulk create cameras ────────────────────
  app.post<{ Body: { cameras: CreateCameraInput[] } }>(
    '/bulk-create',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Cameras'],
        summary: 'Bulk create cameras',
        description: 'Create many cameras at once from an array.',
      },
    },
    async (request, reply) => {
      const { cameras } = request.body;
      const data = await cameraService.bulkCreate(cameras, request.tenantId);

      await request.audit('camera.bulk_create', 'cameras', undefined, {
        total: data.total,
        created: data.created,
        errors: data.errors.length,
      });

      return reply.code(201).send({ success: true, data });
    },
  );
}
