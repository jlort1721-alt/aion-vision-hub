import { z } from 'zod';

const priorities = ['normal', 'high', 'emergency'] as const;

export const broadcastSchema = z.object({
  message: z.string().min(1).max(2000),
  targetSites: z.array(z.string().uuid()).min(1),
  targetZones: z.array(z.string()).optional(),
  priority: z.enum(priorities).default('normal'),
  ttsMode: z.boolean().default(true),
});
export type BroadcastInput = z.infer<typeof broadcastSchema>;

export const pagingTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  priority: z.enum(priorities).default('normal'),
  isEmergency: z.boolean().default(false),
});
export type PagingTemplateInput = z.infer<typeof pagingTemplateSchema>;

export const broadcastFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30),
  siteId: z.string().uuid().optional(),
  priority: z.enum(priorities).optional(),
});
export type BroadcastFilters = z.infer<typeof broadcastFiltersSchema>;
