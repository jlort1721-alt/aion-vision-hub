import { z } from "zod";

export const deviceFilterSchema = z.object({
  vendor: z.enum(["dahua", "hikvision"]).optional(),
  status: z.string().optional(),
  site_id: z.string().uuid().optional(),
});

export const approveDeviceSchema = z.object({
  display_name: z.string().min(1).optional(),
  site_id: z.string().uuid().optional(),
  channel_count: z.number().int().min(1).max(64).optional(),
});

export const startStreamSchema = z.object({
  channel: z.number().int().min(0).max(64),
});

export const ptzSchema = z.object({
  action: z.enum([
    "up",
    "down",
    "left",
    "right",
    "zoom_in",
    "zoom_out",
    "focus_near",
    "focus_far",
    "preset_goto",
    "preset_set",
    "stop",
  ]),
  speed: z.number().int().min(1).max(7).default(4),
  preset: z.number().int().optional(),
});

export const eventFilterSchema = z.object({
  kind: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  device_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export type DeviceFilter = z.infer<typeof deviceFilterSchema>;
export type ApproveDeviceInput = z.infer<typeof approveDeviceSchema>;
export type StartStreamInput = z.infer<typeof startStreamSchema>;
export type PtzInput = z.infer<typeof ptzSchema>;
export type EventFilter = z.infer<typeof eventFilterSchema>;
