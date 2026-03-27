/**
 * MCP Server Tool — Notification Server
 *
 * Provides tools for sending alerts, WhatsApp messages, emails, and
 * querying notification history. Includes per-tenant rate limiting
 * (max 10 notifications per minute).
 */

import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import {
  notificationLog,
  notificationChannels,
  waMessages,
  waConversations,
  waTemplates,
  auditLogs,
} from '../../../db/schema/index.js';
import { config } from '../../../config/env.js';
import type { MCPServerTool } from './index.js';

// ── Rate Limiter (in-memory, per-tenant, max 10/minute) ──────

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(tenantId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(tenantId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(tenantId, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// ── send_alert ────────────────────────────────────────────────

export const sendAlert: MCPServerTool = {
  name: 'send_alert',
  description:
    'Send an alert notification through specified channels (email, whatsapp, push). Rate limited to 10 per minute per tenant.',
  parameters: {
    message: {
      type: 'string',
      description: 'Alert message content (required)',
      required: true,
    },
    severity: {
      type: 'string',
      description: 'Alert severity level',
      required: true,
      enum: ['critical', 'high', 'medium', 'low', 'info'],
    },
    channels: {
      type: 'string',
      description: 'Comma-separated notification channels: email, whatsapp, push',
      required: true,
    },
    subject: {
      type: 'string',
      description: 'Optional alert subject line',
      required: false,
    },
  },
  execute: async (params, context) => {
    const message = params.message as string;
    const severity = params.severity as string;
    const channelsStr = params.channels as string;
    const subject = (params.subject as string) || `[AION Alert] ${severity.toUpperCase()}`;

    if (!message || !severity || !channelsStr) {
      return { error: 'message, severity, and channels are required' };
    }

    // Rate limit check
    const rateCheck = checkRateLimit(context.tenantId);
    if (!rateCheck.allowed) {
      return {
        error: 'Rate limit exceeded. Maximum 10 notifications per minute per tenant.',
        remaining: rateCheck.remaining,
      };
    }

    const requestedChannels = channelsStr
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    const validChannels = ['email', 'whatsapp', 'push'];
    const invalidChannels = requestedChannels.filter((c) => !validChannels.includes(c));

    if (invalidChannels.length > 0) {
      return { error: `Invalid channels: ${invalidChannels.join(', ')}. Valid: ${validChannels.join(', ')}` };
    }

    // Look up active notification channels for the tenant
    const tenantChannels = await db
      .select()
      .from(notificationChannels)
      .where(
        and(
          eq(notificationChannels.tenantId, context.tenantId),
          eq(notificationChannels.isActive, true),
        ),
      );

    const results: Array<{
      channel: string;
      status: string;
      recipient?: string;
      error?: string;
    }> = [];

    for (const requestedChannel of requestedChannels) {
      // Find matching channel config
      const channelConfig = tenantChannels.find((c) => c.type === requestedChannel);

      if (!channelConfig) {
        results.push({
          channel: requestedChannel,
          status: 'skipped',
          error: `No active '${requestedChannel}' channel configured for this tenant`,
        });
        continue;
      }

      const configData = channelConfig.config as Record<string, unknown>;
      let recipients: string[] = [];

      if (requestedChannel === 'email') {
        recipients = (configData.recipients as string[]) ?? [];
      } else if (requestedChannel === 'whatsapp') {
        recipients = (configData.phones as string[]) ?? [];
      } else if (requestedChannel === 'push') {
        recipients = ['push-broadcast'];
      }

      if (recipients.length === 0) {
        results.push({
          channel: requestedChannel,
          status: 'skipped',
          error: `No recipients configured for '${requestedChannel}' channel`,
        });
        continue;
      }

      // Log each notification
      for (const recipient of recipients) {
        await db.insert(notificationLog).values({
          tenantId: context.tenantId,
          channelId: channelConfig.id,
          type: requestedChannel,
          recipient,
          subject,
          message,
          status: 'pending',
          sentAt: new Date(),
        });

        results.push({
          channel: requestedChannel,
          status: 'queued',
          recipient,
        });
      }

      // Update last used timestamp
      await db
        .update(notificationChannels)
        .set({ lastUsedAt: new Date(), updatedAt: new Date() })
        .where(eq(notificationChannels.id, channelConfig.id));
    }

    // Audit log
    await db.insert(auditLogs).values({
      tenantId: context.tenantId,
      userId: context.userId,
      userEmail: 'mcp-agent',
      action: 'mcp.notification.send_alert',
      entityType: 'notification',
      afterState: {
        severity,
        channels: requestedChannels,
        results,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      message: 'Alert notification processed',
      severity,
      channels_requested: requestedChannels,
      results,
      rate_limit_remaining: rateCheck.remaining,
      timestamp: new Date().toISOString(),
    };
  },
};

// ── send_whatsapp ─────────────────────────────────────────────

export const sendWhatsApp: MCPServerTool = {
  name: 'send_whatsapp',
  description:
    'Send a WhatsApp template message to a phone number via the Meta Cloud API. Rate limited to 10 per minute per tenant.',
  parameters: {
    to: {
      type: 'string',
      description: 'Recipient phone number in international format, e.g., +573001234567 (required)',
      required: true,
    },
    template_name: {
      type: 'string',
      description: 'WhatsApp template name as registered in Meta Business Manager (required)',
      required: true,
    },
    parameters: {
      type: 'string',
      description: 'Comma-separated template parameters (values for {{1}}, {{2}}, etc.)',
      required: false,
    },
  },
  execute: async (params, context) => {
    const to = params.to as string;
    const templateName = params.template_name as string;

    if (!to || !templateName) {
      return { error: 'to and template_name are required' };
    }

    // Rate limit check
    const rateCheck = checkRateLimit(context.tenantId);
    if (!rateCheck.allowed) {
      return {
        error: 'Rate limit exceeded. Maximum 10 notifications per minute per tenant.',
        remaining: rateCheck.remaining,
      };
    }

    // Verify the template exists
    const [template] = await db
      .select()
      .from(waTemplates)
      .where(
        and(
          eq(waTemplates.tenantId, context.tenantId),
          eq(waTemplates.name, templateName),
          eq(waTemplates.isActive, true),
        ),
      )
      .limit(1);

    if (!template) {
      return { error: `WhatsApp template '${templateName}' not found or inactive for this tenant` };
    }

    if (template.status !== 'APPROVED') {
      return { error: `Template '${templateName}' status is '${template.status}', must be APPROVED` };
    }

    // Parse template parameters
    const templateParams = params.parameters
      ? (params.parameters as string).split(',').map((p) => p.trim())
      : [];

    // Build Meta Cloud API request
    const phoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = config.WHATSAPP_ACCESS_TOKEN;
    const apiVersion = config.WHATSAPP_API_VERSION;

    if (!phoneNumberId || !accessToken) {
      // Still log the attempt but mark as failed
      await db.insert(notificationLog).values({
        tenantId: context.tenantId,
        type: 'whatsapp',
        recipient: to,
        subject: `Template: ${templateName}`,
        message: JSON.stringify({ template: templateName, parameters: templateParams }),
        status: 'failed',
        error: 'WhatsApp Cloud API not configured (missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN)',
      });

      return {
        error: 'WhatsApp Cloud API not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.',
        notification_logged: true,
      };
    }

    // Build components for template parameters
    const components: Array<Record<string, unknown>> = [];
    if (templateParams.length > 0) {
      components.push({
        type: 'body',
        parameters: templateParams.map((p) => ({ type: 'text', text: p })),
      });
    }

    // Send via Meta Cloud API
    const cleanPhone = to.replace(/\D/g, '');
    let apiStatus = 'sent';
    let apiError: string | null = null;
    let waMessageId: string | null = null;

    try {
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: cleanPhone,
            type: 'template',
            template: {
              name: templateName,
              language: { code: template.language },
              components,
            },
          }),
          signal: AbortSignal.timeout(15000),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        apiStatus = 'failed';
        apiError = `HTTP ${response.status}: ${errorBody}`;
      } else {
        const data = (await response.json()) as { messages?: Array<{ id: string }> };
        waMessageId = data.messages?.[0]?.id ?? null;
      }
    } catch (err) {
      apiStatus = 'failed';
      apiError = err instanceof Error ? err.message : 'Unknown error sending WhatsApp message';
    }

    // Find or create conversation
    let [conversation] = await db
      .select()
      .from(waConversations)
      .where(
        and(
          eq(waConversations.tenantId, context.tenantId),
          eq(waConversations.waContactPhone, cleanPhone),
        ),
      )
      .limit(1);

    if (!conversation) {
      [conversation] = await db
        .insert(waConversations)
        .values({
          tenantId: context.tenantId,
          waContactPhone: cleanPhone,
          status: 'ai_bot',
          lastMessageAt: new Date(),
        })
        .returning();
    }

    // Log the message
    await db.insert(waMessages).values({
      tenantId: context.tenantId,
      conversationId: conversation.id,
      waMessageId,
      direction: 'outbound',
      messageType: 'template',
      senderType: 'system',
      senderName: 'MCP Agent',
      body: `Template: ${templateName}`,
      deliveryStatus: apiStatus === 'sent' ? 'sent' : 'failed',
      metadata: { templateName, parameters: templateParams },
      errorMessage: apiError,
    });

    // Notification log
    await db.insert(notificationLog).values({
      tenantId: context.tenantId,
      type: 'whatsapp',
      recipient: to,
      subject: `Template: ${templateName}`,
      message: JSON.stringify({ template: templateName, parameters: templateParams }),
      status: apiStatus,
      error: apiError,
      sentAt: new Date(),
    });

    return {
      message: apiStatus === 'sent'
        ? `WhatsApp template '${templateName}' sent to ${to}`
        : `Failed to send WhatsApp template '${templateName}' to ${to}`,
      status: apiStatus,
      wa_message_id: waMessageId,
      template: templateName,
      recipient: to,
      error: apiError,
      rate_limit_remaining: rateCheck.remaining,
      timestamp: new Date().toISOString(),
    };
  },
};

// ── send_email ────────────────────────────────────────────────

export const sendEmail: MCPServerTool = {
  name: 'send_email',
  description:
    'Send an email notification. Uses the configured email provider (Resend, SendGrid, or SMTP). Rate limited to 10 per minute per tenant.',
  parameters: {
    to: {
      type: 'string',
      description: 'Recipient email address (required)',
      required: true,
    },
    subject: {
      type: 'string',
      description: 'Email subject line (required)',
      required: true,
    },
    body: {
      type: 'string',
      description: 'Email body content (plain text or HTML) (required)',
      required: true,
    },
    template: {
      type: 'string',
      description: 'Optional email template name to use',
      required: false,
    },
  },
  execute: async (params, context) => {
    const to = params.to as string;
    const subject = params.subject as string;
    const body = params.body as string;
    const template = params.template as string | undefined;

    if (!to || !subject || !body) {
      return { error: 'to, subject, and body are required' };
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return { error: `Invalid email address: ${to}` };
    }

    // Rate limit check
    const rateCheck = checkRateLimit(context.tenantId);
    if (!rateCheck.allowed) {
      return {
        error: 'Rate limit exceeded. Maximum 10 notifications per minute per tenant.',
        remaining: rateCheck.remaining,
      };
    }

    let sendStatus = 'pending';
    let sendError: string | null = null;

    // Determine email provider and send
    if (config.RESEND_API_KEY) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: config.EMAIL_FROM_ADDRESS
              ? `${config.EMAIL_FROM_NAME ?? 'AION Vision Hub'} <${config.EMAIL_FROM_ADDRESS}>`
              : 'AION Vision Hub <noreply@aionvisionhub.com>',
            to: [to],
            subject,
            html: body,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          sendStatus = 'failed';
          sendError = `Resend API error (${response.status}): ${errorBody}`;
        } else {
          sendStatus = 'sent';
        }
      } catch (err) {
        sendStatus = 'failed';
        sendError = err instanceof Error ? err.message : 'Unknown email send error';
      }
    } else if (config.SENDGRID_API_KEY) {
      try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.SENDGRID_API_KEY}`,
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: {
              email: config.EMAIL_FROM_ADDRESS ?? 'noreply@aionvisionhub.com',
              name: config.EMAIL_FROM_NAME ?? 'AION Vision Hub',
            },
            subject,
            content: [{ type: 'text/html', value: body }],
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          sendStatus = 'failed';
          sendError = `SendGrid API error (${response.status}): ${errorBody}`;
        } else {
          sendStatus = 'sent';
        }
      } catch (err) {
        sendStatus = 'failed';
        sendError = err instanceof Error ? err.message : 'Unknown email send error';
      }
    } else {
      sendStatus = 'failed';
      sendError = 'No email provider configured. Set RESEND_API_KEY or SENDGRID_API_KEY.';
    }

    // Log notification
    await db.insert(notificationLog).values({
      tenantId: context.tenantId,
      type: 'email',
      recipient: to,
      subject,
      message: body.substring(0, 1000),
      status: sendStatus,
      error: sendError,
      sentAt: sendStatus === 'sent' ? new Date() : null,
    });

    // Audit log
    await db.insert(auditLogs).values({
      tenantId: context.tenantId,
      userId: context.userId,
      userEmail: 'mcp-agent',
      action: 'mcp.notification.send_email',
      entityType: 'notification',
      afterState: {
        to,
        subject,
        template: template ?? null,
        status: sendStatus,
        error: sendError,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      message: sendStatus === 'sent'
        ? `Email sent successfully to ${to}`
        : `Failed to send email to ${to}`,
      status: sendStatus,
      recipient: to,
      subject,
      template: template ?? null,
      error: sendError,
      rate_limit_remaining: rateCheck.remaining,
      timestamp: new Date().toISOString(),
    };
  },
};

// ── get_notification_history ──────────────────────────────────

export const getNotificationHistory: MCPServerTool = {
  name: 'get_notification_history',
  description:
    'Get recent notification history for the tenant. Can filter by channel type and limit results.',
  parameters: {
    limit: {
      type: 'number',
      description: 'Maximum number of results (default: 50, max: 200)',
      required: false,
    },
    channel: {
      type: 'string',
      description: 'Filter by notification channel',
      required: false,
      enum: ['email', 'whatsapp', 'push', 'webhook'],
    },
  },
  execute: async (params, context) => {
    const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
    const conditions = [eq(notificationLog.tenantId, context.tenantId)];

    if (params.channel) {
      conditions.push(eq(notificationLog.type, params.channel as string));
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationLog)
      .where(and(...conditions));

    const rows = await db
      .select()
      .from(notificationLog)
      .where(and(...conditions))
      .orderBy(desc(notificationLog.createdAt))
      .limit(limit);

    // Summary stats
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recentStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        sent: sql<number>`count(*) filter (where ${notificationLog.status} = 'sent')::int`,
        failed: sql<number>`count(*) filter (where ${notificationLog.status} = 'failed')::int`,
        pending: sql<number>`count(*) filter (where ${notificationLog.status} = 'pending')::int`,
      })
      .from(notificationLog)
      .where(
        and(
          eq(notificationLog.tenantId, context.tenantId),
          gte(notificationLog.createdAt, oneHourAgo),
        ),
      );

    return {
      notifications: rows,
      total: countResult?.count ?? 0,
      returned: rows.length,
      last_hour_summary: {
        total: recentStats?.total ?? 0,
        sent: recentStats?.sent ?? 0,
        failed: recentStats?.failed ?? 0,
        pending: recentStats?.pending ?? 0,
      },
    };
  },
};

/** All notification tools */
export const notificationServerTools: MCPServerTool[] = [
  sendAlert,
  sendWhatsApp,
  sendEmail,
  getNotificationHistory,
];
