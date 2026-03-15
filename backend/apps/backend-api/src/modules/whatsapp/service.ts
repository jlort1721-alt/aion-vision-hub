import { eq, and, desc, lt } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  integrations,
  profiles,
  waConversations,
  waMessages,
  waTemplates,
} from '../../db/schema/index.js';
import { NotFoundError, AppError, ErrorCodes } from '@aion/shared-contracts';
import {
  MetaCloudAPIProvider,
  type WhatsAppProvider,
  type WASendResult,
} from './provider.js';
import type {
  SendMessageInput,
  QuickReplyInput,
  HandoffInput,
  CloseConversationInput,
  ConversationQueryInput,
  MessageQueryInput,
  WAConfigInput,
} from './schemas.js';
import { createLogger } from '@aion/common-utils';
import { maskPhone } from './sanitize.js';

const logger = createLogger({ name: 'whatsapp-service' });

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1_000, 3_000, 10_000]; // progressive backoff

/** Delivery status progression order (higher = later in lifecycle). */
const STATUS_ORDER: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };

// ── WhatsApp Service ──────────────────────────────────────────

export class WhatsAppService {
  private providerCache = new Map<string, WhatsAppProvider>();

  // ── Provider Resolution ───────────────────────────────────

  async getProvider(tenantId: string): Promise<WhatsAppProvider> {
    const cached = this.providerCache.get(tenantId);
    if (cached) return cached;

    const config = await this.getConfig(tenantId);
    const provider = new MetaCloudAPIProvider({
      phoneNumberId: config.phoneNumberId,
      accessToken: config.accessToken,
      businessAccountId: config.businessAccountId,
      apiVersion: config.apiVersion,
    });

    this.providerCache.set(tenantId, provider);
    return provider;
  }

  invalidateProviderCache(tenantId: string) {
    this.providerCache.delete(tenantId);
  }

  // ── Config Management ─────────────────────────────────────

