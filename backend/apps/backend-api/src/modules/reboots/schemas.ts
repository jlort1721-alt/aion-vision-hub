import { z } from 'zod';

const rebootStatuses = ['pending', 'in_progress', 'completed', 'failed'] as const;

export const createRebootTaskSchema = z.object({
  deviceId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  reason: z.string().max(500).default(''),
});
export type CreateRebootTaskInput = z.infer<typeof createRebootTaskSchema>;

export const completeRebootSchema = z.object({
  status: z.enum(['completed', 'failed']),
  result: z.string().max(500).optional(),
  recoveryTimeSeconds: z.number().int().min(0).optional(),
});
export type CompleteRebootInput = z.infer<typeof completeRebootSchema>;

export const rebootFiltersSchema = z.object({
  status: z.enum(rebootStatuses).optional(),
  deviceId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
});
export type RebootFilters = z.infer<typeof rebootFiltersSchema>;
