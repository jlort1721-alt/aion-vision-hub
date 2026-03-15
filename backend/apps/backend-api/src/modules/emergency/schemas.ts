import { z } from 'zod';

const protocolTypes = ['intrusion', 'fire', 'medical', 'panic', 'natural_disaster', 'bomb_threat'] as const;
const contactRoles = ['police', 'fire_dept', 'ambulance', 'supervisor', 'admin', 'custom'] as const;
const activationStatuses = ['active', 'resolved', 'cancelled', 'false_alarm'] as const;

// ── Protocol Schemas ────────────────────────────────────────

export const createProtocolSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(protocolTypes),
  description: z.string().max(2048).optional(),
  steps: z.array(z.record(z.unknown())).default([]),
  autoActions: z.array(z.record(z.unknown())).default([]),
  priority: z.coerce.number().int().min(1).max(10).default(5),
  isActive: z.boolean().default(true),
});
export type CreateProtocolInput = z.infer<typeof createProtocolSchema>;

export const updateProtocolSchema = createProtocolSchema.partial();
export type UpdateProtocolInput = z.infer<typeof updateProtocolSchema>;

export const protocolFiltersSchema = z.object({
  type: z.enum(protocolTypes).optional(),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export type ProtocolFilters = z.infer<typeof protocolFiltersSchema>;

// ── Contact Schemas ─────────────────────────────────────────

export const createContactSchema = z.object({
  siteId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  role: z.enum(contactRoles),
  phone: z.string().min(1).max(50),
  email: z.string().email().max(255).optional(),
  priority: z.coerce.number().int().min(1).max(10).default(5),
  availableHours: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
});
export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = createContactSchema.partial();
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export const contactFiltersSchema = z.object({
  role: z.enum(contactRoles).optional(),
  siteId: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export type ContactFilters = z.infer<typeof contactFiltersSchema>;

// ── Activation Schemas ──────────────────────────────────────

export const createActivationSchema = z.object({
  protocolId: z.string().uuid(),
  siteId: z.string().uuid().optional(),
});
export type CreateActivationInput = z.infer<typeof createActivationSchema>;

export const updateActivationSchema = z.object({
  status: z.enum(activationStatuses).optional(),
  resolution: z.string().max(2048).optional(),
  timeline: z.array(z.record(z.unknown())).optional(),
});
export type UpdateActivationInput = z.infer<typeof updateActivationSchema>;

export const activationFiltersSchema = z.object({
  status: z.enum(activationStatuses).optional(),
  protocolId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});
export type ActivationFilters = z.infer<typeof activationFiltersSchema>;