  async getConfig(tenantId: string): Promise<WAConfigInput & { integrationId: string }> {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.type, 'whatsapp')))
      .limit(1);

    if (!integration) {
      throw new AppError(
        ErrorCodes.INTEGRATION_CONFIG_INVALID,
        'WhatsApp integration is not configured for this tenant',
        404,
      );
    }

    const cfg = integration.config as Record<string, unknown>;
    return {
      integrationId: integration.id,
      phoneNumberId: (cfg.phoneNumberId as string) || '',
      accessToken: (cfg.accessToken as string) || '',
      businessAccountId: (cfg.businessAccountId as string) || '',
      verifyToken: (cfg.verifyToken as string) || '',
      apiVersion: (cfg.apiVersion as string) || 'v21.0',
      aiAgentEnabled: (cfg.aiAgentEnabled as boolean) ?? true,
      aiSystemPrompt: (cfg.aiSystemPrompt as string) || undefined,
      autoReplyOutsideHours: (cfg.autoReplyOutsideHours as string) || undefined,
      businessHoursStart: (cfg.businessHoursStart as string) || undefined,
      businessHoursEnd: (cfg.businessHoursEnd as string) || undefined,
      businessTimezone: (cfg.businessTimezone as string) || 'UTC',
      maxRetries: (cfg.maxRetries as number) ?? MAX_RETRIES,
    };
  }

  async saveConfig(tenantId: string, config: WAConfigInput): Promise<void> {
    const [existing] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.type, 'whatsapp')))
      .limit(1);

    const configData = { ...config };

    if (existing) {
      await db
        .update(integrations)
        .set({ config: configData, updatedAt: new Date() })
        .where(eq(integrations.id, existing.id));
    } else {
      await db.insert(integrations).values({
        tenantId,
        name: 'WhatsApp Business',
        type: 'whatsapp',
        config: configData,
        isActive: true,
      });
    }

    this.invalidateProviderCache(tenantId);
    logger.info({ tenantId }, 'WhatsApp config saved');
  }

  // ── Send Messages ─────────────────────────────────────────

  async sendMessage(
    tenantId: string,
    input: SendMessageInput,
    senderType: 'human_agent' | 'ai_bot' | 'system' = 'human_agent',
    senderName?: string,
  ): Promise<WASendResult> {
    const provider = await this.getProvider(tenantId);
    let result: WASendResult;

    switch (input.type) {
      case 'text':
        result = await this.withRetry(tenantId, () =>
          provider.sendText({ to: input.to, body: input.body! }),
        );
        break;

      case 'template': {
        // Validate template is APPROVED before sending to Meta
        if (input.templateName) {
          const [tpl] = await db
            .select({ status: waTemplates.status })
            .from(waTemplates)
            .where(
              and(
                eq(waTemplates.tenantId, tenantId),
                eq(waTemplates.name, input.templateName),
                eq(waTemplates.language, input.templateLanguage || 'en_US'),
              ),
            )
            .limit(1);

          if (tpl && tpl.status !== 'APPROVED') {
            throw new AppError(
              ErrorCodes.VALIDATION_ERROR,
              `Template "${input.templateName}" is not approved (status: ${tpl.status}). Only APPROVED templates can be sent.`,
              400,
            );
          }

          if (!tpl) {
            logger.warn(
              { tenantId, templateName: input.templateName },
              'Template not found in local DB — sending anyway (Meta API will validate)',
            );
          }
        }

        result = await this.withRetry(tenantId, () =>
          provider.sendTemplate({
            to: input.to,
            templateName: input.templateName!,
            languageCode: input.templateLanguage ?? '',
            components: input.templateParams?.length
              ? [
                  {
                    type: 'body',
                    parameters: input.templateParams.map((p) => ({ type: 'text' as const, text: p })),
                  },
                ]
              : undefined,
          }),
        );
        break;
      }

      case 'image':
      case 'document':
      case 'audio':
      case 'video':
        result = await this.withRetry(tenantId, () =>
          provider.sendMedia({
            to: input.to,
            type: input.type as 'image' | 'document' | 'audio' | 'video',
            url: input.mediaUrl!,
            caption: input.caption,
            filename: input.filename,
          }),
        );
        break;

      case 'interactive':
        result = await this.withRetry(tenantId, () =>
          provider.sendInteractive({
            to: input.to,
            type: input.interactive!.type,
            header: input.interactive!.header
              ? { type: 'text', text: input.interactive!.header }
              : undefined,
            body: input.interactive!.body,
            footer: input.interactive!.footer,
            buttons: input.interactive!.buttons,
            sections: input.interactive!.sections,
          }),
        );
        break;

      default:
        throw new AppError(ErrorCodes.VALIDATION_ERROR, `Unsupported message type: ${input.type}`, 400);
    }

    // Persist outbound message
    const conversation = await this.findOrCreateConversation(tenantId, input.to);
    await db.insert(waMessages).values({
      tenantId,
      conversationId: conversation.id,
      waMessageId: result.messageId || null,
      direction: 'outbound',
      messageType: input.type,
      senderType,
      senderName: senderName || senderType,
      body: input.body || input.templateName || `[${input.type}]`,
      mediaUrl: input.mediaUrl || null,
      deliveryStatus: result.success ? 'sent' : 'failed',
      errorCode: result.success ? null : 'SEND_FAILED',
      errorMessage: result.error || null,
      metadata: {
        templateName: input.templateName,
        templateParams: input.templateParams,
        interactive: input.interactive,
      },
    });

    // Update conversation timestamp
    await db
      .update(waConversations)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(waConversations.id, conversation.id));

    logger.info(
      { tenantId, to: maskPhone(input.to), type: input.type, success: result.success, messageId: result.messageId },
      'Outbound message processed',
    );

    return result;
  }

  async sendQuickReply(tenantId: string, input: QuickReplyInput): Promise<WASendResult> {
    return this.sendMessage(tenantId, {
      to: input.to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: input.body,
        buttons: input.buttons,
      },
    });
  }

  // ── Inbound Webhook Processing ────────────────────────────

  async processInboundMessage(tenantId: string, webhookPayload: Record<string, unknown>): Promise<void> {
    const entry = (webhookPayload.entry as any[])?.[0];
    if (!entry) return;

    const changes = entry.changes as any[];
    if (!changes?.length) return;

    for (const change of changes) {
      const value = change.value;
      if (!value) continue;

      // Process status updates
      if (value.statuses?.length) {
        await this.processStatusUpdates(tenantId, value.statuses);
      }

      // Process incoming messages
      if (value.messages?.length) {
        const contacts = value.contacts || [];
        for (const msg of value.messages) {
          await this.processIncomingMessage(tenantId, msg, contacts);
        }
      }
    }
  }

  private async processIncomingMessage(
    tenantId: string,
    msg: Record<string, any>,
    contacts: Array<{ profile?: { name?: string }; wa_id?: string }>,
  ): Promise<void> {
    const from = msg.from as string;
    const contact = contacts.find((c) => c.wa_id === from);
    const contactName = contact?.profile?.name || from;
    const msgType = msg.type as string;
    const waMessageId = msg.id as string;

    let body = '';
    let mediaUrl: string | null = null;
    const metadata: Record<string, unknown> = {};

    switch (msgType) {
      case 'text':
        body = msg.text?.body || '';
        break;
      case 'image':
      case 'video':
      case 'audio':
      case 'document':
        mediaUrl = msg[msgType]?.id || null; // Media ID, must be downloaded via Graph API
        body = msg[msgType]?.caption || `[${msgType}]`;
        metadata.mediaId = msg[msgType]?.id;
        metadata.mimeType = msg[msgType]?.mime_type;
        break;
      case 'location':
        body = `Location: ${msg.location?.latitude}, ${msg.location?.longitude}`;
        metadata.location = msg.location;
        break;
      case 'interactive':
        body =
          msg.interactive?.button_reply?.title ||
          msg.interactive?.list_reply?.title ||
          '[interactive]';
        metadata.interactiveReply = msg.interactive?.button_reply || msg.interactive?.list_reply;
        break;
      case 'reaction':
        body = msg.reaction?.emoji || '[reaction]';
        metadata.reaction = msg.reaction;
        break;
      default:
        body = `[${msgType}]`;
    }

    // ── Deduplication: skip if this waMessageId already exists ──
    if (waMessageId) {
      const [dup] = await db
        .select({ id: waMessages.id })
        .from(waMessages)
        .where(and(eq(waMessages.tenantId, tenantId), eq(waMessages.waMessageId, waMessageId)))
        .limit(1);

      if (dup) {
        logger.info({ tenantId, waMessageId }, 'Duplicate inbound message skipped (deduplication)');
        return;
      }
    }

    // Find or create conversation
    const conversation = await this.findOrCreateConversation(tenantId, from, contactName);

    // Mark incoming as read
    try {
      const provider = await this.getProvider(tenantId);
      await provider.markRead({ messageId: waMessageId });
    } catch (err) {
      logger.warn({ err, tenantId, waMessageId }, 'Failed to mark message as read');
    }

    // Persist inbound message (with unique-constraint fallback for race conditions)
    try {
      await db.insert(waMessages).values({
        tenantId,
        conversationId: conversation.id,
        waMessageId,
        direction: 'inbound',
        messageType: msgType,
        senderType: 'customer',
        senderName: contactName,
        body,
        mediaUrl,
        deliveryStatus: 'delivered',
        metadata,
      });
    } catch (err: unknown) {
      // Handle PG unique violation (code 23505) from idx_wa_messages_dedup
      if (err instanceof Error && 'code' in err && (err as any).code === '23505') {
        logger.info({ tenantId, waMessageId }, 'Duplicate message caught by unique constraint');
        return;
      }
      throw err;
    }

    // Update conversation
    await db
      .update(waConversations)
      .set({
        waContactName: contactName,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(waConversations.id, conversation.id));

    logger.info(
      { tenantId, from: maskPhone(from), msgType, conversationId: conversation.id },
      'Inbound message processed',
    );
  }

  // ── Delivery Status Handling ──────────────────────────────

  private async processStatusUpdates(
    tenantId: string,
    statuses: Array<{ id: string; status: string; timestamp?: string; errors?: any[] }>,
  ): Promise<void> {
    for (const status of statuses) {
      const waMessageId = status.id;
      const deliveryStatus = status.status; // sent | delivered | read | failed

      const [existing] = await db
        .select()
        .from(waMessages)
        .where(and(eq(waMessages.tenantId, tenantId), eq(waMessages.waMessageId, waMessageId)))
        .limit(1);

      if (!existing) continue;

      // ── Status progression guard: skip if status hasn't advanced ──
      const currentOrder = STATUS_ORDER[existing.deliveryStatus ?? ''] ?? 0;
      const newOrder = STATUS_ORDER[deliveryStatus] ?? 0;
      if (newOrder <= currentOrder && deliveryStatus !== 'failed') {
        logger.debug(
          { tenantId, waMessageId, current: existing.deliveryStatus, incoming: deliveryStatus },
          'Status update skipped (no progression)',
        );
        continue;
      }

      const updateData: Record<string, unknown> = { deliveryStatus };

      if (status.errors?.length) {
        updateData.errorCode = String(status.errors[0]?.code || 'UNKNOWN');
        updateData.errorMessage = status.errors[0]?.title || 'Delivery failed';
      }

      await db
        .update(waMessages)
        .set(updateData)
        .where(eq(waMessages.id, existing.id));

      logger.debug(
        { tenantId, waMessageId, deliveryStatus },
        'Delivery status updated',
      );
    }
  }

  // ── Conversations ─────────────────────────────────────────

  async listConversations(tenantId: string, query: ConversationQueryInput) {
    const conditions = [eq(waConversations.tenantId, tenantId)];

    if (query.status) {
      conditions.push(eq(waConversations.status, query.status));
    }
    if (query.phone) {
      conditions.push(eq(waConversations.waContactPhone, query.phone));
    }
    if (query.assignedTo) {
      conditions.push(eq(waConversations.assignedTo, query.assignedTo));
    }

    const items = await db
      .select()
      .from(waConversations)
      .where(and(...conditions))
      .orderBy(desc(waConversations.lastMessageAt))
      .limit(query.limit)
      .offset(query.offset);

    return items;
  }

  async getConversation(tenantId: string, conversationId: string) {
    const [conversation] = await db
      .select()
      .from(waConversations)
      .where(and(eq(waConversations.id, conversationId), eq(waConversations.tenantId, tenantId)))
      .limit(1);

    if (!conversation) {
      throw new NotFoundError('Conversation', conversationId);
    }

    return conversation;
  }

  async getMessages(tenantId: string, query: MessageQueryInput) {
    const conditions = [
      eq(waMessages.tenantId, tenantId),
      eq(waMessages.conversationId, query.conversationId),
    ];

    if (query.before) {
      conditions.push(lt(waMessages.createdAt, new Date(query.before)));
    }

    return db
      .select()
      .from(waMessages)
      .where(and(...conditions))
      .orderBy(desc(waMessages.createdAt))
      .limit(query.limit);
  }

  // ── Handoff & Close ───────────────────────────────────────

  async handoffToHuman(tenantId: string, input: HandoffInput): Promise<void> {
    const conversation = await this.getConversation(tenantId, input.conversationId);

    // Validate target agent exists within the same tenant
    if (input.assignTo) {
      const [targetUser] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(
          and(
            eq(profiles.id, input.assignTo),
            eq(profiles.tenantId, tenantId),
            eq(profiles.isActive, true),
          ),
        )
        .limit(1);

      if (!targetUser) {
        throw new NotFoundError('User', input.assignTo);
      }
    }

    await db
      .update(waConversations)
      .set({
        status: 'human_agent',
        assignedTo: input.assignTo || null,
        updatedAt: new Date(),
      })
      .where(eq(waConversations.id, conversation.id));

    // Send system message noting the handoff
    await db.insert(waMessages).values({
      tenantId,
      conversationId: conversation.id,
      direction: 'outbound',
      messageType: 'text',
      senderType: 'system',
      senderName: 'System',
      body: input.note || 'Conversation transferred to a human agent.',
      deliveryStatus: 'sent',
      metadata: { handoff: true, assignedTo: input.assignTo },
    });

    logger.info(
      { tenantId, conversationId: input.conversationId, assignTo: input.assignTo },
      'Conversation handed off to human',
    );
  }

  async closeConversation(tenantId: string, input: CloseConversationInput): Promise<void> {
    const conversation = await this.getConversation(tenantId, input.conversationId);

    await db
      .update(waConversations)
      .set({
        status: 'closed',
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(waConversations.id, conversation.id));

    if (input.resolution) {
      await db.insert(waMessages).values({
        tenantId,
        conversationId: conversation.id,
        direction: 'outbound',
        messageType: 'text',
        senderType: 'system',
        senderName: 'System',
        body: `Conversation closed. ${input.resolution}`,
        deliveryStatus: 'sent',
        metadata: { closed: true, resolution: input.resolution },
      });
    }

    logger.info({ tenantId, conversationId: input.conversationId }, 'Conversation closed');
  }

  // ── Templates ─────────────────────────────────────────────

  async syncTemplates(tenantId: string): Promise<{ synced: number; errors: string[] }> {
    const provider = await this.getProvider(tenantId);
    const remoteTemplates = await provider.fetchTemplates();
    const errors: string[] = [];
    let synced = 0;

    for (const tpl of remoteTemplates) {
      try {
        const [existing] = await db
          .select()
          .from(waTemplates)
          .where(
            and(
              eq(waTemplates.tenantId, tenantId),
              eq(waTemplates.name, tpl.name),
              eq(waTemplates.language, tpl.language),
            ),
          )
          .limit(1);

        const values = {
          tenantId,
          name: tpl.name,
          language: tpl.language,
          status: tpl.status,
          category: tpl.category,
          components: tpl.components,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        };

        if (existing) {
          await db.update(waTemplates).set(values).where(eq(waTemplates.id, existing.id));
        } else {
          await db.insert(waTemplates).values(values);
        }

        synced++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Template ${tpl.name}: ${msg}`);
        logger.warn({ tenantId, template: tpl.name, err }, 'Template sync error');
      }
    }

    logger.info({ tenantId, synced, errors: errors.length }, 'Template sync complete');
    return { synced, errors };
  }

  async listTemplates(tenantId: string) {
    return db
      .select()
      .from(waTemplates)
      .where(eq(waTemplates.tenantId, tenantId))
      .orderBy(desc(waTemplates.updatedAt));
  }

  // ── Health Check ──────────────────────────────────────────

  async healthCheck(tenantId: string) {
    try {
      const provider = await this.getProvider(tenantId);
      const result = await provider.healthCheck();
      const config = await this.getConfig(tenantId);

      // Update integration last-tested
      await db
        .update(integrations)
        .set({
          lastTestedAt: new Date(),
          lastError: result.connected ? null : result.error || 'Health check failed',
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, config.integrationId));

      return {
        status: result.connected ? 'healthy' : 'unhealthy',
        provider: 'meta_cloud_api',
        ...result,
      };
    } catch (err) {
      return {
        status: 'not_configured' as const,
        connected: false,
        latencyMs: 0,
        error: err instanceof Error ? err.message : 'Not configured',
      };
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  private async findOrCreateConversation(
    tenantId: string,
    phone: string,
    contactName?: string,
  ) {
    const sanitizedPhone = phone.replace(/[^0-9+]/g, '');

    const [existing] = await db
      .select()
      .from(waConversations)
      .where(
        and(
          eq(waConversations.tenantId, tenantId),
          eq(waConversations.waContactPhone, sanitizedPhone),
          // Re-open if not closed — otherwise create new
        ),
      )
      .orderBy(desc(waConversations.createdAt))
      .limit(1);

    if (existing && existing.status !== 'closed') {
      return existing;
    }

    const [conversation] = await db
      .insert(waConversations)
      .values({
        tenantId,
        waContactPhone: sanitizedPhone,
        waContactName: contactName || null,
        status: 'ai_bot',
        lastMessageAt: new Date(),
      })
      .returning();

    return conversation;
  }

  private async withRetry(
    tenantId: string,
    fn: () => Promise<WASendResult>,
  ): Promise<WASendResult> {
    let config: { maxRetries: number };
    try {
      config = await this.getConfig(tenantId);
    } catch {
      config = { maxRetries: MAX_RETRIES };
    }

    const maxRetries = Math.min(config.maxRetries, MAX_RETRIES);
    let lastResult: WASendResult = { success: false, error: 'No attempt made', timestamp: new Date().toISOString() };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      lastResult = await fn();

      if (lastResult.success) return lastResult;

      // Don't retry on non-transient errors
      if (lastResult.error?.includes('Invalid') || lastResult.error?.includes('parameter')) {
        break;
      }

      if (attempt < maxRetries) {
        const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        logger.warn(
          { tenantId, attempt: attempt + 1, maxRetries, delay, error: lastResult.error },
          'Retrying send',
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return lastResult;
  }
}

export const whatsappService = new WhatsAppService();
