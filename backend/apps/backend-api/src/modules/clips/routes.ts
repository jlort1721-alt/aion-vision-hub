import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { db } from '../../db/client.js';
import { sql } from 'drizzle-orm';
import { createLogger } from '@aion/common-utils';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

const logger = createLogger({ name: 'clips' });

const CLIPS_DIR = process.env.CLIPS_UPLOAD_DIR || path.resolve('uploads/clips');
const GO2RTC_BASE = process.env.GO2RTC_URL || 'http://localhost:1984';

async function ensureClipsDir(): Promise<void> {
  await fs.mkdir(CLIPS_DIR, { recursive: true });
}

const exportClipSchema = z.object({
  cameraId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  quality: z.enum(['high', 'medium', 'low']).default('high'),
});

type ExportClipInput = z.infer<typeof exportClipSchema>;

export async function registerClipRoutes(app: FastifyInstance) {
  await ensureClipsDir();

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

      // Look up camera/stream name from DB
      const cameraRows = await db.execute(sql`
        SELECT id, name, device_slug, device_id
        FROM cameras
        WHERE id = ${body.cameraId} AND tenant_id = ${tenantId}
        LIMIT 1
      `) as unknown as Array<{ id: string; name: string; device_slug: string; device_id: string }>;

      if (!cameraRows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'CAMERA_NOT_FOUND', message: 'Camera not found or not in your tenant' },
        });
      }

      const camera = cameraRows[0];
      const streamName = camera.device_slug || camera.id;

      // Calculate duration in seconds
      const start = new Date(body.startTime);
      const end = new Date(body.endTime);
      const durationSec = Math.ceil((end.getTime() - start.getTime()) / 1000);

      if (durationSec <= 0 || durationSec > 3600) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_DURATION', message: 'Clip duration must be between 1 second and 1 hour' },
        });
      }

      const clipId = crypto.randomUUID();
      const filename = `${clipId}.mp4`;
      const filePath = path.join(CLIPS_DIR, filename);

      try {
        // Fetch MP4 from go2rtc
        const streamUrl = `${GO2RTC_BASE}/api/stream.mp4?src=${encodeURIComponent(streamName)}&duration=${durationSec}`;
        logger.info({ streamUrl, clipId, durationSec }, 'Fetching clip from go2rtc');

        const resp = await fetch(streamUrl, {
          signal: AbortSignal.timeout(Math.max(durationSec * 1000 + 30000, 60000)),
        });

        if (!resp.ok) {
          logger.error({ status: resp.status, statusText: resp.statusText }, 'go2rtc stream.mp4 failed');
          return reply.code(502).send({
            success: false,
            error: { code: 'STREAM_ERROR', message: `go2rtc returned ${resp.status}: ${resp.statusText}` },
          });
        }

        const arrayBuffer = await resp.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.writeFile(filePath, buffer);

        logger.info({ clipId, size: buffer.length, durationSec }, 'Clip saved');

        // Store metadata in DB
        await db.execute(sql`
          INSERT INTO clips (id, tenant_id, camera_id, device_id, filename, file_path, file_size, duration_sec, quality, start_time, end_time, created_by, created_at)
          VALUES (
            ${clipId},
            ${tenantId},
            ${body.cameraId},
            ${camera.device_id},
            ${filename},
            ${filePath},
            ${buffer.length},
            ${durationSec},
            ${body.quality},
            ${body.startTime},
            ${body.endTime},
            ${userId},
            NOW()
          )
        `);

        await request.audit('clip.export', 'clips', clipId, {
          cameraId: body.cameraId,
          durationSec,
          quality: body.quality,
        });

        return reply.code(201).send({
          success: true,
          data: {
            id: clipId,
            cameraId: body.cameraId,
            cameraName: camera.name,
            filename,
            fileSize: buffer.length,
            durationSec,
            quality: body.quality,
            startTime: body.startTime,
            endTime: body.endTime,
          },
        });
      } catch (err) {
        logger.error({ err, clipId }, 'Clip export failed');
        // Clean up partial file
        await fs.unlink(filePath).catch(() => {});
        return reply.code(500).send({
          success: false,
          error: { code: 'EXPORT_FAILED', message: (err as Error).message },
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
      const page = Math.max(1, parseInt(request.query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10)));
      const offset = (page - 1) * limit;
      const cameraId = request.query.cameraId;

      try {
        let rows: unknown[];
        let countResult: unknown[];

        if (cameraId) {
          rows = await db.execute(sql`
            SELECT id, camera_id, filename, file_size, duration_sec, quality, start_time, end_time, created_by, created_at
            FROM clips
            WHERE tenant_id = ${tenantId} AND camera_id = ${cameraId}
            ORDER BY created_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `) as unknown as unknown[];

          countResult = await db.execute(sql`
            SELECT count(*)::int AS total FROM clips
            WHERE tenant_id = ${tenantId} AND camera_id = ${cameraId}
          `) as unknown as unknown[];
        } else {
          rows = await db.execute(sql`
            SELECT id, camera_id, filename, file_size, duration_sec, quality, start_time, end_time, created_by, created_at
            FROM clips
            WHERE tenant_id = ${tenantId}
            ORDER BY created_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `) as unknown as unknown[];

          countResult = await db.execute(sql`
            SELECT count(*)::int AS total FROM clips
            WHERE tenant_id = ${tenantId}
          `) as unknown as unknown[];
        }

        const total = (countResult as Array<{ total: number }>)[0]?.total ?? 0;

        return reply.send({
          success: true,
          data: rows,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
      } catch (err) {
        // Table may not exist yet — return empty result gracefully
        logger.warn({ err: (err as Error).message }, 'Clips query failed (table may not exist)');
        return reply.send({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }
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

      const rows = await db.execute(sql`
        SELECT id, filename, file_path, file_size
        FROM clips
        WHERE id = ${id} AND tenant_id = ${tenantId}
        LIMIT 1
      `) as unknown as Array<{ id: string; filename: string; file_path: string; file_size: number }>;

      if (!rows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Clip not found' },
        });
      }

      const clip = rows[0];

      try {
        const fileBuffer = await fs.readFile(clip.file_path);
        return reply
          .header('Content-Type', 'video/mp4')
          .header('Content-Disposition', `attachment; filename="${clip.filename}"`)
          .header('Content-Length', clip.file_size)
          .send(fileBuffer);
      } catch {
        return reply.code(404).send({
          success: false,
          error: { code: 'FILE_MISSING', message: 'Clip file not found on disk' },
        });
      }
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

      const rows = await db.execute(sql`
        DELETE FROM clips
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING id, file_path
      `) as unknown as Array<{ id: string; file_path: string }>;

      if (!rows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Clip not found' },
        });
      }

      const { file_path: filePath } = rows[0];
      await fs.unlink(filePath).catch((err) => {
        logger.warn({ err, filePath }, 'Failed to delete clip file from disk');
      });

      await request.audit('clip.delete', 'clips', id);

      return reply.send({ success: true, data: { id, deleted: true } });
    },
  );
}
