/**
 * WhatsApp Webhook Handler
 *
 * Handles:
 *   1. GET  /webhooks/whatsapp — Meta webhook verification (hub.challenge)
 *   2. POST /webhooks/whatsapp — Inbound messages + delivery statuses
 *
 * This module is registered as a PUBLIC route (no JWT auth required)
 * because Meta sends requests without bearer tokens.
 *
 * Security layers:
 *   - GET:  verify_token handshake (Meta sends token, we compare)
 *   - POST: X-Hub-Signature-256 HMAC verification (prevents spoofing)
 *   - POST: Zod payload validation (strict structure check)
 *   - POST: Replay protection (5-min timestamp window)
 *   - POST: Webhook-specific rate limiting (500 req/min per IP)
 *   - POST: Webhook audit trail (all events logged to audit_logs)
 *   - POST: PII sanitization in logs (phone numbers masked)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import rateLimit from '@fastify/rate-limit';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { integrations, auditLogs, waConversations } from '../../db/schema/index.js';
import { whatsappService } from './service.js';
import { whatsappAIAgent } from './ai-agent.js';
import { webhookPayloadSchema } from './schemas.js';
import { sanitizeWebhookLog } from './sanitize.js';
import { createLogger } from '@aion/common-utils';
import { config } from '../../config/env.js';

const logger = createLogger({ name: 'whatsapp-webhook' });

/** Sentinel user ID for webhook-generated audit entries (no real user). */
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

/** Max age in seconds for webhook payload timestamps before rejection. */
const MAX_WEBHOOK_AGE_SECONDS = 300; // 5 minutes

/** Clock-skew tolerance for timestamps in the future (seconds). */
const FUTURE_TOLERANCE_SECONDS = 60;

// ── Signature Verification ──────────────────────────────────

/**
 * Verify the X-Hub-Signature-256 header sent by Meta on every webhook POST.
 * Uses HMAC-SHA256 with the Meta App Secret and timing-safe comparison
 * to prevent both spoofing and timing attacks.
 */
export function verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string | undefined): boolean {
  if (!config.WHATSAPP_APP_SECRET) {
    logger.error('WHATSAPP_APP_SECRET not configured — rejecting webhook. Configure the secret to enable WhatsApp webhooks.');
    return false;
  }

  if (!signatureHeader) {
    logger.warn('Missing X-Hub-Signature-256 header on webhook POST');
    return false;
  }

  const expectedPrefix = 'sha256=';
  if (!signatureHeader.startsWith(expectedPrefix)) {
    logger.warn('Invalid signature format — missing sha256= prefix');
    return false;
  }

  const receivedSig = signatureHeader.slice(expectedPrefix.length);
  const expectedSig = createHmac('sha256', config.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest('hex');

  try {
    const receivedBuf = Buffer.from(receivedSig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');

    if (receivedBuf.length !== expectedBuf.length) {
      return false;
    }

    return timingSafeEqual(receivedBuf, expectedBuf);
  } catch {
    return false;
  }
}

// ── Replay Protection ───────────────────────────────────────

/**
 * Validate that the webhook payload is not a replay.
 * Checks timestamp fields in message/status objects against current time.
 * Returns true if the payload is fresh enough to process.
 */
export function isPayloadFresh(body: Record<string, unknown>): boolean {
  try {
    const entry = (body.entry as any[])?.[0];
    const change = entry?.changes?.[0];
    const messages = change?.value?.messages;
    const statuses = change?.value?.statuses;

    const items = [...(messages || []), ...(statuses || [])];
    if (!items.length) {
      // No messages or statuses — metadata-only event; allow it
      return true;
    }

    const now = Math.floor(Date.now() / 1000);

    for (const item of items) {
      const ts = Number(item.timestamp);
      if (!ts || isNaN(ts)) continue;

      const age = now - ts;
      if (age > MAX_WEBHOOK_AGE_SECONDS) return false;
      if (age < -FUTURE_TOLERANCE_SECONDS) return false;
    }

    return true;
  } catch {
    // If we can't parse timestamps, allow the payload
    // (signature verification is the primary security gate)
    return true;
  }
}

// ── Webhook Audit ───────────────────────────────────────────

/**
 * Write an audit entry for a webhook event.
 * Non-blocking: failures are logged but never prevent message processing.
 */
async function auditWebhookEvent(
  tenantId: string,
  action: string,
  resourceId?: string,
  details?: Record<string, unknown>,
  ipAddress?: string,
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      tenantId,
      userId: SYSTEM_USER_ID,
      userEmail: 'webhook@system',
      action,
      entityType: 'whatsapp',
      entityId: resourceId,
      afterState: details,
      ipAddress: ipAddress || null,
      userAgent: 'meta-webhook',
    });
  } catch (err) {
    logger.warn({ err, tenantId, action }, 'Failed to write webhook audit log');
  }
}

// ── Query Interface ─────────────────────────────────────────

interface WebhookVerifyQuery {
  'hub.mode'?: string;
  'hub.verify_token'?: string;
  'hub.challenge'?: string;
}

// ── Route Registration ──────────────────────────────────────

