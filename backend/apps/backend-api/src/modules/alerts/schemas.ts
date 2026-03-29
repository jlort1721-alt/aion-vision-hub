import { z } from 'zod';

const severities = ['info', 'low', 'medium', 'high', 'critical'] as const;
const alertStatuses = ['firing', 'acknowledged', 'resolved', 'silenced'] as const;
const channelTypes = ['email', 'whatsapp', 'webhook', 'push'] as const;

// ── Alert Rule Schemas ──────────────────────────────────────

export const alertRuleConditionsSchema = z.object({
  eventType: z.string().max(64).optional(),
  severity: z.enum(severities).optional(),
  siteId: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
  timeRange: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
    end: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  }).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
});

export const alertRuleActionsSchema = z.object({
  emailRecipients: z.array(z.string().email()).optional(),
  whatsappPhones: z.array(z.string()).optional(),
  webhookUrl: z.string().url().optional(),
  notificationChannelIds: z.array(z.string().uuid()).optional(),
  escalationPolicyId: z.string().uuid().optional(),
  createIncident: z.boolean().optional(),
});

export const createAlertRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1024).optional(),
  conditions: alertRuleConditionsSchema,
  actions: alertRuleActionsSchema,
  severity: z.enum(severities).default('medium'),
  cooldownMinutes: z.coerce.number().int().min(1).max(1440).default(5),
  isActive: z.boolean().default(true),
});
export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;

export const updateAlertRuleSchema = createAlertRuleSchema.partial();
export type UpdateAlertRuleInput = z.infer<typeof updateAlertRuleSchema>;

export const alertRuleFiltersSchema = z.object({
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  severity: z.enum(severities).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export type AlertRuleFilters = z.infer<typeof alertRuleFiltersSchema>;

// ── Alert Instance Schemas ──────────────────────────────────

export const alertInstanceFiltersSchema = z.object({
  status: z.enum(alertStatuses).optional(),
  severity: z.enum(severities).optional(),
  ruleId: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export type AlertInstanceFilters = z.infer<typeof alertInstanceFiltersSchema>;

export const acknowledgeAlertSchema = z.object({
  note: z.string().max(1024).optional(),
});
export type AcknowledgeAlertInput = z.infer<typeof acknowledgeAlertSchema>;

// ── Escalation Policy Schemas ───────────────────────────────

export const escalationLevelSchema = z.object({
  level: z.coerce.number().int().min(1).max(5),
  notifyRoles: z.array(z.string()).default([]),
  notifyUsers: z.array(z.string().uuid()).default([]),
  notifyChannelIds: z.array(z.string().uuid()).default([]),
  timeoutMinutes: z.coerce.number().int().min(1).max(1440).default(15),
});

export const createEscalationPolicySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1024).optional(),
  levels: z.array(escalationLevelSchema).min(1).max(5),
  isActive: z.boolean().default(true),
});
export type CreateEscalationPolicyInput = z.infer<typeof createEscalationPolicySchema>;

export const updateEscalationPolicySchema = createEscalationPolicySchema.partial();
export type UpdateEscalationPolicyInput = z.infer<typeof updateEscalationPolicySchema>;

// ── Notification Channel Schemas ────────────────────────────

export const createNotificationChannelSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(channelTypes),
  config: z.record(z.string(), z.unknown()),
  isActive: z.boolean().default(true),
});
export type CreateNotificationChannelInput = z.infer<typeof createNotificationChannelSchema>;

export const updateNotificationChannelSchema = createNotificationChannelSchema.partial();
export type UpdateNotificationChannelInput = z.infer<typeof updateNotificationChannelSchema>;

// ── Notification Log Filters ────────────────────────────────

export const notificationLogFiltersSchema = z.object({
  type: z.enum(channelTypes).optional(),
  status: z.enum(['pending', 'sent', 'failed', 'delivered']).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});
export type NotificationLogFilters = z.infer<typeof notificationLogFiltersSchema>;
