import { z } from "zod";

export const deviceFilterSchema = z.object({
  vendor: z.enum(["dahua", "hikvision"]).optional(),
  status: z.string().optional(),
  site_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const approveDeviceSchema = z.object({
  display_name: z.string().max(128).optional(),
  site_id: z.string().uuid().optional(),
  channel_count: z.number().int().min(1).max(256).optional(),
  username: z.string().min(1).max(64).optional(),
  password: z.string().min(1).max(128).optional(),
  isup_key: z.string().max(64).optional(),
});

export const startStreamSchema = z.object({
  channel: z.number().int().min(1).max(256),
  format: z.enum(["rtsp", "hls", "webrtc"]).default("webrtc"),
});

export const ptzSchema = z.object({
  channel: z.number().int().min(1).max(256).default(1),
  action: z.enum([
    "pan_left",
    "pan_right",
    "tilt_up",
    "tilt_down",
    "zoom_in",
    "zoom_out",
    "focus_near",
    "focus_far",
    "iris_open",
    "iris_close",
    "stop",
    "goto_preset",
  ]),
  speed: z.number().int().min(1).max(8).default(4),
  preset: z.number().int().min(0).max(255).optional(),
});

export const eventFilterSchema = z.object({
  kind: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  device_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

export type DeviceFilter = z.infer<typeof deviceFilterSchema>;
export type ApproveDeviceInput = z.infer<typeof approveDeviceSchema>;
export type StartStreamInput = z.infer<typeof startStreamSchema>;
export type PtzInput = z.infer<typeof ptzSchema>;
export type EventFilter = z.infer<typeof eventFilterSchema>;
