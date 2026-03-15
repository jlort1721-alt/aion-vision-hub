import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { slaService } from './service.js';
import {
  createSLADefinitionSchema,
  updateSLADefinitionSchema,
  slaDefinitionFiltersSchema,
  createSLATrackingSchema,
  updateSLATrackingSchema,
  slaTrackingFiltersSchema,
} from './schemas.js';
import type {
  CreateSLADefinitionInput,
  UpdateSLADefinitionInput,
  SLADefinitionFilters,
  CreateSLATrackingInput,
  UpdateSLATrackingInput,
  SLATrackingFilters,
} from './schemas.js';

export async function registerSLARoutes(app: FastifyInstance) {
  // ══════════════════════════════════════════════════════════
  // SLA DEFINITIONS
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: SLADefinitionFilters }>(
    '/definitions',
    async (request, reply) => {
      const filters = slaDefinitionFiltersSchema.parse(request.query);
      const result = await slaService.listDefinitions(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/definitions/:id',
    async (request, reply) => {
      const data = await slaService.getDefinitionById(request.params.id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: CreateSLADefinitionInput }>(
    '/definitions',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createSLADefinitionSchema.parse(request.body);
      const data = await slaService.createDefinition(body, request.tenantId);
      await request.audit('sla_definition.create', 'sla_definitions', data.id, { name: data.name, severity: data.severity });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateSLADefinitionInput }>(
    '/definitions/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateSLADefinitionSchema.parse(request.body);
      const data = await slaService.updateDefinition(request.params.id, body, request.tenantId);
      await request.audit('sla_definition.update', 'sla_definitions', data.id, { name: data.name });
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/definitions/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await slaService.deleteDefinition(request.params.id, request.tenantId);
      await request.audit('sla_definition.delete', 'sla_definitions', request.params.id);
      return reply.code(204).send();
    },
  );

  // ══════════════════════════════════════════════════════════
  // SLA TRACKING
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: SLATrackingFilters }>(
    '/tracking',
    async (request, reply) => {
      const filters = slaTrackingFiltersSchema.parse(request.query);
      const result = await slaService.listTracking(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  app.post<{ Body: CreateSLATrackingInput }>(
    '/tracking',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createSLATrackingSchema.parse(request.body);
      const data = await slaService.createTracking(body, request.tenantId);
      await request.audit('sla_tracking.create', 'sla_tracking', data.id, { slaId: data.slaId });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateSLATrackingInput }>(
    '/tracking/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateSLATrackingSchema.parse(request.body);
      const data = await slaService.updateTracking(request.params.id, body, request.tenantId);
      await request.audit('sla_tracking.update', 'sla_tracking', data.id, { status: data.status });
      return reply.send({ success: true, data });
    },
  );

  // ══════════════════════════════════════════════════════════
  // SLA STATS
  // ══════════════════════════════════════════════════════════

  app.get(
    '/stats',
    async (request, reply) => {
      const data = await slaService.getSLAStats(request.tenantId);
      return reply.send({ success: true, data });
    },
  );
}
