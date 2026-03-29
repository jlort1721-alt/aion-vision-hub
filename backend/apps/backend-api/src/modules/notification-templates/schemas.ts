import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────
export const templateCategories = [
  'alert',
  'incident',
  'shift',
  'visitor',
  'access',
  'system',
  'automation',
] as const;

export const templateChannels = ['email', 'whatsapp', 'push', 'all'] as const;

// ── Variable Definition ──────────────────────────────────────
export const templateVariableSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(255).optional(),
  sample: z.string().max(512).optional(),
});

export type TemplateVariable = z.infer<typeof templateVariableSchema>;

// ── Create ───────────────────────────────────────────────────
export const createNotificationTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1024).optional(),
  category: z.enum(templateCategories),
  channel: z.enum(templateChannels),
  subject: z.string().max(255).optional(),
  bodyTemplate: z.string().min(1).max(10_000),
  variables: z.array(templateVariableSchema).default([]),
  isSystem: z.boolean().default(false),
});
export type CreateNotificationTemplateInput = z.infer<typeof createNotificationTemplateSchema>;

// ── Update ───────────────────────────────────────────────────
export const updateNotificationTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1024).optional(),
  category: z.enum(templateCategories).optional(),
  channel: z.enum(templateChannels).optional(),
  subject: z.string().max(255).optional(),
  bodyTemplate: z.string().min(1).max(10_000).optional(),
  variables: z.array(templateVariableSchema).optional(),
});
export type UpdateNotificationTemplateInput = z.infer<typeof updateNotificationTemplateSchema>;

// ── List Filters ─────────────────────────────────────────────
export const notificationTemplateFiltersSchema = z.object({
  category: z.enum(templateCategories).optional(),
  channel: z.enum(templateChannels).optional(),
  search: z.string().max(128).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export type NotificationTemplateFilters = z.infer<typeof notificationTemplateFiltersSchema>;

// ── Preview ──────────────────────────────────────────────────
export const previewTemplateSchema = z.object({
  data: z.record(z.string(), z.string()).default({}),
});
export type PreviewTemplateInput = z.infer<typeof previewTemplateSchema>;

// ── Send Test ────────────────────────────────────────────────
export const sendTestNotificationSchema = z.object({
  templateId: z.string().uuid(),
  channel: z.enum(['email', 'whatsapp', 'push']),
  recipient: z.string().min(1).max(320),
  data: z.record(z.string(), z.string()).default({}),
});
export type SendTestNotificationInput = z.infer<typeof sendTestNotificationSchema>;
