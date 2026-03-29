/**
 * Camera Events Routes
 *
 * Provides endpoints for querying recent camera/device events and
 * acknowledging them. Events are ingested by the Hikvision ISAPI polling
 * service and stored in the `events` table.
 */
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { db } from '../../db/client.js';
import { events } from '../../db/schema/index.js';
import { eq, and, desc, sql } from 'drizzle-orm';

export async function registerCameraEventRoutes(app: FastifyInstance) {

  // ── GET /recent — Last 50 events from the events table ────────────────────
  app.get<{ Querystring: { limit?: string; deviceId?: string; siteId?: string } }>(
    '/recent',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const limit = Math.min(Number(request.query.limit) || 50, 200);

      const conditions = [eq(events.tenantId, tenantId)];

      if (request.query.deviceId) {
        conditions.push(eq(events.deviceId, request.query.deviceId));
      }
      if (request.query.siteId) {
        conditions.push(eq(events.siteId, request.query.siteId));
      }

      const rows = await db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(desc(events.createdAt))
        .limit(limit);

      return reply.send({ success: true, data: rows });
    },
  );

  // ── POST /:id/acknowledge — Mark an event as acknowledged ─────────────────
  app.post<{ Params: { id: string }; Body: { notes?: string } }>(
    '/:id/acknowledge',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.tenantId;

      // Verify the event exists and belongs to the tenant
      const [existing] = await db
        .select({ id: events.id, status: events.status })
        .from(events)
        .where(and(eq(events.id, id), eq(events.tenantId, tenantId)))
        .limit(1);

      if (!existing) {
        return reply.code(404).send({ success: false, error: 'Event not found' });
      }

      if (existing.status === 'acknowledged' || existing.status === 'resolved') {
        return reply.send({
          success: true,
          data: { id, status: existing.status, message: 'Event already processed' },
        });
      }

      // Update the event status
      const [updated] = await db
        .update(events)
        .set({
          status: 'acknowledged',
          resolvedBy: request.userId,
          resolvedAt: new Date(),
          updatedAt: new Date(),
          metadata: sql`jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{acknowledgedNotes}',
            ${JSON.stringify(request.body.notes ?? '')}::jsonb
          )`,
        })
        .where(and(eq(events.id, id), eq(events.tenantId, tenantId)))
        .returning();

      await request.audit('event.acknowledge', 'events', id, {
        previousStatus: existing.status,
        notes: request.body.notes,
      });

      return reply.send({ success: true, data: updated });
    },
  );
}
