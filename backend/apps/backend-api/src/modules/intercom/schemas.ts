import { z } from 'zod';

// ── Enums ─────────────────────────────────────────────────

const intercomStatuses = ['online', 'offline', 'ringing', 'busy'] as const;
const callDirections = ['inbound', 'outbound'] as const;
const callStatuses = ['completed', 'missed', 'rejected', 'failed'] as const;
const callSessionStatuses = ['initiating', 'ringing', 'answered', 'on_hold', 'completed', 'missed', 'rejected', 'failed', 'busy'] as const;
const callModes = ['ai', 'human', 'mixed'] as const;
const sipTransports = ['udp', 'tcp', 'tls', 'wss'] as const;
const intercomBrands = ['fanvil', 'hikvision', 'dahua', 'akuvox', 'generic_sip'] as const;

// ── Device Schemas ────────────────────────────────────────

export const createIntercomDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  sectionId: z.string().uuid().optional(),
  brand: z.string().max(64).default('Fanvil'),
  model: z.string().max(128).default(''),
  ipAddress: z.string().max(45).optional(),
  sipUri: z.string().max(255).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type CreateIntercomDeviceInput = z.infer<typeof createIntercomDeviceSchema>;

export const updateIntercomDeviceSchema = createIntercomDeviceSchema.partial().extend({
  status: z.enum(intercomStatuses).optional(),
});
export type UpdateIntercomDeviceInput = z.infer<typeof updateIntercomDeviceSchema>;

export const intercomFiltersSchema = z.object({
  sectionId: z.string().uuid().optional(),
  status: z.enum(intercomStatuses).optional(),
});
export type IntercomFilters = z.infer<typeof intercomFiltersSchema>;

// ── Legacy Call Log Schemas ───────────────────────────────

export const createCallLogSchema = z.object({
  deviceId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  direction: z.enum(callDirections).default('inbound'),
  durationSeconds: z.number().int().min(0).optional(),
  attendedBy: z.string().max(128).default('operator'),
  status: z.enum(callStatuses).default('completed'),
  notes: z.string().max(500).optional(),
});
export type CreateCallLogInput = z.infer<typeof createCallLogSchema>;

export const callLogFiltersSchema = z.object({
  deviceId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  direction: z.enum(callDirections).optional(),
});
export type CallLogFilters = z.infer<typeof callLogFiltersSchema>;

// ── Call Session Schemas ──────────────────────────────────

export const initiateCallSchema = z.object({
  deviceId: z.string().uuid().optional(),
  targetUri: z.string().min(1).max(255),
  sourceExtension: z.string().max(64).optional(),
  mode: z.enum(callModes).default('mixed'),
  autoAnswer: z.boolean().default(false),
  priority: z.enum(['normal', 'emergency']).default('normal'),
  greetingContext: z.enum(['default', 'after_hours', 'emergency', 'maintenance', 'custom']).optional(),
  customGreetingText: z.string().max(500).optional(),
});
export type InitiateCallInput = z.infer<typeof initiateCallSchema>;

export const callSessionFiltersSchema = z.object({
  deviceId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  direction: z.enum(callDirections).optional(),
  status: z.enum(callSessionStatuses).optional(),
  mode: z.enum(callModes).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type CallSessionFilters = z.infer<typeof callSessionFiltersSchema>;

export const updateCallSessionSchema = z.object({
  status: z.enum(callSessionStatuses).optional(),
  attendedBy: z.string().max(128).optional(),
  visitorName: z.string().max(255).optional(),
  visitorDestination: z.string().max(255).optional(),
  accessGranted: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  handoffReason: z.string().max(255).optional(),
});
export type UpdateCallSessionInput = z.infer<typeof updateCallSessionSchema>;

// ── Door Action Schema ────────────────────────────────────

export const doorActionSchema = z.object({
  deviceId: z.string().uuid(),
  relayIndex: z.number().int().min(1).max(4).default(1),
});
export type DoorActionInput = z.infer<typeof doorActionSchema>;

// ── Device Test Schema ────────────────────────────────────

export const testDeviceSchema = z.object({
  ipAddress: z.string().min(7).max(45).regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, 'Must be a valid IPv4 address'),
  brand: z.enum(intercomBrands).default('fanvil'),
  credentials: z.object({
    username: z.string().min(1).max(64),
    password: z.string().min(1).max(128),
  }).optional(),
});
export type TestDeviceInput = z.infer<typeof testDeviceSchema>;

// ── Device Provision Schema ───────────────────────────────

export const provisionDeviceSchema = z.object({
  deviceId: z.string().uuid(),
  sipUsername: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/, 'SIP username must be alphanumeric'),
  sipPassword: z.string().min(8).max(128),
  displayName: z.string().max(128).optional(),
  lineIndex: z.number().int().min(1).max(6).default(1),
});
export type ProvisionDeviceInput = z.infer<typeof provisionDeviceSchema>;

// ── VoIP Config Schema ────────────────────────────────────

export const voipConfigSchema = z.object({
  sipHost: z.string().max(255).optional(),
  sipPort: z.number().int().min(1).max(65535).optional(),
  sipTransport: z.enum(sipTransports).optional(),
  sipDomain: z.string().max(255).optional(),
  pbxType: z.enum(['asterisk', 'freeswitch', 'freepbx', '3cx', 'cloud', 'none']).optional(),
  ariUrl: z.string().max(500).optional(),
  ariUsername: z.string().max(128).optional(),
  ariPassword: z.string().max(256).optional(),
  defaultMode: z.enum(callModes).optional(),
  greetingContext: z.enum(['default', 'after_hours', 'emergency', 'maintenance', 'custom']).optional(),
  greetingLanguage: z.enum(['es', 'en']).optional(),
  greetingVoiceId: z.string().max(128).optional(),
  aiTimeoutSeconds: z.number().int().min(5).max(120).optional(),
  doorOpenDtmf: z.string().max(4).optional(),
  autoOpenEnabled: z.boolean().optional(),
  operatorExtension: z.string().max(32).optional(),
  recordingEnabled: z.boolean().optional(),
  afterHoursSchedule: z.string().max(32).optional(), // "HH:MM-HH:MM" or "HH:MM-HH:MM|1-5"
  fanvilAdminUser: z.string().max(64).optional(),
  fanvilAdminPassword: z.string().max(128).optional(),
  autoProvisionEnabled: z.boolean().optional(),
  customSiteName: z.string().max(255).optional(),
});
export type VoipConfigInput = z.infer<typeof voipConfigSchema>;

// ── Inbound Session Schema ────────────────────────────────

export const inboundSessionSchema = z.object({
  callerUri: z.string().max(255).optional(),
  deviceId: z.string().uuid().optional(),
  sipCallId: z.string().max(255).optional(),
});
export type InboundSessionInput = z.infer<typeof inboundSessionSchema>;

// ── End Session Schema ────────────────────────────────────

export const endSessionSchema = z.object({
  notes: z.string().max(1000).optional(),
});
export type EndSessionInput = z.infer<typeof endSessionSchema>;

// ── Handoff Schema ────────────────────────────────────────

export const handoffSchema = z.object({
  reason: z.string().max(255).optional(),
});
export type HandoffInput = z.infer<typeof handoffSchema>;

// ── SIP Health Check Schema ───────────────────────────────

export const sipHealthSchema = z.object({
  includePbx: z.boolean().default(true),
  includeDevices: z.boolean().default(false),
});
export type SipHealthInput = z.infer<typeof sipHealthSchema>;
