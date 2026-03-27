import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { notificationTemplateService } from './service.js';
import {
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  notificationTemplateFiltersSchema,
  previewTemplateSchema,
  sendTestNotificationSchema,
} from './schemas.js';
import type {
  CreateNotificationTemplateInput,
  UpdateNotificationTemplateInput,
  NotificationTemplateFilters,
  PreviewTemplateInput,
  SendTestNotificationInput,
} from './schemas.js';

export async function registerNotificationTemplateRoutes(app: FastifyInstance) {
  // ══════════════════════════════════════════════════════════
  // LIST — GET /notification-templates
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: NotificationTemplateFilters }>(
    '/',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Notification Templates'], summary: 'List notification templates' },
    },
    async (request, reply) => {
      const filters = notificationTemplateFiltersSchema.parse(request.query);
      const result = await notificationTemplateService.list(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  // ══════════════════════════════════════════════════════════
  // GET BY ID — GET /notification-templates/:id
  // ══════════════════════════════════════════════════════════

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Notification Templates'], summary: 'Get notification template by ID' },
    },
    async (request, reply) => {
      const data = await notificationTemplateService.getById(request.params.id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ══════════════════════════════════════════════════════════
  // CREATE — POST /notification-templates
  // ══════════════════════════════════════════════════════════

  app.post<{ Body: CreateNotificationTemplateInput }>(
    '/',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createNotificationTemplateSchema.parse(request.body);
      const data = await notificationTemplateService.create(body, request.tenantId);
      await request.audit('notification_template.create', 'notification_templates', data.id, {
        name: data.name,
        category: data.category,
        channel: data.channel,
      });
      return reply.code(201).send({ success: true, data });
    },
  );

  // ══════════════════════════════════════════════════════════
  // UPDATE — PATCH /notification-templates/:id
  // ══════════════════════════════════════════════════════════

  app.patch<{ Params: { id: string }; Body: UpdateNotificationTemplateInput }>(
    '/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateNotificationTemplateSchema.parse(request.body);
      const data = await notificationTemplateService.update(request.params.id, body, request.tenantId);
      await request.audit('notification_template.update', 'notification_templates', data.id, {
        name: data.name,
      });
      return reply.send({ success: true, data });
    },
  );

  // ══════════════════════════════════════════════════════════
  // DELETE — DELETE /notification-templates/:id
  // ══════════════════════════════════════════════════════════

  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await notificationTemplateService.delete(request.params.id, request.tenantId);
      await request.audit('notification_template.delete', 'notification_templates', request.params.id);
      return reply.code(204).send();
    },
  );

  // ══════════════════════════════════════════════════════════
  // PREVIEW — POST /notification-templates/:id/preview
  // ══════════════════════════════════════════════════════════

  app.post<{ Params: { id: string }; Body: PreviewTemplateInput }>(
    '/:id/preview',
    {
      preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Notification Templates'], summary: 'Preview rendered template' },
    },
    async (request, reply) => {
      const body = previewTemplateSchema.parse(request.body ?? {});
      const data = await notificationTemplateService.preview(request.params.id, request.tenantId, body);
      return reply.send({ success: true, data });
    },
  );

  // ══════════════════════════════════════════════════════════
  // SEND TEST — POST /notification-templates/send-test
  // ══════════════════════════════════════════════════════════

  app.post<{ Body: SendTestNotificationInput }>(
    '/send-test',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = sendTestNotificationSchema.parse(request.body);
      const data = await notificationTemplateService.sendTest(body, request.tenantId);
      await request.audit('notification_template.send_test', 'notification_templates', body.templateId, {
        channel: body.channel,
        recipient: body.recipient,
        success: data.success,
      });
      return reply.send({ success: true, data });
    },
  );

  // ══════════════════════════════════════════════════════════
  // SEED DEFAULTS — POST /notification-templates/seed
  // ══════════════════════════════════════════════════════════

  app.post(
    '/seed',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await notificationTemplateService.seedDefaults(request.tenantId);
      await request.audit('notification_template.seed', 'notification_templates', undefined, data);
      return reply.send({ success: true, data });
    },
  );
}
