import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { z } from 'zod';
import { clipsService } from './service.js';
import type { RequestClipInput } from './service.js';

const exportClipSchema = z.object({
  cameraId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  quality: z.enum(['high', 'medium', 'low']).default('high'),
});

type ExportClipInput = z.infer<typeof exportClipSchema>;

export async function registerClipRoutes(app: FastifyInstance) {

  // ── POST /export ── Create a clip from a camera stream ───────
  app.post<{ Body: ExportClipInput }>(
    '/export',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Clips'],
        summary: 'Export a video clip from a camera stream',
        description: 'Creates a clip by requesting MP4 from go2rtc. Stores the file and metadata.',
      },
    },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const userId = request.userId;
      const body = exportClipSchema.parse(request.body);

      try {
        const input: RequestClipInput = {
          cameraId: body.cameraId,
          startTime: body.startTime,
          endTime: body.endTime,
          quality: body.quality,
        };

        const data = await clipsService.requestClip(tenantId, userId, input);

        await request.audit('clip.export', 'clips', data.id, {
          cameraId: body.cameraId,
          durationSec: data.durationSec,
          quality: body.quality,
        });

        return reply.code(201).send({ success: true, data });
      } catch (err) {
        const message = (err as Error).message;

        if (message === 'CAMERA_NOT_FOUND') {
          return reply.code(404).send({
            success: false,
            error: { code: 'CAMERA_NOT_FOUND', message: 'Camera not found or not in your tenant' },
          });
        }
        if (message === 'INVALID_DURATION') {
          return reply.code(400).send({
            success: false,
            error: { code: 'INVALID_DURATION', message: 'Clip duration must be between 1 second and 1 hour' },
          });
        }
        if (message.startsWith('STREAM_ERROR:')) {
          return reply.code(502).send({
            success: false,
            error: { code: 'STREAM_ERROR', message: message.replace('STREAM_ERROR: ', '') },
          });
        }

        return reply.code(500).send({
          success: false,
          error: { code: 'EXPORT_FAILED', message },
        });
      }
    },
  );

  // ── GET / ── List clips for tenant (paginated) ───────────────
  app.get<{ Querystring: { page?: string; limit?: string; cameraId?: string } }>(
    '/',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Clips'],
        summary: 'List video clips for the current tenant',
      },
    },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const page = parseInt(request.query.page || '1', 10);
      const limit = parseInt(request.query.limit || '20', 10);
      const cameraId = request.query.cameraId;

      const result = await clipsService.listClips(tenantId, { page, limit, cameraId });

      return reply.send({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    },
  );

  // ── GET /:id/download ── Download a clip file ────────────────
  app.get<{ Params: { id: string } }>(
    '/:id/download',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Clips'],
        summary: 'Download a video clip file',
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.tenantId;

      const clip = await clipsService.getClip(id, tenantId);

      if (!clip) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Clip not found' },
        });
      }

      const fileBuffer = await clipsService.readClipFile(clip.file_path);

      if (!fileBuffer) {
        return reply.code(404).send({
          success: false,
          error: { code: 'FILE_MISSING', message: 'Clip file not found on disk' },
        });
      }

      return reply
        .header('Content-Type', 'video/mp4')
        .header('Content-Disposition', `attachment; filename="${clip.filename}"`)
        .header('Content-Length', clip.file_size)
        .send(fileBuffer);
    },
  );

  // ── DELETE /:id ── Delete a clip (tenant_admin+) ─────────────
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: {
        tags: ['Clips'],
        summary: 'Delete a video clip',
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.tenantId;

      const result = await clipsService.deleteClip(id, tenantId);

      if (!result.deleted) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Clip not found' },
        });
      }

      await request.audit('clip.delete', 'clips', id);

      return reply.send({ success: true, data: { id, deleted: true } });
    },
  );
}
