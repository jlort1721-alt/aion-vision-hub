import { z } from 'zod';

// ── Execute Tool ──────────────────────────────────────────────
export const executeToolSchema = z.object({
  toolName: z
    .string()
    .min(1, 'Tool name is required')
    .max(255, 'Tool name must be at most 255 characters'),
  params: z.record(z.unknown()).default({}),
});

export type ExecuteToolInput = z.infer<typeof executeToolSchema>;

// ── Connector Query ───────────────────────────────────────────
export const connectorQuerySchema = z.object({
  type: z.string().optional(),
  isActive: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export type ConnectorQueryInput = z.infer<typeof connectorQuerySchema>;
