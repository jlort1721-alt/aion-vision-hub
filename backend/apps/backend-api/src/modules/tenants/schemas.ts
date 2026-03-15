import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(64),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  settings: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});
