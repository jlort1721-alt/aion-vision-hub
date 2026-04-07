import { z } from 'zod';

const categories = ['general', 'operativa', 'incidente', 'turno', 'dispositivo', 'mantenimiento'] as const;
const priorities = ['alta', 'media', 'baja'] as const;

export const createNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().max(4000).default(''),
  category: z.enum(categories).default('general'),
  priority: z.enum(priorities).default('media'),
  isPinned: z.boolean().default(false),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().max(4000).optional(),
  category: z.enum(categories).optional(),
  priority: z.enum(priorities).optional(),
  isPinned: z.boolean().optional(),
});
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export const noteFiltersSchema = z.object({
  category: z.enum(categories).optional(),
  search: z.string().max(128).optional(),
  pinned: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
});
export type NoteFilters = z.infer<typeof noteFiltersSchema>;
