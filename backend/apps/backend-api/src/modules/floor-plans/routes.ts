import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { db } from '../../db/client.js';
import { eq, and, sql } from 'drizzle-orm';
import { floorPlanPositions } from '../../db/schema/index.js';
import { createLogger } from '@aion/common-utils';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { z } from 'zod';

const logger = createLogger({ name: 'floor-plans' });

const UPLOAD_DIR = process.env.FLOOR_PLAN_UPLOAD_DIR || path.resolve('uploads/floor-plans');
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function registerFloorPlanRoutes(app: FastifyInstance) {
  await ensureUploadDir();

  // ── POST /:siteId ── Upload floor plan image ─────────────────
  app.post<{ Params: { siteId: string } }>(
    '/:siteId',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Floor Plans'],
        summary: 'Upload a floor plan image for a site',
        description: 'Accepts raw image body (PNG, JPEG, WebP, SVG). Set Content-Type header to the image MIME type. Max 20 MB.',
      },
    },
    async (request, reply) => {
      const { siteId } = request.params;
      const tenantId = request.tenantId;
      const contentType = (request.headers['content-type'] || '').split(';')[0].trim();

      if (!ALLOWED_MIME_TYPES.includes(contentType)) {
        return reply.code(400).send({
          success: false,
          error: { code: 'INVALID_MIME_TYPE', message: `Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` },
        });
      }

      // Collect body as buffer
      const chunks: Buffer[] = [];
      let totalSize = 0;

      for await (const chunk of request.raw) {
        totalSize += chunk.length;
        if (totalSize > MAX_FILE_SIZE) {
          return reply.code(413).send({
            success: false,
            error: { code: 'FILE_TOO_LARGE', message: `Max file size is ${MAX_FILE_SIZE / 1024 / 1024} MB` },
          });
        }
        chunks.push(chunk as Buffer);
      }

      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) {
        return reply.code(400).send({
          success: false,
          error: { code: 'EMPTY_BODY', message: 'Request body is empty' },
        });
      }

      const ext = contentType === 'image/png' ? '.png'
        : contentType === 'image/jpeg' ? '.jpg'
        : contentType === 'image/webp' ? '.webp'
        : '.svg';
      const fileId = crypto.randomUUID();
      const filename = `${fileId}${ext}`;
      const filePath = path.join(UPLOAD_DIR, filename);

      await fs.writeFile(filePath, buffer);
      logger.info({ siteId, tenantId, filename, size: buffer.length }, 'Floor plan uploaded');

      try {
        await db.execute(sql`
          INSERT INTO floor_plans (id, tenant_id, site_id, filename, mime_type, file_size, file_path, created_at)
          VALUES (
            ${fileId},
            ${tenantId},
            ${siteId},
            ${filename},
            ${contentType},
            ${buffer.length},
            ${filePath},
            NOW()
          )
          ON CONFLICT (tenant_id, site_id) DO UPDATE SET
            filename = EXCLUDED.filename,
            mime_type = EXCLUDED.mime_type,
            file_size = EXCLUDED.file_size,
            file_path = EXCLUDED.file_path,
            updated_at = NOW()
        `);
      } catch (err) {
        logger.error({ err }, 'Failed to persist floor plan metadata');
        // Clean up the file if DB insert fails
        await fs.unlink(filePath).catch(() => {});
        return reply.code(500).send({
          success: false,
          error: { code: 'DB_ERROR', message: 'Failed to save floor plan metadata' },
        });
      }

      await request.audit('floor_plan.upload', 'floor_plans', fileId, {
        siteId,
        filename,
        size: buffer.length,
      });

      return reply.code(201).send({
        success: true,
        data: { id: fileId, siteId, filename, mimeType: contentType, fileSize: buffer.length },
      });
    },
  );

  // ── GET / ── List all floor plans for tenant ─────────────────
  app.get(
    '/',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Floor Plans'],
        summary: 'List all floor plans for the current tenant',
      },
    },
    async (request, reply) => {
      const tenantId = request.tenantId;

      const rows = await db.execute(sql`
        SELECT id, site_id, filename, mime_type, file_size, created_at, updated_at
        FROM floor_plans
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
      `);

      return reply.send({ success: true, data: rows });
    },
  );

  // ── GET /:siteId ── Get floor plan for a specific site ───────
  app.get<{ Params: { siteId: string } }>(
    '/:siteId',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Floor Plans'],
        summary: 'Get floor plan for a specific site',
      },
    },
    async (request, reply) => {
      const { siteId } = request.params;
      const tenantId = request.tenantId;

      const rows = await db.execute(sql`
        SELECT id, site_id, filename, mime_type, file_size, file_path, created_at, updated_at
        FROM floor_plans
        WHERE tenant_id = ${tenantId} AND site_id = ${siteId}
        LIMIT 1
      `) as unknown as Array<{ file_path: string; mime_type: string; [k: string]: unknown }>;

      if (!rows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No floor plan found for this site' },
        });
      }

      const row = rows[0];

      // If Accept header wants the image, serve the file directly
      const accept = request.headers.accept || '';
      if (accept.includes('image/') || accept.includes('*/*')) {
        try {
          const fileBuffer = await fs.readFile(row.file_path);
          return reply
            .header('Content-Type', row.mime_type)
            .header('Content-Disposition', `inline; filename="${row.filename}"`)
            .send(fileBuffer);
        } catch {
          return reply.code(404).send({
            success: false,
            error: { code: 'FILE_MISSING', message: 'Floor plan file not found on disk' },
          });
        }
      }

      // Otherwise return metadata JSON
      const { file_path: _fp, ...meta } = row;
      return reply.send({ success: true, data: meta });
    },
  );

  // ── DELETE /:siteId ── Delete floor plan (tenant_admin+) ─────
  app.delete<{ Params: { siteId: string } }>(
    '/:siteId',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: {
        tags: ['Floor Plans'],
        summary: 'Delete floor plan for a site',
      },
    },
    async (request, reply) => {
      const { siteId } = request.params;
      const tenantId = request.tenantId;

      const rows = await db.execute(sql`
        DELETE FROM floor_plans
        WHERE tenant_id = ${tenantId} AND site_id = ${siteId}
        RETURNING id, file_path
      `) as unknown as Array<{ id: string; file_path: string }>;

      if (!rows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'No floor plan found for this site' },
        });
      }

      // Remove file from disk
      const { id, file_path: filePath } = rows[0];
      await fs.unlink(filePath).catch((err) => {
        logger.warn({ err, filePath }, 'Failed to delete floor plan file from disk');
      });

      await request.audit('floor_plan.delete', 'floor_plans', id, { siteId });

      return reply.send({ success: true, data: { id, siteId, deleted: true } });
    },
  );

  // ══════════════════════════════════════════════════════════
  // DEVICE POSITIONS ON FLOOR PLAN
  // ══════════════════════════════════════════════════════════

  const positionSchema = z.object({
    positions: z.array(z.object({
      deviceId: z.string().uuid(),
      x: z.number().min(0).max(99999),
      y: z.number().min(0).max(99999),
    })).min(1).max(500),
  });

  // GET /:siteId/positions — list device positions for a site
  app.get<{ Params: { siteId: string } }>(
    '/:siteId/positions',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Floor Plans'], summary: 'Get device positions on floor plan' },
    },
    async (request, reply) => {
      const rows = await db
        .select({
          id: floorPlanPositions.id,
          deviceId: floorPlanPositions.deviceId,
          x: floorPlanPositions.x,
          y: floorPlanPositions.y,
        })
        .from(floorPlanPositions)
        .where(
          and(
            eq(floorPlanPositions.tenantId, request.tenantId),
            eq(floorPlanPositions.siteId, request.params.siteId),
          ),
        );

      return reply.send({ success: true, data: rows });
    },
  );

  // PUT /:siteId/positions — bulk upsert device positions
  app.put<{ Params: { siteId: string } }>(
    '/:siteId/positions',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Floor Plans'], summary: 'Save device positions on floor plan' },
    },
    async (request, reply) => {
      const { siteId } = request.params;
      const tenantId = request.tenantId;
      const body = positionSchema.parse(request.body);

      // Upsert each position
      for (const pos of body.positions) {
        await db
          .insert(floorPlanPositions)
          .values({
            tenantId,
            siteId,
            deviceId: pos.deviceId,
            x: String(pos.x),
            y: String(pos.y),
          })
          .onConflictDoUpdate({
            target: [floorPlanPositions.siteId, floorPlanPositions.deviceId],
            set: {
              x: String(pos.x),
              y: String(pos.y),
              updatedAt: new Date(),
            },
          });
      }

      await request.audit('floor_plan.positions_update', 'floor_plan_positions', undefined, {
        siteId,
        count: body.positions.length,
      });

      return reply.send({ success: true, data: { updated: body.positions.length } });
    },
  );
}
