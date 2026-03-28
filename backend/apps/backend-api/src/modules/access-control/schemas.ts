import { z } from 'zod';

const personTypes = ['resident', 'visitor', 'staff', 'provider'] as const;
const personStatuses = ['active', 'inactive', 'blocked'] as const;
const vehicleTypes = ['car', 'motorcycle', 'truck', 'bicycle'] as const;
const directions = ['in', 'out'] as const;
const methods = ['manual', 'qr', 'facial', 'plate', 'rfid'] as const;

export const createPersonSchema = z.object({
  sectionId: z.string().uuid().optional(),
  type: z.enum(personTypes).default('resident'),
  fullName: z.string().min(1).max(255),
  documentId: z.string().max(64).optional(),
  phone: z.string().max(32).optional(),
  email: z.string().email().max(255).optional(),
  unit: z.string().max(64).optional(),
  notes: z.string().max(1000).optional(),
  photoUrl: z.string().url().max(1024).optional(),
});
export type CreatePersonInput = z.infer<typeof createPersonSchema>;

export const updatePersonSchema = createPersonSchema.partial().extend({
  status: z.enum(personStatuses).optional(),
});
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

export const personFiltersSchema = z.object({
  sectionId: z.string().uuid().optional(),
  type: z.enum(personTypes).optional(),
  status: z.enum(personStatuses).optional(),
  search: z.string().max(128).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(500).optional(),
});
export type PersonFilters = z.infer<typeof personFiltersSchema>;

export const createVehicleSchema = z.object({
  personId: z.string().uuid(),
  plate: z.string().min(1).max(20),
  brand: z.string().max(64).optional(),
  model: z.string().max(64).optional(),
  color: z.string().max(32).optional(),
  type: z.enum(vehicleTypes).default('car'),
});
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  status: z.enum(['active', 'inactive'] as const).optional(),
});
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export const vehicleFiltersSchema = z.object({
  personId: z.string().uuid().optional(),
  type: z.enum(vehicleTypes).optional(),
  status: z.enum(['active', 'inactive'] as const).optional(),
  search: z.string().max(128).optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(500).optional(),
});
export type VehicleFilters = z.infer<typeof vehicleFiltersSchema>;

export const createAccessLogSchema = z.object({
  sectionId: z.string().uuid().optional(),
  personId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  direction: z.enum(directions).default('in'),
  method: z.enum(methods).default('manual'),
  notes: z.string().max(500).optional(),
});
export type CreateAccessLogInput = z.infer<typeof createAccessLogSchema>;

export const accessLogFiltersSchema = z.object({
  sectionId: z.string().uuid().optional(),
  personId: z.string().uuid().optional(),
  direction: z.enum(directions).optional(),
});
export type AccessLogFilters = z.infer<typeof accessLogFiltersSchema>;
