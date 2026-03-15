import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { alertService } from './service.js';
import {
  createAlertRuleSchema,
  updateAlertRuleSchema,
  alertRuleFiltersSchema,
  alertInstanceFiltersSchema,
  acknowledgeAlertSchema,
  createEscalationPolicySchema,
  updateEscalationPolicySchema,
  createNotificationChannelSchema,
  updateNotificationChannelSchema,
  notificationLogFiltersSchema,
} from './schemas.js';
import type {
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
  AlertRuleFilters,
  AlertInstanceFilters,
  AcknowledgeAlertInput,
  CreateEscalationPolicyInput,
  UpdateEscalationPolicyInput,
  CreateNotificationChannelInput,
  UpdateNotificationChannelInput,
  NotificationLogFilters,
} from './schemas.js';

export async function registerAlertRoutes(app: FastifyInstance) {
  // ══════════════════════════════════════════════════════════
  // ALERT RULES
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: AlertRuleFilters }>(
    '/rules',
    async (request, reply) => {
      const filters = alertRuleFiltersSchema.parse(request.query);
      const result = await alertService.listRules(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/rules/:id',
    async (request, reply) => {
      const data = await alertService.getRuleById(request.params.id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: CreateAlertRuleInput }>(
    '/rules',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createAlertRuleSchema.parse(request.body);
      const data = await alertService.createRule(body, request.tenantId, request.userId);
      await request.audit('alert_rule.create', 'alert_rules', data.id, { name: data.name, severity: data.severity });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateAlertRuleInput }>(
    '/rules/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateAlertRuleSchema.parse(request.body);
      const data = await alertService.updateRule(request.params.id, body, request.tenantId);
      await request.audit('alert_rule.update', 'alert_rules', data.id, { name: data.name });
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/rules/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await alertService.deleteRule(request.params.id, request.tenantId);
      await request.audit('alert_rule.delete', 'alert_rules', request.params.id);
      return reply.code(204).send();
    },
  );

  // ══════════════════════════════════════════════════════════
  // ALERT INSTANCES
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: AlertInstanceFilters }>(
    '/instances',
    async (request, reply) => {
      const filters = alertInstanceFiltersSchema.parse(request.query);
      const result = await alertService.listInstances(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  app.get(
    '/instances/stats',
    async (request, reply) => {
      const data = await alertService.getInstanceStats(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/instances/:id',
    async (request, reply) => {
      const data = await alertService.getInstanceById(request.params.id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: AcknowledgeAlertInput }>(
    '/instances/:id/acknowledge',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      acknowledgeAlertSchema.parse(request.body ?? {});
      const data = await alertService.acknowledgeInstance(request.params.id, request.tenantId, request.userId);
      await request.audit('alert.acknowledge', 'alert_instances', data.id);
      return reply.send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/instances/:id/resolve',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await alertService.resolveInstance(request.params.id, request.tenantId, request.userId);
      await request.audit('alert.resolve', 'alert_instances', data.id);
      return reply.send({ success: true, data });
    },
  );

  // ══════════════════════════════════════════════════════════
  // ESCALATION POLICIES
  // ══════════════════════════════════════════════════════════

  app.get(
    '/escalation-policies',
    async (request, reply) => {
      const data = await alertService.listPolicies(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: CreateEscalationPolicyInput }>(
    '/escalation-policies',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createEscalationPolicySchema.parse(request.body);
      const data = await alertService.createPolicy(body, request.tenantId);
      await request.audit('escalation_policy.create', 'escalation_policies', data.id, { name: data.name });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateEscalationPolicyInput }>(
    '/escalation-policies/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateEscalationPolicySchema.parse(request.body);
      const data = await alertService.updatePolicy(request.params.id, body, request.tenantId);
      await request.audit('escalation_policy.update', 'escalation_policies', data.id);
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/escalation-policies/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await alertService.deletePolicy(request.params.id, request.tenantId);
      await request.audit('escalation_policy.delete', 'escalation_policies', request.params.id);
      return reply.code(204).send();
    },
  );

  // ══════════════════════════════════════════════════════════
  // NOTIFICATION CHANNELS
  // ══════════════════════════════════════════════════════════

  app.get(
    '/channels',
    async (request, reply) => {
      const data = await alertService.listChannels(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: CreateNotificationChannelInput }>(
    '/channels',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createNotificationChannelSchema.parse(request.body);
      const data = await alertService.createChannel(body, request.tenantId);
      await request.audit('notification_channel.create', 'notification_channels', data.id, { name: data.name, type: data.type });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateNotificationChannelInput }>(
    '/channels/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateNotificationChannelSchema.parse(request.body);
      const data = await alertService.updateChannel(request.params.id, body, request.tenantId);
      await request.audit('notification_channel.update', 'notification_channels', data.id);
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/channels/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await alertService.deleteChannel(request.params.id, request.tenantId);
      await request.audit('notification_channel.delete', 'notification_channels', request.params.id);
      return reply.code(204).send();
    },
  );

  // ══════════════════════════════════════════════════════════
  // NOTIFICATION LOG
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: NotificationLogFilters }>(
    '/notifications',
    async (request, reply) => {
      const filters = notificationLogFiltersSchema.parse(request.query);
      const result = await alertService.listNotificationLogs(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );
}
