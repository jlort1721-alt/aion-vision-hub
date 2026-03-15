import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { automationService } from './service.js';
import {
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
  automationRuleFiltersSchema,
  automationExecutionFiltersSchema,
} from './schemas.js';
import type {
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
  AutomationRuleFilters,
  AutomationExecutionFilters,
} from './schemas.js';

export async function registerAutomationRoutes(app: FastifyInstance) {
  // ── GET /rules — List automation rules with filters + pagination ──
  app.get<{ Querystring: AutomationRuleFilters }>(
    '/rules',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = automationRuleFiltersSchema.parse(request.query);
      const result = await automationService.listRules(request.tenantId, filters);

      return reply.send({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    },
  );

  // ── GET /rules/:id — Get automation rule by ID ────────────────────
  app.get<{ Params: { id: string } }>(
    '/rules/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await automationService.getRuleById(request.params.id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── POST /rules — Create automation rule ──────────────────────────
  app.post<{ Body: CreateAutomationRuleInput }>(
    '/rules',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createAutomationRuleSchema.parse(request.body);
      const data = await automationService.createRule(body, request.tenantId, request.userId);

      await request.audit('automation_rule.create', 'automation_rules', data.id, {
        name: data.name,
        isActive: data.isActive,
      });

      return reply.code(201).send({ success: true, data });
    },
  );

  // ── PATCH /rules/:id — Update automation rule ─────────────────────
  app.patch<{ Params: { id: string }; Body: UpdateAutomationRuleInput }>(
    '/rules/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateAutomationRuleSchema.parse(request.body);
      const data = await automationService.updateRule(request.params.id, body, request.tenantId);

      await request.audit('automation_rule.update', 'automation_rules', data.id, body);

      return reply.send({ success: true, data });
    },
  );

  // ── DELETE /rules/:id — Delete automation rule ────────────────────
  app.delete<{ Params: { id: string } }>(
    '/rules/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await automationService.deleteRule(request.params.id, request.tenantId);

      await request.audit('automation_rule.delete', 'automation_rules', data.id, {
        name: data.name,
      });

      return reply.send({ success: true, data });
    },
  );

  // ── GET /executions — List automation executions with filters ─────
  app.get<{ Querystring: AutomationExecutionFilters }>(
    '/executions',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = automationExecutionFiltersSchema.parse(request.query);
      const result = await automationService.listExecutions(request.tenantId, filters);

      return reply.send({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    },
  );

  // ── GET /stats — Get automation statistics ────────────────────────
  app.get(
    '/stats',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await automationService.getAutomationStats(request.tenantId);
      return reply.send({ success: true, data });
    },
  );
}
