import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { emailService } from './service.js';
import {
  sendEmailSchema,
  sendEventAlertSchema,
  sendIncidentReportSchema,
  sendPeriodicReportSchema,
  sendEvidencePackageSchema,
  testConnectionSchema,
} from './schemas.js';
import type { ApiResponse } from '@aion/shared-contracts';

export async function registerEmailRoutes(app: FastifyInstance) {
  // ── GET /health — Email provider health check ─────────────
  app.get(
    '/health',
    { preHandler: [requireRole('tenant_admin', 'operator', 'viewer')] },
    async () => {
      const result = await emailService.healthCheck();

      return {
        success: true,
        data: {
          configured: emailService.isConfigured,
          ...result,
          provider: emailService.activeProvider,
        },
      } satisfies ApiResponse;
    },
  );

  // ── POST /test — Send test email ──────────────────────────
  app.post(
    '/test',
    { preHandler: [requireRole('tenant_admin')] },
    async (request) => {
      const input = testConnectionSchema.parse(request.body);
      const result = await emailService.testConnection(input.to, {
        tenantId: request.tenantId,
        userId: request.userId,
        userEmail: request.userEmail ?? 'unknown',
      });

      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ── POST /send — Send generic email ───────────────────────
  app.post(
    '/send',
    { preHandler: [requireRole('tenant_admin', 'operator')] },
    async (request) => {
      const input = sendEmailSchema.parse(request.body);
      const result = await emailService.sendGeneric(input, {
        tenantId: request.tenantId,
        userId: request.userId,
        userEmail: request.userEmail ?? 'unknown',
      });

      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ── POST /event-alert — Send event alert email ────────────
  app.post(
    '/event-alert',
    { preHandler: [requireRole('tenant_admin', 'operator')] },
    async (request) => {
      const input = sendEventAlertSchema.parse(request.body);
      const result = await emailService.sendEventAlert(input, {
        tenantId: request.tenantId,
        userId: request.userId,
        userEmail: request.userEmail ?? 'unknown',
      });

      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ── POST /incident-report — Send incident report ──────────
  app.post(
    '/incident-report',
    { preHandler: [requireRole('tenant_admin', 'operator')] },
    async (request) => {
      const input = sendIncidentReportSchema.parse(request.body);
      const result = await emailService.sendIncidentReport(input, {
        tenantId: request.tenantId,
        userId: request.userId,
        userEmail: request.userEmail ?? 'unknown',
      });

      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ── POST /periodic-report — Send periodic report ──────────
  app.post(
    '/periodic-report',
    { preHandler: [requireRole('tenant_admin', 'operator')] },
    async (request) => {
      const input = sendPeriodicReportSchema.parse(request.body);
      const result = await emailService.sendPeriodicReport(input, {
        tenantId: request.tenantId,
        userId: request.userId,
        userEmail: request.userEmail ?? 'unknown',
      });

      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ── POST /evidence-package — Send evidence/playback package ─
  app.post(
    '/evidence-package',
    { preHandler: [requireRole('tenant_admin', 'operator')] },
    async (request) => {
      const input = sendEvidencePackageSchema.parse(request.body);
      const result = await emailService.sendEvidencePackage(input, {
        tenantId: request.tenantId,
        userId: request.userId,
        userEmail: request.userEmail ?? 'unknown',
      });

      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ── GET /logs — Recent send logs ──────────────────────────
  app.get(
    '/logs',
    { preHandler: [requireRole('tenant_admin')] },
    async (request) => {
      const limit = Number((request.query as Record<string, string>).limit) || 50;
      const logs = emailService.getRecentLogs(limit);

      return {
        success: true,
        data: logs,
        meta: { total: logs.length, page: 1, perPage: limit, totalPages: 1 },
      } satisfies ApiResponse;
    },
  );
}
