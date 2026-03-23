import { z } from 'zod';

const incidentPriorities = ['low', 'medium', 'high', 'critical'] as const;
const incidentStatuses = ['open', 'investigating', 'mitigating', 'pending', 'resolved', 'closed'] as const;
const evidenceTypes = ['snapshot', 'clip', 'log', 'note'] as const;

// ── Create Incident ─────────────────────────────────────────
export const createIncidentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().min(1, 'Description is required').max(8192),
  priority: z.enum(incidentPriorities).default('medium'),
  siteId: z.string().uuid('siteId must be a valid UUID').optional(),
  eventIds: z.array(z.string().uuid()).max(100).optional(),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

// ── Update Incident ─────────────────────────────────────────
export const updateIncidentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).max(8192).optional(),
  priority: z.enum(incidentPriorities).optional(),
  status: z.enum(incidentStatuses).optional(),
  assignedTo: z.string().uuid('assignedTo must be a valid UUID').optional(),
});

export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;

// ── Add Evidence ────────────────────────────────────────────
export const addEvidenceSchema = z.object({
  type: z.enum(evidenceTypes),
  url: z.string().url().max(1024).optional(),
  content: z.string().max(8192).optional(),
}).refine(
  (data) => data.url || data.content,
  { message: 'Either url or content must be provided' },
);

export type AddEvidenceInput = z.infer<typeof addEvidenceSchema>;

// ── Add Comment ─────────────────────────────────────────────
export const addCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(4096),
});

export type AddCommentInput = z.infer<typeof addCommentSchema>;

// ── Incident Filters ────────────────────────────────────────
export const incidentFiltersSchema = z.object({
  priority: z.enum(incidentPriorities).optional(),
  status: z.enum(incidentStatuses).optional(),
  siteId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(['createdAt', 'priority', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type IncidentFilters = z.infer<typeof incidentFiltersSchema>;
