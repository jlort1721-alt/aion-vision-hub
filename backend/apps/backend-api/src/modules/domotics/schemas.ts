import { z } from 'zod';

const domoticDeviceTypes = ['relay', 'sensor', 'switch', 'lock', 'siren', 'light', 'door'] as const;
const domoticStatuses = ['online', 'offline', 'error'] as const;
const domoticStates = ['on', 'off'] as const;

export const createDomoticDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  sectionId: z.string().uuid().optional(),
  type: z.enum(domoticDeviceTypes).default('relay'),
  brand: z.string().max(64).default('Sonoff'),
  model: z.string().max(128).default(''),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type CreateDomoticDeviceInput = z.infer<typeof createDomoticDeviceSchema>;

export const updateDomoticDeviceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sectionId: z.string().uuid().nullable().optional(),
  type: z.enum(domoticDeviceTypes).optional(),
  brand: z.string().max(64).optional(),
  model: z.string().max(128).optional(),
  status: z.enum(domoticStatuses).optional(),
  state: z.enum(domoticStates).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateDomoticDeviceInput = z.infer<typeof updateDomoticDeviceSchema>;

export const domoticFiltersSchema = z.object({
  sectionId: z.string().uuid().optional(),
  status: z.enum(domoticStatuses).optional(),
  type: z.enum(domoticDeviceTypes).optional(),
});
export type DomoticFilters = z.infer<typeof domoticFiltersSchema>;

export const domoticActionSchema = z.object({
  action: z.string().min(1).max(64),
});
export type DomoticActionInput = z.infer<typeof domoticActionSchema>;
