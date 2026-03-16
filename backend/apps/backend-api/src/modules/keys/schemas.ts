import { z } from 'zod';

export const CreateKeyInput = z.object({
  keyCode: z.string().min(1).max(64),
  label: z.string().min(1).max(255),
  description: z.string().optional(),
  keyType: z.enum(['master', 'access', 'cabinet', 'vehicle', 'other']).default('access'),
  siteId: z.string().uuid().optional(),
  location: z.string().max(255).optional(),
  copies: z.number().int().positive().default(1),
  notes: z.string().optional(),
});

export const UpdateKeyInput = CreateKeyInput.partial();

export const KeyFilters = z.object({
  status: z.string().optional(),
  siteId: z.string().uuid().optional(),
  keyType: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

export const AssignKeyInput = z.object({
  toHolder: z.string().min(1).max(255),
  notes: z.string().optional(),
});

export const ReturnKeyInput = z.object({
  notes: z.string().optional(),
});

export const KeyLogFilters = z.object({
  keyId: z.string().uuid().optional(),
  action: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateKeyInput = z.infer<typeof CreateKeyInput>;
export type UpdateKeyInput = z.infer<typeof UpdateKeyInput>;
export type KeyFilters = z.infer<typeof KeyFilters>;
export type AssignKeyInput = z.infer<typeof AssignKeyInput>;
export type ReturnKeyInput = z.infer<typeof ReturnKeyInput>;
export type KeyLogFilters = z.infer<typeof KeyLogFilters>;
