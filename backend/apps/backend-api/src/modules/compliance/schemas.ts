import { z } from 'zod';

export const CreateTemplateInput = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['habeas_data', 'consent_form', 'privacy_policy', 'data_retention', 'incident_report', 'data_breach_notification']),
  content: z.string().min(1),
  version: z.number().int().positive().default(1),
});

export const UpdateTemplateInput = CreateTemplateInput.partial();

export const TemplateFilters = z.object({
  type: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

export const CreateRetentionPolicyInput = z.object({
  name: z.string().min(1).max(255),
  dataType: z.enum(['video_footage', 'event_logs', 'access_logs', 'visitor_records', 'audit_logs', 'personal_data']),
  retentionDays: z.number().int().positive(),
  action: z.enum(['delete', 'archive', 'anonymize']).default('delete'),
});

export const UpdateRetentionPolicyInput = CreateRetentionPolicyInput.partial();

export const RetentionPolicyFilters = z.object({
  dataType: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateTemplateInput = z.infer<typeof CreateTemplateInput>;
export type UpdateTemplateInput = z.infer<typeof UpdateTemplateInput>;
export type TemplateFilters = z.infer<typeof TemplateFilters>;
export type CreateRetentionPolicyInput = z.infer<typeof CreateRetentionPolicyInput>;
export type UpdateRetentionPolicyInput = z.infer<typeof UpdateRetentionPolicyInput>;
export type RetentionPolicyFilters = z.infer<typeof RetentionPolicyFilters>;
