import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { requireRole } from '../../plugins/auth.js';
import { sceneService } from './service.js';
import { createSceneSchema, updateSceneSchema, listScenesFilterSchema } from './schemas.js';
import type { ApiResponse } from '@aion/shared-contracts';

async function sceneRoutes(app: FastifyInstance) {
  // GET / — List scenes
  app.get(
    '/',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const filters = listScenesFilterSchema.parse(request.query);
      const { items, meta } = await sceneService.list(request.tenantId, filters);
      return { success: true, data: items, meta } satisfies ApiResponse;
    },
  );

  // POST / — Create scene
  app.post(
    '/',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const input = createSceneSchema.parse(request.body);
      const row = await sceneService.create(request.tenantId, request.userId, input);
      request.audit('scene.create', 'domotic_scene', row.id, { name: row.name });
      return reply.code(201).send({ success: true, data: row } satisfies ApiResponse);
    },
  );

  // PATCH /:id — Update scene
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request) => {
      const input = updateSceneSchema.parse(request.body);
      const row = await sceneService.update(request.params.id, request.tenantId, input);
      request.audit('scene.update', 'domotic_scene', row.id, { name: row.name });
      return { success: true, data: row } satisfies ApiResponse;
    },
  );

  // DELETE /:id — Delete scene
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const row = await sceneService.delete(request.params.id, request.tenantId);
      request.audit('scene.delete', 'domotic_scene', row.id, { name: row.name });
      return reply.code(204).send();
    },
  );

  // POST /:id/execute — Execute scene
  app.post<{ Params: { id: string } }>(
    '/:id/execute',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const execution = await sceneService.execute(request.params.id, request.tenantId, request.userId);
      request.audit('scene.execute', 'domotic_scene', request.params.id, { executionId: execution.id });
      return { success: true, data: execution } satisfies ApiResponse;
    },
  );

  // GET /executions — List scene executions
  app.get(
    '/executions',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const query = request.query as Record<string, string>;
      const sceneId = query.sceneId;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const executions = await sceneService.listExecutions(request.tenantId, sceneId, limit);
      return { success: true, data: executions } satisfies ApiResponse;
    },
  );
}

export const registerSceneRoutes = fp(sceneRoutes, {
  name: 'scene-routes',
});
