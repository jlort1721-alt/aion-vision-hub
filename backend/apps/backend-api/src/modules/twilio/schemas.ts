import { z } from 'zod';

// ── WhatsApp ─────────────────────────────────────────────────

export const sendWhatsAppSchema = z.object({
  to: z.string().min(7).max(20),
  message: z.string().min(1).max(4096),
  mediaUrl: z.string().url().optional(),
  siteId: z.string().uuid().optional(),
});
export type SendWhatsAppInput = z.infer<typeof sendWhatsAppSchema>;

export const broadcastWhatsAppSchema = z.object({
  siteId: z.string().uuid(),
  message: z.string().min(1).max(4096),
  filter: z.object({
    apartment: z.string().optional(),
  }).optional(),
});
export type BroadcastWhatsAppInput = z.infer<typeof broadcastWhatsAppSchema>;

// ── Voice Calls ──────────────────────────────────────────────

export const makeCallSchema = z.object({
  to: z.string().min(7).max(20),
  message: z.string().max(1024).optional(),
  siteId: z.string().uuid().optional(),
});
export type MakeCallInput = z.infer<typeof makeCallSchema>;

export const emergencyCallSchema = z.object({
  to: z.string().min(7).max(20),
  siteName: z.string().min(1),
  alertType: z.string().min(1),
});
export type EmergencyCallInput = z.infer<typeof emergencyCallSchema>;

export const voiceTokenSchema = z.object({
  identity: z.string().min(1).max(100),
});
export type VoiceTokenInput = z.infer<typeof voiceTokenSchema>;

// ── SMS ──────────────────────────────────────────────────────

export const sendSmsSchema = z.object({
  to: z.string().min(7).max(20),
  message: z.string().min(1).max(1600),
  siteId: z.string().uuid().optional(),
});
export type SendSmsInput = z.infer<typeof sendSmsSchema>;

// ── Communication Logs Query ─────────────────────────────────

export const commLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  channel: z.enum(['whatsapp', 'sms', 'voice_call', 'emergency_call', 'whatsapp_template']).optional(),
  status: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});
export type CommLogQuery = z.infer<typeof commLogQuerySchema>;

// ── Notification Rules ───────────────────────────────────────

export const createNotificationRuleSchema = z.object({
  name: z.string().min(1).max(100),
  eventType: z.string().min(1).max(50),
  channel: z.enum(['whatsapp', 'sms', 'call', 'all']).default('whatsapp'),
  recipientType: z.enum(['admin', 'coordinator', 'technician', 'operator', 'supervisor', 'resident']).optional(),
  recipientOverride: z.string().max(30).optional(),
  messageTemplate: z.string().min(1),
  isActive: z.boolean().default(true),
  cooldownMinutes: z.number().int().min(0).default(60),
});
export type CreateNotificationRuleInput = z.infer<typeof createNotificationRuleSchema>;

export const updateNotificationRuleSchema = createNotificationRuleSchema.partial();
export type UpdateNotificationRuleInput = z.infer<typeof updateNotificationRuleSchema>;
