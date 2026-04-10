import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { requireRole } from '../../plugins/auth.js';
import { pagingService } from './service.js';
import { broadcastSchema, broadcastFiltersSchema, pagingTemplateSchema } from './schemas.js';
import type { ApiResponse } from '@aion/shared-contracts';

async function pagingRoutes(app: FastifyInstance) {
  // POST /broadcast — Send broadcast message
  app.post(
    '/broadcast',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const input = broadcastSchema.parse(request.body);
      const row = await pagingService.broadcast(request.tenantId, request.userId, input);
      request.audit('paging.broadcast', 'paging_broadcast', row.id, {
        priority: row.priority,
        targetSites: input.targetSites,
      });
      return reply.code(201).send({ success: true, data: row } satisfies ApiResponse);
    },
  );

  // POST /emergency-broadcast — Send emergency broadcast
  app.post(
    '/emergency-broadcast',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const input = broadcastSchema.parse(request.body);
      const row = await pagingService.emergencyBroadcast(request.tenantId, request.userId, input);
      request.audit('paging.emergency', 'paging_broadcast', row.id, {
        priority: 'emergency',
        targetSites: input.targetSites,
      });
      return reply.code(201).send({ success: true, data: row } satisfies ApiResponse);
    },
  );

  // GET /zones — List available paging zones (sites)
  app.get(
    '/zones',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const zones = await pagingService.listZones(request.tenantId);
      return { success: true, data: zones } satisfies ApiResponse;
    },
  );

  // GET /history — Paginated broadcast history
  app.get(
    '/history',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const filters = broadcastFiltersSchema.parse(request.query);
      const { items, meta } = await pagingService.getHistory(request.tenantId, filters);
      return { success: true, data: items, meta } satisfies ApiResponse;
    },
  );

  // GET /templates — List paging templates
  app.get(
    '/templates',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const templates = await pagingService.listTemplates(request.tenantId);
      return { success: true, data: templates } satisfies ApiResponse;
    },
  );

  // POST /templates — Create paging template
  app.post(
    '/templates',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const input = pagingTemplateSchema.parse(request.body);
      const row = await pagingService.createTemplate(request.tenantId, input);
      return reply.code(201).send({ success: true, data: row } satisfies ApiResponse);
    },
  );

  // DELETE /templates/:id — Delete paging template
  app.delete<{ Params: { id: string } }>(
    '/templates/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await pagingService.deleteTemplate(request.params.id, request.tenantId);
      return reply.code(204).send();
    },
  );
}

export const registerPagingRoutes = fp(pagingRoutes, {
  name: 'paging-routes',
});
