import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { scheduledReportService } from './service.js';
import {
  createScheduledReportSchema,
  updateScheduledReportSchema,
  scheduledReportFiltersSchema,
} from './schemas.js';
import type {
  CreateScheduledReportInput,
  UpdateScheduledReportInput,
  ScheduledReportFilters,
} from './schemas.js';

export async function registerScheduledReportRoutes(app: FastifyInstance) {
  // ══════════════════════════════════════════════════════════
  // SCHEDULED REPORTS
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: ScheduledReportFilters }>(
    '/',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = scheduledReportFiltersSchema.parse(request.query);
      const result = await scheduledReportService.listReports(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await scheduledReportService.getReportById(request.params.id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: CreateScheduledReportInput }>(
    '/',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createScheduledReportSchema.parse(request.body);
      const data = await scheduledReportService.createReport(body, request.tenantId, request.userId);
      await request.audit('scheduled_report.create', 'scheduled_reports', data.id, { name: data.name, type: data.type });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateScheduledReportInput }>(
    '/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateScheduledReportSchema.parse(request.body);
      const data = await scheduledReportService.updateReport(request.params.id, body, request.tenantId);
      await request.audit('scheduled_report.update', 'scheduled_reports', data.id, { name: data.name });
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await scheduledReportService.deleteReport(request.params.id, request.tenantId);
      await request.audit('scheduled_report.delete', 'scheduled_reports', request.params.id);
      return reply.code(204).send();
    },
  );
}
