import { z } from 'zod';

export const CreateProgramInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.enum(['safety', 'technology', 'compliance', 'first_aid', 'emergency', 'firearms', 'customer_service']),
  durationHours: z.number().int().positive(),
  isRequired: z.boolean().default(false),
  validityMonths: z.number().int().min(0).default(12),
  passingScore: z.number().int().min(0).max(100).default(70),
  content: z.array(z.any()).default([]),
});

export const UpdateProgramInput = CreateProgramInput.partial();

export const ProgramFilters = z.object({
  category: z.string().optional(),
  isRequired: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

export const CreateCertificationInput = z.object({
  programId: z.string().uuid(),
  userId: z.string().uuid(),
  userName: z.string().min(1).max(255),
});

export const CompleteCertificationInput = z.object({
  score: z.number().int().min(0).max(100),
  notes: z.string().optional(),
});

export const UpdateCertificationInput = z.object({
  status: z.enum(['enrolled', 'in_progress', 'completed', 'expired', 'failed']).optional(),
  score: z.number().int().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export const CertificationFilters = z.object({
  programId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateProgramInput = z.infer<typeof CreateProgramInput>;
export type UpdateProgramInput = z.infer<typeof UpdateProgramInput>;
export type ProgramFilters = z.infer<typeof ProgramFilters>;
export type CreateCertificationInput = z.infer<typeof CreateCertificationInput>;
export type CompleteCertificationInput = z.infer<typeof CompleteCertificationInput>;
export type UpdateCertificationInput = z.infer<typeof UpdateCertificationInput>;
export type CertificationFilters = z.infer<typeof CertificationFilters>;
