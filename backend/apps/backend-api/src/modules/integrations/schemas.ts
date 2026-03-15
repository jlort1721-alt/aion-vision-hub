import { z } from 'zod';

// ── Integration Types ─────────────────────────────────────────
const integrationTypes = ['webhook', 'whatsapp', 'email', 'sms', 'slack', 'mcp', 'custom'] as const;

// ── Create Integration ────────────────────────────────────────
export const createIntegrationSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be at most 255 characters'),
  type: z.enum(integrationTypes, {
    errorMap: () => ({ message: `Type must be one of: ${integrationTypes.join(', ')}` }),
  }),
  config: z.record(z.unknown()).default({}),
  isActive: z.boolean().optional().default(true),
});

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;

// ── Update Integration ────────────────────────────────────────
export const updateIntegrationSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be at most 255 characters')
    .optional(),
  config: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;

// ── Query Params ──────────────────────────────────────────────
export const integrationQuerySchema = z.object({
  type: z.enum(integrationTypes).optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export type IntegrationQueryInput = z.infer<typeof integrationQuerySchema>;
