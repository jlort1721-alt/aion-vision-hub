import type { FastifyInstance } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import { requireRole } from '../../plugins/auth.js';
import { db } from '../../db/client.js';
import { liveViewLayouts } from '../../db/schema/index.js';

export async function registerLiveViewRoutes(app: FastifyInstance) {
  // ── GET /cameras/by-site — Cameras grouped by site ─────────
  app.get(
    '/cameras/by-site',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (_request, reply) => {
      try {
        const results = await db.execute(sql`
          SELECT c.id, c.name, c.channel_number, c.stream_key, c.status, c.is_lpr,
                 s.id as site_id, s.name as site_name
          FROM cameras c
          JOIN sites s ON c.site_id = s.id
          ORDER BY s.name, c.channel_number
        `);
        const rows = results as unknown as Array<Record<string, unknown>>;
        const grouped: Record<string, { id: string; name: string; cameras: unknown[] }> = {};
        for (const row of rows) {
          const siteId = row.site_id as string;
          if (!grouped[siteId]) {
            grouped[siteId] = { id: siteId, name: row.site_name as string, cameras: [] };
          }
          grouped[siteId].cameras.push({
            id: row.id, name: row.name, channel: row.channel_number,
            streamKey: row.stream_key, status: row.status, isLpr: row.is_lpr,
          });
        }
        return reply.send({ success: true, data: Object.values(grouped) });
      } catch {
        return reply.send({ success: true, data: [] });
      }
    },
  );

  // ── GET /cameras — List all cameras with filters ────────────
  app.get(
    '/cameras',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { site_id, status, is_lpr } = request.query as Record<string, string>;
      let query = sql`SELECT c.*, s.name as site_name FROM cameras c JOIN sites s ON c.site_id = s.id WHERE c.deleted_at IS NULL`;
      if (site_id) query = sql`${query} AND c.site_id = ${site_id}`;
      if (status) query = sql`${query} AND c.status = ${status}`;
      if (is_lpr === 'true') query = sql`${query} AND c.is_lpr = true`;
      query = sql`${query} ORDER BY s.name, c.channel_number`;
      const results = await db.execute(query);
      return reply.send({ success: true, data: results as unknown as Record<string, unknown>[] });
    },
  );

  // ── GET /cameras/:id/stream-info — Stream URLs for a camera ──
  app.get(
    '/cameras/:id/stream-info',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const results = await db.execute(sql`SELECT stream_key FROM cameras WHERE id = ${id}`);
      const cam = (results as unknown as Record<string, unknown>[])[0];
      if (!cam) return reply.code(404).send({ success: false, error: 'Camera not found' });
      const streamKey = cam.stream_key as string;
      return reply.send({
        success: true,
        data: {
          streamKey,
          mseUrl: `/go2rtc/api/ws?src=${streamKey}`,
          hlsUrl: `/go2rtc/api/stream.m3u8?src=${streamKey}`,
          mp4Url: `/go2rtc/api/stream.mp4?src=${streamKey}`,
          snapshotUrl: `/go2rtc/api/frame.jpeg?src=${streamKey}`,
        },
      });
    },
  );

  // ── POST /cameras/sync — Sync cameras status with go2rtc ────
  app.post(
    '/cameras/sync',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (_request, reply) => {
      try {
        const streamsResp = await fetch('http://localhost:1984/api/streams');
        const streams = (await streamsResp.json()) as Record<string, unknown>;
        let updated = 0;
        for (const [key, info] of Object.entries(streams)) {
          const hasProducers =
            Array.isArray((info as Record<string, unknown>).producers) &&
            ((info as Record<string, unknown>).producers as unknown[]).length > 0;
          await db.execute(
            sql`UPDATE cameras SET status = ${hasProducers ? 'online' : 'offline'}, updated_at = NOW() WHERE stream_key = ${key}`,
          );
          updated++;
        }
        return reply.send({ success: true, data: { synced: updated, totalStreams: Object.keys(streams).length } });
      } catch {
        return reply.send({ success: true, data: { synced: 0, error: 'go2rtc not reachable' } });
      }
    },
  );

  // ── GET /layouts — List layouts for the current user ─────────
  app.get(
    '/layouts',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request, reply) => {
      const layouts = await db
        .select()
        .from(liveViewLayouts)
        .where(eq(liveViewLayouts.userId, request.userId));
      return reply.send({ success: true, data: layouts });
    },
  );

  // ── POST /layouts — Save a new layout ───────────────────────
  app.post(
    '/layouts',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request, reply) => {
      const { name, grid, slots, isShared } = request.body as {
        name: string;
        grid: number;
        slots: unknown[];
        isShared?: boolean;
      };
      const [layout] = await db
        .insert(liveViewLayouts)
        .values({
          userId: request.userId,
          tenantId: request.tenantId,
          name,
          grid,
          slots: JSON.parse(JSON.stringify(slots ?? [])),
          isShared: isShared ?? false,
        })
        .returning();
      return reply.send({ success: true, data: layout });
    },
  );

  // ── DELETE /layouts/:id — Delete a layout ───────────────────
  app.delete(
    '/layouts/:id',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await db
        .delete(liveViewLayouts)
        .where(
          and(
            eq(liveViewLayouts.id, id),
            eq(liveViewLayouts.userId, request.userId),
          ),
        );
      return reply.code(204).send();
    },
  );

  // ── PATCH /layouts/:id/favorite — Toggle favorite ───────────
  app.patch(
    '/layouts/:id/favorite',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { isFavorite } = request.body as { isFavorite: boolean };
      const [updated] = await db
        .update(liveViewLayouts)
        .set({ isFavorite })
        .where(
          and(
            eq(liveViewLayouts.id, id),
            eq(liveViewLayouts.userId, request.userId),
          ),
        )
        .returning();
      return reply.send({ success: true, data: updated });
    },
  );
}
