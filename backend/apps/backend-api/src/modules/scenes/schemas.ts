import { z } from 'zod';

const sceneActions = ['on', 'off', 'toggle', 'pulse'] as const;

export const sceneActionSchema = z.object({
  deviceId: z.string().uuid(),
  action: z.enum(sceneActions),
  params: z.record(z.unknown()).optional(),
});
export type SceneAction = z.infer<typeof sceneActionSchema>;

export const createSceneSchema = z.object({
  name: z.string().min(1).max(255),
  siteId: z.string().uuid().optional(),
  icon: z.string().optional(),
  description: z.string().optional(),
  actions: z.array(sceneActionSchema).min(1),
  isActive: z.boolean().default(true),
});
export type CreateSceneInput = z.infer<typeof createSceneSchema>;

export const updateSceneSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  siteId: z.string().uuid().optional(),
  icon: z.string().optional(),
  description: z.string().optional(),
  actions: z.array(sceneActionSchema).min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateSceneInput = z.infer<typeof updateSceneSchema>;

export const listScenesFilterSchema = z.object({
  siteId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30),
});
export type ListScenesFilter = z.infer<typeof listScenesFilterSchema>;