export async function registerWebhookRoutes(app: FastifyInstance) {
  // ── Webhook-specific rate limiting ──
  // Meta can burst during high-traffic periods. Use a generous limit
  // per source IP, separate from the global tenant+IP limiter.
  await app.register(rateLimit, {
    max: 500,
    timeWindow: '1 minute',
    keyGenerator: (request) => `webhook:${request.ip}`,
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: 'WEBHOOK_RATE_LIMITED',
        message: 'Too many webhook requests.',
      },
    }),
  });

  // Register raw body parsing so we can verify the signature against the original payload
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body, done) => {
      try {
        // Store raw body for signature verification, then parse JSON
        (req as any).rawBody = body;
        done(null, JSON.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // ── GET — Webhook Verification ──────────────────────────────
  app.get<{ Querystring: WebhookVerifyQuery }>(
    '/',
    async (request: FastifyRequest<{ Querystring: WebhookVerifyQuery }>, reply: FastifyReply) => {
      const mode = request.query['hub.mode'];
      const token = request.query['hub.verify_token'];
      const challenge = request.query['hub.challenge'];

      if (mode !== 'subscribe' || !token || !challenge) {
        logger.warn({ mode, hasToken: !!token }, 'Invalid webhook verification request');
        return reply.code(400).send('Bad Request');
      }

      // Direct indexed lookup by verifyToken (no O(n) scan)
      const [matching] = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.type, 'whatsapp'),
            sql`${integrations.config}->>'verifyToken' = ${token}`,
          ),
        )
        .limit(1);

      if (!matching) {
        logger.warn('Webhook verification failed: no matching verify_token');
        return reply.code(403).send('Forbidden');
      }

      logger.info({ tenantId: matching.tenantId }, 'Webhook verified');
      return reply.code(200).send(challenge);
    },
  );

  // ── POST — Inbound Messages & Status Updates ────────────────
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    // ── 1. Signature Verification ──
    const rawBody = (request as any).rawBody as string | undefined;
    const signature = request.headers['x-hub-signature-256'] as string | undefined;

    if (!verifyWebhookSignature(rawBody || '', signature)) {
      logger.warn({ ip: request.ip }, 'Webhook signature verification FAILED — rejecting request');
      return reply.code(401).send('Invalid signature');
    }

    // ── 2. Strict Payload Validation ──
    const parseResult = webhookPayloadSchema.safeParse(request.body);
    if (!parseResult.success) {
      logger.warn(
        { errors: parseResult.error.issues.slice(0, 5) },
        'Webhook payload validation failed',
      );
      return reply.code(400).send('Invalid payload structure');
    }

    const body = parseResult.data;

    // Always respond 200 immediately — Meta retries on non-200
    // Process asynchronously below
    reply.code(200).send('EVENT_RECEIVED');

    // ── 3. Replay Protection ──
    if (!isPayloadFresh(body as unknown as Record<string, unknown>)) {
      logger.warn({ ip: request.ip }, 'Webhook payload rejected: timestamp too old (possible replay)');
      return;
    }

    // Resolve tenant from the phone_number_id in the payload
    try {
      const entry = body.entry[0];
      const change = entry.changes[0];
      const phoneNumberId = change.value.metadata.phone_number_id;

      if (!phoneNumberId) {
        logger.warn({ body: sanitizeWebhookLog(body) }, 'No phone_number_id in webhook');
        return;
      }

      // Direct indexed lookup by phoneNumberId (O(1) via idx_integrations_wa_phone)
      const [integration] = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.type, 'whatsapp'),
            sql`${integrations.config}->>'phoneNumberId' = ${phoneNumberId}`,
          ),
        )
        .limit(1);

      if (!integration) {
        logger.warn({ phoneNumberId }, 'No tenant found for phone_number_id');
        return;
      }

      const tenantId = integration.tenantId;

      // Process the webhook payload (messages + statuses)
      await whatsappService.processInboundMessage(tenantId, body as unknown as Record<string, unknown>);

      // ── 4. Webhook Audit Trail ──
      const messages = change.value.messages;
      if (messages?.length) {
        await auditWebhookEvent(
          tenantId,
          'whatsapp.webhook.message_received',
          undefined,
          {
            messageCount: messages.length,
            messageTypes: messages.map((m) => m.type),
          },
          request.ip,
        );

        // Run AI agent for inbound messages
        for (const msg of messages) {
          const from = msg.from;
          const sanitizedPhone = from.replace(/[^0-9+]/g, '');

          const [conversation] = await db
            .select()
            .from(waConversations)
            .where(
              and(
                eq(waConversations.tenantId, tenantId),
                eq(waConversations.waContactPhone, sanitizedPhone),
              ),
            )
            .limit(1);

          if (conversation && conversation.status === 'ai_bot') {
            const messageBody =
              msg.text?.body ||
              (msg.interactive as any)?.button_reply?.title ||
              (msg.interactive as any)?.list_reply?.title ||
              '';

            if (messageBody) {
              await whatsappAIAgent.handleInboundMessage(
                tenantId,
                conversation.id,
                messageBody,
                sanitizedPhone,
              );
            }
          }
        }
      }

      const statuses = change.value.statuses;
      if (statuses?.length) {
        await auditWebhookEvent(
          tenantId,
          'whatsapp.webhook.status_update',
          undefined,
          {
            statusCount: statuses.length,
            statuses: statuses.map((s) => s.status),
          },
          request.ip,
        );
      }
    } catch (err) {
      // We already sent 200, so just log the error
      logger.error({ err }, 'Error processing webhook payload');
    }
  });
}
