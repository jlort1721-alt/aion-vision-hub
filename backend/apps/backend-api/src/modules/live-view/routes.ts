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
