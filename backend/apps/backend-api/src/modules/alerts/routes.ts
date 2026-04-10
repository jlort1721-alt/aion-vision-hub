import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { alertService } from './service.js';
import { broadcast } from '../../plugins/websocket.js';
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

  // Seed default alert rules for tenant (idempotent — no-op if rules already exist)
  app.post(
    '/seed-defaults',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const count = await alertService.seedDefaultRules(request.tenantId, request.userId);
      await request.audit('alerts.seed_defaults', 'alert_rules', undefined, { rulesCreated: count });
      return reply.send({ success: true, data: { rulesCreated: count } });
    },
  );

  app.get<{ Querystring: AlertRuleFilters }>(
    '/rules',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = alertRuleFiltersSchema.parse(request.query);
      const result = await alertService.listRules(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/rules/:id',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
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

      broadcast(request.tenantId, 'alerts', { type: 'alert.rule_created', rule: data });

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
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = alertInstanceFiltersSchema.parse(request.query);
      const result = await alertService.listInstances(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  app.get(
    '/instances/stats',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await alertService.getInstanceStats(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/instances/:id',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
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

      broadcast(request.tenantId, 'alerts', { type: 'alert.acknowledged', instance: data });

      await request.audit('alert.acknowledge', 'alert_instances', data.id);
      return reply.send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/instances/:id/resolve',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await alertService.resolveInstance(request.params.id, request.tenantId, request.userId);

      broadcast(request.tenantId, 'alerts', { type: 'alert.resolved', instance: data });

      await request.audit('alert.resolve', 'alert_instances', data.id);
      return reply.send({ success: true, data });
    },
  );

  // ══════════════════════════════════════════════════════════
  // ESCALATION POLICIES
  // ══════════════════════════════════════════════════════════

  app.get(
    '/escalation-policies',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
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
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await alertService.listChannels(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // Alias: /notification-channels maps to the same handler as /channels
  app.get(
    '/notification-channels',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
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
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = notificationLogFiltersSchema.parse(request.query);
      const result = await alertService.listNotificationLogs(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );
}
