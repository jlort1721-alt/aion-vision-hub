import { z } from 'zod';

const triggerTypes = ['event', 'schedule', 'device_status', 'threshold'] as const;
const actionTypes = [
  'send_alert',
  'create_incident',
  'send_whatsapp',
  'webhook',
  'toggle_device',
  'activate_protocol',
] as const;
const executionStatuses = ['success', 'partial', 'failed'] as const;

// ── Trigger Schema ─────────────────────────────────────────
const triggerSchema = z.object({
  type: z.enum(triggerTypes),
  config: z.record(z.unknown()).default({}),
});

// ── Condition Schema ───────────────────────────────────────
const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.string().min(1),
  value: z.unknown(),
});

// ── Action Schema ──────────────────────────────────────────
const actionSchema = z.object({
  type: z.enum(actionTypes),
  config: z.record(z.unknown()).default({}),
});

// ── Create Automation Rule ─────────────────────────────────
export const createAutomationRuleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(8192).optional(),
  trigger: triggerSchema,
  conditions: z.array(conditionSchema).optional(),
  actions: z.array(actionSchema).min(1, 'At least one action is required'),
  priority: z.number().int().min(0).max(1000).default(1),
  cooldownMinutes: z.number().int().min(0).max(10080).default(5),
  isActive: z.boolean().default(true),
});

export type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>;

// ── Update Automation Rule ─────────────────────────────────
export const updateAutomationRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(8192).optional(),
  trigger: triggerSchema.optional(),
  conditions: z.array(conditionSchema).optional(),
  actions: z.array(actionSchema).min(1).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  cooldownMinutes: z.number().int().min(0).max(10080).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateAutomationRuleInput = z.infer<typeof updateAutomationRuleSchema>;

// ── Automation Rule Filters ────────────────────────────────
export const automationRuleFiltersSchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type AutomationRuleFilters = z.infer<typeof automationRuleFiltersSchema>;

// ── Automation Execution Filters ───────────────────────────
export const automationExecutionFiltersSchema = z.object({
  ruleId: z.string().uuid().optional(),
  status: z.enum(executionStatuses).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type AutomationExecutionFilters = z.infer<typeof automationExecutionFiltersSchema>;
