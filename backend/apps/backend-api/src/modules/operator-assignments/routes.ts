import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { db } from '../../db/client.js';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'operator-assignments' });

const assignSchema = z.object({
  userId: z.string().uuid(),
  siteId: z.string().uuid(),
});

const bulkAssignSchema = z.object({
  userId: z.string().uuid(),
  siteIds: z.array(z.string().uuid()).min(1).max(50),
});

export async function registerOperatorAssignmentRoutes(app: FastifyInstance) {

  /** GET / — List all operator-site assignments for the tenant */
  app.get(
    '/',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Operator Assignments'], summary: 'List all operator-site assignments' },
    },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const userId = (request.query as Record<string, string>).userId;

      let rows;
      if (userId) {
        rows = await db.execute(sql`
          SELECT osa.id, osa.user_id, osa.site_id, osa.created_at,
                 p.full_name AS user_name, p.email AS user_email,
                 s.name AS site_name
          FROM operator_site_assignments osa
          LEFT JOIN profiles p ON p.id = osa.user_id
          LEFT JOIN sites s ON s.id = osa.site_id
          WHERE osa.tenant_id = ${tenantId} AND osa.user_id = ${userId}
          ORDER BY s.name
        `);
      } else {
        rows = await db.execute(sql`
          SELECT osa.id, osa.user_id, osa.site_id, osa.created_at,
                 p.full_name AS user_name, p.email AS user_email,
                 s.name AS site_name
          FROM operator_site_assignments osa
          LEFT JOIN profiles p ON p.id = osa.user_id
          LEFT JOIN sites s ON s.id = osa.site_id
          WHERE osa.tenant_id = ${tenantId}
          ORDER BY p.full_name, s.name
        `);
      }

      return reply.send({ success: true, data: rows });
    },
  );

  /** POST / — Assign an operator to a site */
  app.post(
    '/',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Operator Assignments'], summary: 'Assign operator to a site' },
    },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { userId, siteId } = assignSchema.parse(request.body);

      try {
        const result = await db.execute(sql`
          INSERT INTO operator_site_assignments (tenant_id, user_id, site_id)
          VALUES (${tenantId}, ${userId}, ${siteId})
          ON CONFLICT (user_id, site_id) DO NOTHING
          RETURNING id
        `) as unknown as Array<{ id: string }>;

        if (!result.length) {
          return reply.code(409).send({
            success: false,
            error: { code: 'ALREADY_ASSIGNED', message: 'Operator is already assigned to this site' },
          });
        }

        await request.audit('operator_assignment.create', 'operator_site_assignments', result[0].id, {
          userId, siteId,
        });

        logger.info({ tenantId, userId, siteId }, 'Operator assigned to site');
        return reply.code(201).send({ success: true, data: { id: result[0].id, userId, siteId } });
      } catch (err) {
        logger.error({ err }, 'Failed to create operator assignment');
        return reply.code(500).send({ success: false, error: { code: 'DB_ERROR', message: 'Assignment failed' } });
      }
    },
  );

  /** POST /bulk — Assign operator to multiple sites at once */
  app.post(
    '/bulk',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Operator Assignments'], summary: 'Bulk assign operator to multiple sites' },
    },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const { userId, siteIds } = bulkAssignSchema.parse(request.body);

      const results: Array<{ siteId: string; status: 'created' | 'exists' | 'error' }> = [];

      for (const siteId of siteIds) {
        try {
          const result = await db.execute(sql`
            INSERT INTO operator_site_assignments (tenant_id, user_id, site_id)
            VALUES (${tenantId}, ${userId}, ${siteId})
            ON CONFLICT (user_id, site_id) DO NOTHING
            RETURNING id
          `) as unknown as Array<{ id: string }>;

          results.push({ siteId, status: result.length ? 'created' : 'exists' });
        } catch {
          results.push({ siteId, status: 'error' });
        }
      }

      await request.audit('operator_assignment.bulk', 'operator_site_assignments', userId, {
        siteIds, created: results.filter(r => r.status === 'created').length,
      });

      return reply.send({
        success: true,
        data: {
          userId,
          created: results.filter(r => r.status === 'created').length,
          existing: results.filter(r => r.status === 'exists').length,
          errors: results.filter(r => r.status === 'error').length,
          results,
        },
      });
    },
  );

  /** DELETE /:id — Remove a specific assignment */
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Operator Assignments'], summary: 'Remove operator-site assignment' },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.tenantId;

      const rows = await db.execute(sql`
        DELETE FROM operator_site_assignments
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING id, user_id, site_id
      `) as unknown as Array<{ id: string; user_id: string; site_id: string }>;

      if (!rows.length) {
        return reply.code(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Assignment not found' },
        });
      }

      await request.audit('operator_assignment.delete', 'operator_site_assignments', id, {
        userId: rows[0].user_id, siteId: rows[0].site_id,
      });

      return reply.send({ success: true, data: { id, deleted: true } });
    },
  );

  /** DELETE /user/:userId — Remove all assignments for a user */
  app.delete<{ Params: { userId: string } }>(
    '/user/:userId',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Operator Assignments'], summary: 'Remove all site assignments for an operator' },
    },
    async (request, reply) => {
      const { userId } = request.params;
      const tenantId = request.tenantId;

      const rows = await db.execute(sql`
        DELETE FROM operator_site_assignments
        WHERE user_id = ${userId} AND tenant_id = ${tenantId}
        RETURNING id
      `) as unknown as Array<{ id: string }>;

      await request.audit('operator_assignment.clear', 'operator_site_assignments', userId, {
        removedCount: rows.length,
      });

      return reply.send({ success: true, data: { userId, removedCount: rows.length } });
    },
  );
}
