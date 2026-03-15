import { z } from 'zod';

export const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['super_admin', 'tenant_admin', 'operator', 'viewer', 'auditor']),
  tenantId: z.string().uuid().optional(),
});
