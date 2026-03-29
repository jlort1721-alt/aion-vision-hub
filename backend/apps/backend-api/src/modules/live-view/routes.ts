import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { requireRole } from '../../plugins/auth.js';
import { db } from '../../db/client.js';
import { liveViewLayouts } from '../../db/schema/index.js';

export async function registerLiveViewRoutes(app: FastifyInstance) {
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
