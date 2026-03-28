import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { whatsappService } from './service.js';
import {
  sendMessageSchema,
  quickReplySchema,
  conversationQuerySchema,
  messageQuerySchema,
  handoffSchema,
  closeConversationSchema,
  waConfigSchema,
  templateSyncSchema,
} from './schemas.js';
import type { ApiResponse } from '@aion/shared-contracts';

export async function registerWhatsAppRoutes(app: FastifyInstance) {
  // ══════════════════════════════════════════════════════════════
  // Configuration
  // ══════════════════════════════════════════════════════════════

  // ── GET /config — Get current WhatsApp config ───────────────
  app.get(
    '/config',
    { preHandler: [requireRole('super_admin', 'tenant_admin')] },
    async (request) => {
      try {
        const config = await whatsappService.getConfig(request.tenantId);
        // Mask the access token for security
        const masked = {
          ...config,
          accessToken: config.accessToken
            ? `${config.accessToken.slice(0, 8)}...${config.accessToken.slice(-4)}`
            : '',
        };
        return { success: true, data: masked } satisfies ApiResponse;
      } catch {
        return {
          success: true,
          data: { configured: false },
        } satisfies ApiResponse;
      }
    },
  );

  // ── PUT /config — Save WhatsApp config ──────────────────────
  app.put(
    '/config',
    { preHandler: [requireRole('super_admin', 'tenant_admin')] },
    async (request) => {
      const input = waConfigSchema.parse(request.body);
      await whatsappService.saveConfig(request.tenantId, input);

      await request.audit('whatsapp.config.update', 'whatsapp', undefined, {
        phoneNumberId: input.phoneNumberId,
        businessAccountId: input.businessAccountId,
      });

      return { success: true, data: { message: 'Configuration saved' } } satisfies ApiResponse;
    },
  );

  // ══════════════════════════════════════════════════════════════
  // Health & Test
  // ══════════════════════════════════════════════════════════════

  // ── GET /health — Health check ──────────────────────────────
  app.get(
    '/health',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request) => {
      const result = await whatsappService.healthCheck(request.tenantId);

      await request.audit('whatsapp.health', 'whatsapp', undefined, {
        status: result.status,
      });

      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ── POST /test — Send test message ──────────────────────────
  app.post<{ Body: { to: string } }>(
    '/test',
    { preHandler: [requireRole('super_admin', 'tenant_admin')] },
    async (request) => {
      const { to } = request.body as { to: string };
      const result = await whatsappService.sendMessage(
        request.tenantId,
        {
          to,
          type: 'text',
          body: '✅ AION Vision Hub — WhatsApp integration test successful!',
        },
        'system',
        'AION Test',
      );

      await request.audit('whatsapp.test', 'whatsapp', undefined, {
        to,
        success: result.success,
      });

      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ══════════════════════════════════════════════════════════════
  // Messaging
  // ══════════════════════════════════════════════════════════════

  // ── POST /messages — Send a message ─────────────────────────
  app.post(
    '/messages',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request) => {
      const input = sendMessageSchema.parse(request.body);
      const result = await whatsappService.sendMessage(
        request.tenantId,
        input,
        'human_agent',
        request.userEmail,
      );

      await request.audit('whatsapp.message.send', 'whatsapp', result.messageId, {
        to: input.to,
        type: input.type,
        success: result.success,
      });

      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ── POST /messages/quick-reply — Send quick reply ───────────
  app.post(
    '/messages/quick-reply',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request) => {
      const input = quickReplySchema.parse(request.body);
      const result = await whatsappService.sendQuickReply(request.tenantId, input);

      await request.audit('whatsapp.quickreply.send', 'whatsapp', result.messageId, {
        to: input.to,
      });

      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ══════════════════════════════════════════════════════════════
  // Conversations
  // ══════════════════════════════════════════════════════════════

  // ── GET /conversations — List conversations ─────────────────
  app.get(
    '/conversations',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator', 'viewer')] },
    async (request) => {
      const query = conversationQuerySchema.parse(request.query);
      const items = await whatsappService.listConversations(request.tenantId, query);

      return {
        success: true,
        data: items,
        meta: { total: items.length, page: 1, perPage: items.length, totalPages: 1 },
      } satisfies ApiResponse;
    },
  );

  // ── GET /conversations/:id — Get single conversation ────────
  app.get<{ Params: { id: string } }>(
    '/conversations/:id',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator', 'viewer')] },
    async (request) => {
      const conversation = await whatsappService.getConversation(
        request.tenantId,
        request.params.id,
      );

      return { success: true, data: conversation } satisfies ApiResponse;
    },
  );

  // ── GET /conversations/:id/messages — Get messages ──────────
  app.get<{ Params: { id: string }; Querystring: { limit?: string; before?: string } }>(
    '/conversations/:id/messages',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator', 'viewer')] },
    async (request) => {
      const query = messageQuerySchema.parse({
        conversationId: request.params.id,
        ...request.query,
      });
      const messages = await whatsappService.getMessages(request.tenantId, query);

      return {
        success: true,
        data: messages,
        meta: { total: messages.length, page: 1, perPage: messages.length, totalPages: 1 },
      } satisfies ApiResponse;
    },
  );

  // ── POST /conversations/handoff — Handoff to human ──────────
  app.post(
    '/conversations/handoff',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request) => {
      const input = handoffSchema.parse(request.body);
      await whatsappService.handoffToHuman(request.tenantId, input);

      await request.audit('whatsapp.handoff', 'whatsapp', input.conversationId, {
        assignTo: input.assignTo,
      });

      return { success: true, data: { message: 'Handoff completed' } } satisfies ApiResponse;
    },
  );

  // ── POST /conversations/close — Close conversation ──────────
  app.post(
    '/conversations/close',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request) => {
      const input = closeConversationSchema.parse(request.body);
      await whatsappService.closeConversation(request.tenantId, input);

      await request.audit('whatsapp.conversation.close', 'whatsapp', input.conversationId, {
        resolution: input.resolution,
      });

      return { success: true, data: { message: 'Conversation closed' } } satisfies ApiResponse;
    },
  );

  // ══════════════════════════════════════════════════════════════
  // Templates
  // ══════════════════════════════════════════════════════════════

  // ── GET /templates — List synced templates ──────────────────
  app.get(
    '/templates',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request) => {
      const templates = await whatsappService.listTemplates(request.tenantId);

      return {
        success: true,
        data: templates,
        meta: { total: templates.length, page: 1, perPage: templates.length, totalPages: 1 },
      } satisfies ApiResponse;
    },
  );

  // ── POST /templates/sync — Sync templates from Meta ─────────
  app.post(
    '/templates/sync',
    { preHandler: [requireRole('super_admin', 'tenant_admin')] },
    async (request) => {
      const { force } = templateSyncSchema.parse(request.body || {});
      const result = await whatsappService.syncTemplates(request.tenantId);

      await request.audit('whatsapp.templates.sync', 'whatsapp', undefined, {
        synced: result.synced,
        errors: result.errors.length,
        force,
      });

      return { success: true, data: result } satisfies ApiResponse;
    },
  );
}
