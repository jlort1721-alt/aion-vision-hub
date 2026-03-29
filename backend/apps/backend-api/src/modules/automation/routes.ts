import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { automationService, getSystemEnabled, setSystemEnabled } from './service.js';
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
  // ═══════════════════════════════════════════════════════════
  // SYSTEM-WIDE ON/OFF SWITCH
  // ═══════════════════════════════════════════════════════════

  // ── POST /system/toggle — Enable or disable ALL automation ──
  app.post<{ Body: { enabled: boolean } }>(
    '/system/toggle',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { enabled } = request.body as { enabled: boolean };
      setSystemEnabled(enabled);

      await request.audit('automation.system.toggle', 'system', 'automation', { enabled });

      return reply.send({ success: true, data: { enabled: getSystemEnabled() } });
    },
  );

  // ── GET /system/status — Get current system-wide automation status ──
  app.get(
    '/system/status',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (_request, reply) => {
      return reply.send({ success: true, data: { enabled: getSystemEnabled() } });
    },
  );

  // ═══════════════════════════════════════════════════════════
  // AUTOMATION RULES CRUD
  // ═══════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════
  // AUTOMATION EXECUTIONS & STATS
  // ═══════════════════════════════════════════════════════════

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

  // ── POST /evaluate — Manually trigger evaluation for testing ──────
  app.post<{ Body: { type: string; data: Record<string, unknown> } }>(
    '/evaluate',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const trigger = request.body as { type: string; data: Record<string, unknown> };

      await automationService.evaluateAndExecute(trigger);

      await request.audit('automation.manual_evaluate', 'automation', undefined, {
        triggerType: trigger.type,
      });

      return reply.send({ success: true, data: { message: 'Evaluation complete', triggerType: trigger.type } });
    },
  );
}
