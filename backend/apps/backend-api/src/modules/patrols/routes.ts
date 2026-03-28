import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { patrolService } from './service.js';
import {
  createRouteSchema,
  updateRouteSchema,
  routeFiltersSchema,
  createCheckpointSchema,
  updateCheckpointSchema,
  createPatrolLogSchema,
  patrolLogFiltersSchema,
} from './schemas.js';
import type {
  CreateRouteInput,
  UpdateRouteInput,
  RouteFilters,
  CreateCheckpointInput,
  UpdateCheckpointInput,
  CreatePatrolLogInput,
  PatrolLogFilters,
} from './schemas.js';

export async function registerPatrolRoutes(app: FastifyInstance) {
  // ══════════════════════════════════════════════════════════
  // PATROL ROUTES
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: RouteFilters }>(
    '/routes',
    async (request, reply) => {
      const filters = routeFiltersSchema.parse(request.query);
      const result = await patrolService.listRoutes(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/routes/:id',
    async (request, reply) => {
      const data = await patrolService.getRouteById(request.params.id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: CreateRouteInput }>(
    '/routes',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createRouteSchema.parse(request.body);
      const data = await patrolService.createRoute(body, request.tenantId);
      await request.audit('patrol_route.create', 'patrol_routes', data.id, { name: data.name, siteId: data.siteId });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateRouteInput }>(
    '/routes/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateRouteSchema.parse(request.body);
      const data = await patrolService.updateRoute(request.params.id, body, request.tenantId);
      await request.audit('patrol_route.update', 'patrol_routes', data.id, { name: data.name });
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/routes/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await patrolService.deleteRoute(request.params.id, request.tenantId);
      await request.audit('patrol_route.delete', 'patrol_routes', request.params.id);
      return reply.code(204).send();
    },
  );

  // ══════════════════════════════════════════════════════════
  // CHECKPOINTS
  // ══════════════════════════════════════════════════════════

  // List all checkpoints for the tenant
  app.get(
    '/checkpoints',
    async (request, reply) => {
      const data = await patrolService.listCheckpoints(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.get<{ Params: { routeId: string } }>(
    '/routes/:routeId/checkpoints',
    async (request, reply) => {
      const data = await patrolService.listCheckpointsByRoute(request.params.routeId, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Params: { routeId: string }; Body: CreateCheckpointInput }>(
    '/routes/:routeId/checkpoints',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createCheckpointSchema.parse(request.body);
      const data = await patrolService.createCheckpoint(request.params.routeId, body, request.tenantId);
      await request.audit('patrol_checkpoint.create', 'patrol_checkpoints', data.id, { name: data.name, routeId: data.routeId });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateCheckpointInput }>(
    '/checkpoints/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateCheckpointSchema.parse(request.body);
      const data = await patrolService.updateCheckpoint(request.params.id, body, request.tenantId);
      await request.audit('patrol_checkpoint.update', 'patrol_checkpoints', data.id, { name: data.name });
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/checkpoints/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await patrolService.deleteCheckpoint(request.params.id, request.tenantId);
      await request.audit('patrol_checkpoint.delete', 'patrol_checkpoints', request.params.id);
      return reply.code(204).send();
    },
  );

  // ══════════════════════════════════════════════════════════
  // PATROL LOGS
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: PatrolLogFilters }>(
    '/logs',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = patrolLogFiltersSchema.parse(request.query);
      const result = await patrolService.listLogs(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  app.post<{ Body: CreatePatrolLogInput }>(
    '/logs',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createPatrolLogSchema.parse(request.body);
      const data = await patrolService.createLog(body, request.tenantId, request.userId);
      await request.audit('patrol_log.create', 'patrol_logs', data.id, { routeId: data.routeId, status: data.status });
      return reply.code(201).send({ success: true, data });
    },
  );

  // ══════════════════════════════════════════════════════════
  // STATS
  // ══════════════════════════════════════════════════════════

  app.get(
    '/stats',
    async (request, reply) => {
      const data = await patrolService.getPatrolStats(request.tenantId);
      return reply.send({ success: true, data });
    },
  );
}
