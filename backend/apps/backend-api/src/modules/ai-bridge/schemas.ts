import { z } from 'zod';

// ── Chat Message ──────────────────────────────────────────────
const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant'], {
    error: 'Role must be one of: system, user, assistant',
  }),
  content: z.string().min(1, 'Message content cannot be empty'),
});

// ── AI Providers ──────────────────────────────────────────────
const aiProviders = ['openai', 'anthropic'] as const;

// ── Chat Request ──────────────────────────────────────────────
export const chatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1, 'At least one message is required')
    .max(100, 'Maximum 100 messages per request'),
  model: z.string().optional(),
  provider: z.enum(aiProviders).optional(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().int().min(1).max(16384).optional().default(2048),
  enableTools: z.boolean().optional().default(false),
});

/** Parsed (output) type — defaults are resolved, all fields present */
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
/** Raw (input) type — callers may omit fields that have defaults */
export type ChatRequestRawInput = z.input<typeof chatRequestSchema>;

// ── Chat Stream Request ───────────────────────────────────────
export const chatStreamRequestSchema = chatRequestSchema.extend({
  stream: z.literal(true).default(true),
});

export type ChatStreamRequestInput = z.infer<typeof chatStreamRequestSchema>;

// ── Usage Query ───────────────────────────────────────────────
export const usageQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  provider: z.enum(aiProviders).optional(),
});

export type UsageQueryInput = z.infer<typeof usageQuerySchema>;
