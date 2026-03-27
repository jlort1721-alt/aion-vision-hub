import { z } from 'zod';

export const exportDataSchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  includeEvents: z.boolean().default(true),
  includeIncidents: z.boolean().default(true),
  includeAuditLogs: z.boolean().default(false),
});
export type ExportDataInput = z.infer<typeof exportDataSchema>;

export const deleteDataSchema = z.object({
  confirmEmail: z.string().email('Must confirm with your email'),
  reason: z.string().min(1).max(500).optional(),
  retainAuditLogs: z.boolean().default(true),
});
export type DeleteDataInput = z.infer<typeof deleteDataSchema>;

export const recordConsentSchema = z.object({
  consentType: z.enum(['terms_of_service', 'privacy_policy', 'data_processing', 'marketing', 'biometric_data']),
  version: z.string().min(1).max(32),
  granted: z.boolean(),
  ipAddress: z.string().optional(),
});
export type RecordConsentInput = z.infer<typeof recordConsentSchema>;

export const verifyIntegritySchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});
export type VerifyIntegrityInput = z.infer<typeof verifyIntegritySchema>;
