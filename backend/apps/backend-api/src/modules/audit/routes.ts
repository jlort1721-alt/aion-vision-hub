import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { auditService } from './service.js';
import { auditQuerySchema, auditStatsQuerySchema } from './schemas.js';
import type { ApiResponse } from '@aion/shared-contracts';

export async function registerAuditRoutes(app: FastifyInstance) {
  // ── GET /logs — List audit logs with filters + pagination ───
  app.get(
    '/logs',
    { preHandler: [requireRole('tenant_admin', 'super_admin', 'auditor')] },
    async (request) => {
      const query = auditQuerySchema.parse(request.query);
      const { items, meta } = await auditService.list(request.tenantId, query);

      return { success: true, data: items, meta } satisfies ApiResponse;
    },
  );

  // ── GET /stats — Audit statistics ───────────────────────────
  app.get(
    '/stats',
    { preHandler: [requireRole('tenant_admin', 'super_admin', 'auditor')] },
    async (request) => {
      const query = auditStatsQuerySchema.parse(request.query);
      const stats = await auditService.getStats(request.tenantId, query);

      return { success: true, data: stats } satisfies ApiResponse;
    },
  );
}
