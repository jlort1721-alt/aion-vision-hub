import { z } from "zod";

const sceneWidgetSchema = z.object({
  type: z.enum(["camera", "door", "intercom", "iot", "events"]),
  deviceId: z.string().uuid().optional(),
  col: z.number().int().min(0).max(11),
  row: z.number().int().min(0).max(11),
  colSpan: z.number().int().min(1).max(12).default(3),
  rowSpan: z.number().int().min(1).max(12).default(3),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const createSceneSchema = z.object({
  name: z.string().min(1).max(100),
  layout: z.array(sceneWidgetSchema).max(64),
  isShared: z.boolean().default(false),
});

export const updateSceneSchema = createSceneSchema.partial();

export type CreateSceneInput = z.infer<typeof createSceneSchema>;
export type UpdateSceneInput = z.infer<typeof updateSceneSchema>;
