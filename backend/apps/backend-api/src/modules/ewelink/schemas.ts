import { z } from 'zod';

export const ewelinkLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  countryCode: z.string().default('+1'),
});
export type EWeLinkLoginInput = z.infer<typeof ewelinkLoginSchema>;

export const ewelinkControlSchema = z.object({
  deviceId: z.string().min(1),
  action: z.enum(['on', 'off', 'toggle']),
  outlet: z.number().int().min(0).optional(),
});
export type EWeLinkControlInput = z.infer<typeof ewelinkControlSchema>;

export const ewelinkBatchControlSchema = z.object({
  actions: z.array(ewelinkControlSchema).min(1).max(50),
});
export type EWeLinkBatchControlInput = z.infer<typeof ewelinkBatchControlSchema>;

export const ewelinkDeviceQuerySchema = z.object({
  deviceId: z.string().min(1),
});
export type EWeLinkDeviceQuery = z.infer<typeof ewelinkDeviceQuerySchema>;
