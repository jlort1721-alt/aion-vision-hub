import { z } from "zod";

export const listDoorsQuerySchema = z.object({
  site_id: z.string().uuid().optional(),
  active_only: z
    .union([z.boolean(), z.string().transform((v) => v === "true")])
    .optional()
    .default(true),
});
export type ListDoorsQuery = z.infer<typeof listDoorsQuerySchema>;

export const openDoorBodySchema = z.object({
  door_id: z.string().uuid(),
  reason: z.string().min(3).max(500),
  duration_seconds: z.number().int().min(1).max(60).optional().default(5),
});
export type OpenDoorBody = z.infer<typeof openDoorBodySchema>;

export const doorHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type DoorHistoryQuery = z.infer<typeof doorHistoryQuerySchema>;

export const doorStatusResponseSchema = z.object({
  door_id: z.string().uuid(),
  name: z.string().nullable(),
  site_id: z.string().uuid().nullable(),
  online: z.boolean(),
  last_event_at: z.string().datetime().nullable(),
  has_intercom: z.boolean(),
  has_ivms: z.boolean(),
  has_hikconnect: z.boolean(),
});
export type DoorStatusResponse = z.infer<typeof doorStatusResponseSchema>;
