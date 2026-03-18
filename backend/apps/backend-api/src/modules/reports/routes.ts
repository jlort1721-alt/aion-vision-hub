import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { reportService } from './service.js';
import { createReportSchema, reportQuerySchema } from './schemas.js';
import type { ApiResponse } from '@aion/shared-contracts';

export async function registerReportRoutes(app: FastifyInstance) {
  // ── GET / — List reports for tenant ─────────────────────────
  app.get(
    '/',
    { preHandler: [requireRole('tenant_admin', 'operator', 'viewer', 'auditor')] },
    async (request) => {
      const query = reportQuerySchema.parse(request.query);
      const { items, meta } = await reportService.list(request.tenantId, query);

      return { success: true, data: items, meta } satisfies ApiResponse;
    },
  );

  // ── POST / — Create report request ─────────────────────────
  app.post(
    '/',
    { preHandler: [requireRole('tenant_admin', 'operator')] },
    async (request, reply) => {
      const input = createReportSchema.parse(request.body);
      const report = await reportService.create(
        request.tenantId,
        request.userId,
        input,
      );

      return reply.code(201).send({
        success: true,
        data: report,
      } satisfies ApiResponse);
    },
  );

  // ── GET /:id — Get report status ────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('tenant_admin', 'operator', 'viewer', 'auditor')] },
    async (request) => {
      const report = await reportService.getById(
        request.params.id,
        request.tenantId,
      );

      return { success: true, data: report } satisfies ApiResponse;
    },
  );

  // ── GET /:id/export — Download report ──────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id/export',
    { preHandler: [requireRole('tenant_admin', 'operator', 'viewer', 'auditor')] },
    async (request) => {
      const exportData = await reportService.getExport(
        request.params.id,
        request.tenantId,
      );

      return { success: true, data: exportData } satisfies ApiResponse;
    },
  );
}
