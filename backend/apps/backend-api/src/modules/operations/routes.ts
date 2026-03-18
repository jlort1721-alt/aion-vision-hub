import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { operationsService } from './service.js';

export async function registerOperationsRoutes(app: FastifyInstance) {
  // ── GET /dashboard — Full consolidated operations dashboard ──────────────
  app.get(
    '/dashboard',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await operationsService.getDashboard(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /sites-status — Lightweight site status array ────────────────────
  app.get(
    '/sites-status',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await operationsService.getSitesStatus(request.tenantId);
      return reply.send({ success: true, data });
    },
  );
}
