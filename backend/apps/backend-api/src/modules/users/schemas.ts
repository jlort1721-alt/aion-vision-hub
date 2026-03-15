import { z } from 'zod';

export const createUserSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email().max(255),
  fullName: z.string().min(1).max(255),
  avatarUrl: z.string().url().max(1024).optional(),
  role: z.enum(['super_admin', 'tenant_admin', 'operator', 'viewer', 'auditor']).optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  avatarUrl: z.string().url().max(1024).nullable().optional(),
  isActive: z.boolean().optional(),
});
