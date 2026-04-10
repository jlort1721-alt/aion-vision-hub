import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { integrationService } from './service.js';
import {
  createIntegrationSchema,
  updateIntegrationSchema,
} from './schemas.js';
import type { ApiResponse } from '@aion/shared-contracts';
import { n8nWebhookClient } from '../../services/n8n-webhook-client.js';

export async function registerIntegrationRoutes(app: FastifyInstance) {
  // ── GET / — List integrations for tenant ────────────────────
  app.get(
    '/',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator', 'viewer')] },
    async (request) => {
      const items = await integrationService.list(request.tenantId);

      return {
        success: true,
        data: items,
        meta: { total: items.length, page: 1, perPage: items.length, totalPages: 1 },
      } satisfies ApiResponse;
    },
  );

  // ── GET /:id — Get single integration ───────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator', 'viewer')] },
    async (request) => {
      const integration = await integrationService.getById(
        request.params.id,
        request.tenantId,
      );

      return { success: true, data: integration } satisfies ApiResponse;
    },
  );

  // ── POST / — Create integration ─────────────────────────────
  app.post(
    '/',
    { preHandler: [requireRole('super_admin', 'tenant_admin')] },
    async (request, reply) => {
      const input = createIntegrationSchema.parse(request.body);
      const integration = await integrationService.create(request.tenantId, input);

      await request.audit('integration.create', 'integration', integration.id, {
        name: integration.name,
        type: integration.type,
      });

      return reply.code(201).send({
        success: true,
        data: integration,
      } satisfies ApiResponse);
    },
  );

  // ── PATCH /:id — Update integration ─────────────────────────
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('super_admin', 'tenant_admin')] },
    async (request) => {
      const input = updateIntegrationSchema.parse(request.body);
      const integration = await integrationService.update(
        request.params.id,
        request.tenantId,
        input,
      );

      await request.audit('integration.update', 'integration', request.params.id, {
        changes: Object.keys(input),
      });

      return { success: true, data: integration } satisfies ApiResponse;
    },
  );

  // ── DELETE /:id — Delete integration ────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('super_admin', 'tenant_admin')] },
    async (request, reply) => {
      await integrationService.delete(request.params.id, request.tenantId);

      await request.audit('integration.delete', 'integration', request.params.id);

      return reply.code(204).send();
    },
  );

  // ── GET /n8n/status — n8n health check ──────────────────────
  app.get('/n8n/status', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async () => {
    const health = await n8nWebhookClient.checkHealth();
    return { success: true, data: health };
  });

  // ── POST /:id/test — Test integration connectivity ──────────
  app.post<{ Params: { id: string } }>(
    '/:id/test',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request) => {
      const result = await integrationService.testConnectivity(
        request.params.id,
        request.tenantId,
      );

      await request.audit('integration.test', 'integration', request.params.id, {
        success: result.success,
      });

      return { success: true, data: result } satisfies ApiResponse;
    },
  );
}
