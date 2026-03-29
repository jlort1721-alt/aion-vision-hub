import { z } from 'zod';

// ── Phone number validation ──────────────────────────────────
const phoneSchema = z
  .string()
  .min(10)
  .max(32)
  .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format');

// ── Send Message ─────────────────────────────────────────────
export const sendMessageSchema = z.object({
  to: phoneSchema,
  type: z.enum(['text', 'template', 'image', 'document', 'audio', 'video', 'interactive']),
  body: z.string().max(4096).optional(),
  templateName: z.string().max(255).optional(),
  templateLanguage: z.string().max(16).optional(),
  templateParams: z.array(z.string()).optional(),
  mediaUrl: z.string().url().optional(),
  caption: z.string().max(1024).optional(),
  filename: z.string().max(255).optional(),
  interactive: z
    .object({
      type: z.enum(['button', 'list']),
      header: z.string().max(60).optional(),
      body: z.string().max(1024),
      footer: z.string().max(60).optional(),
      buttons: z
        .array(z.object({ id: z.string().max(256), title: z.string().max(20) }))
        .max(3)
        .optional(),
      sections: z
        .array(
          z.object({
            title: z.string().max(24),
            rows: z.array(
              z.object({
                id: z.string().max(200),
                title: z.string().max(24),
                description: z.string().max(72).optional(),
              }),
            ),
          }),
        )
        .max(10)
        .optional(),
    })
    .optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// ── Quick Reply ──────────────────────────────────────────────
export const quickReplySchema = z.object({
  to: phoneSchema,
  body: z.string().max(1024),
  buttons: z
    .array(z.object({ id: z.string().max(256), title: z.string().max(20) }))
    .min(1)
    .max(3),
});

export type QuickReplyInput = z.infer<typeof quickReplySchema>;

// ── Conversation Queries ─────────────────────────────────────
export const conversationQuerySchema = z.object({
  status: z.enum(['ai_bot', 'human_agent', 'closed']).optional(),
  phone: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type ConversationQueryInput = z.infer<typeof conversationQuerySchema>;

// ── Handoff to Human ─────────────────────────────────────────
export const handoffSchema = z.object({
  conversationId: z.string().uuid(),
  assignTo: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
});

export type HandoffInput = z.infer<typeof handoffSchema>;

// ── Close Conversation ───────────────────────────────────────
export const closeConversationSchema = z.object({
  conversationId: z.string().uuid(),
  resolution: z.string().max(500).optional(),
});

export type CloseConversationInput = z.infer<typeof closeConversationSchema>;

// ── WhatsApp Config (stored encrypted in integrations.config) ─
export const waConfigSchema = z.object({
  phoneNumberId: z.string().min(1, 'Phone Number ID is required'),
  accessToken: z.string().min(1, 'Access Token is required'),
  businessAccountId: z.string().min(1, 'Business Account ID is required'),
  verifyToken: z.string().min(8, 'Verify Token must be at least 8 characters'),
  apiVersion: z.string().default('v21.0'),
  aiAgentEnabled: z.boolean().default(true),
  aiSystemPrompt: z.string().max(4000).optional(),
  autoReplyOutsideHours: z.string().max(500).optional(),
  businessHoursStart: z.string().optional(), // HH:mm
  businessHoursEnd: z.string().optional(),
  businessTimezone: z.string().default('UTC'),
  maxRetries: z.coerce.number().min(0).max(5).default(3),
});

export type WAConfigInput = z.infer<typeof waConfigSchema>;

// ── Webhook Verification (GET from Meta) ─────────────────────
export const webhookVerifySchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string(),
});

// ── Message Query ────────────────────────────────────────────
export const messageQuerySchema = z.object({
  conversationId: z.string().uuid(),
  limit: z.coerce.number().min(1).max(200).default(50),
  before: z.string().datetime().optional(),
});

export type MessageQueryInput = z.infer<typeof messageQuerySchema>;

// ── Template Sync ────────────────────────────────────────────
export const templateSyncSchema = z.object({
  force: z.boolean().default(false),
});

// ══════════════════════════════════════════════════════════════
// Meta Webhook Payload Schemas (POST from Meta Cloud API)
// All sub-schemas use .passthrough() to tolerate new fields Meta may add.
// ══════════════════════════════════════════════════════════════

const webhookMessageSchema = z
  .object({
    from: z.string(),
    id: z.string(),
    timestamp: z.string(),
    type: z.string(),
    text: z.object({ body: z.string() }).optional(),
    image: z.record(z.string(), z.unknown()).optional(),
    video: z.record(z.string(), z.unknown()).optional(),
    audio: z.record(z.string(), z.unknown()).optional(),
    document: z.record(z.string(), z.unknown()).optional(),
    location: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        name: z.string().optional(),
        address: z.string().optional(),
      })
      .optional(),
    interactive: z.record(z.string(), z.unknown()).optional(),
    reaction: z
      .object({ message_id: z.string(), emoji: z.string() })
      .optional(),
    context: z
      .object({ from: z.string().optional(), id: z.string().optional() })
      .optional(),
  })
  .passthrough();

const webhookStatusSchema = z
  .object({
    id: z.string(),
    status: z.enum(['sent', 'delivered', 'read', 'failed']),
    timestamp: z.string(),
    recipient_id: z.string().optional(),
    errors: z
      .array(
        z.object({
          code: z.number().optional(),
          title: z.string().optional(),
        }),
      )
      .optional(),
  })
  .passthrough();

const webhookContactSchema = z
  .object({
    profile: z.object({ name: z.string().optional() }).optional(),
    wa_id: z.string().optional(),
  })
  .passthrough();

const webhookMetadataSchema = z
  .object({
    display_phone_number: z.string().optional(),
    phone_number_id: z.string(),
  })
  .passthrough();

const webhookChangeValueSchema = z
  .object({
    messaging_product: z.literal('whatsapp'),
    metadata: webhookMetadataSchema,
    messages: z.array(webhookMessageSchema).optional(),
    statuses: z.array(webhookStatusSchema).optional(),
    contacts: z.array(webhookContactSchema).optional(),
  })
  .passthrough();

const webhookChangeSchema = z
  .object({
    value: webhookChangeValueSchema,
    field: z.string(),
  })
  .passthrough();

const webhookEntrySchema = z
  .object({
    id: z.string(),
    changes: z.array(webhookChangeSchema).min(1),
  })
  .passthrough();

export const webhookPayloadSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(webhookEntrySchema).min(1),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
