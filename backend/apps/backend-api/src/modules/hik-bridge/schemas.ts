import { z } from "zod";

// ═══════════════════════════════════════════
// PTZ Schemas
// ═══════════════════════════════════════════

export const ptzMoveSchema = z.object({
  channel: z.coerce.number().int().min(1).default(1),
  direction: z.enum([
    "up",
    "down",
    "left",
    "right",
    "left_up",
    "left_down",
    "right_up",
    "right_down",
    "zoom_in",
    "zoom_out",
    "iris_open",
    "iris_close",
    "focus_near",
    "focus_far",
    "auto_pan",
  ]),
  speed: z.coerce.number().int().min(1).max(7).default(4),
});

export const ptzStopSchema = z.object({
  channel: z.coerce.number().int().min(1).default(1),
});

export const ptzPresetSchema = z.object({
  channel: z.coerce.number().int().min(1).default(1),
  preset_index: z.coerce.number().int().min(1).max(256),
  action: z.enum(["goto", "set", "clear"]).default("goto"),
});

// ═══════════════════════════════════════════
// Recording Schemas
// ═══════════════════════════════════════════

export const recordingSearchSchema = z.object({
  device_ip: z.string().min(7),
  channel: z.coerce.number().int().min(1).default(1),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  file_type: z.coerce.number().int().default(0xff),
});

export const recordingDownloadSchema = z.object({
  device_ip: z.string().min(7),
  filename: z.string().min(1),
  channel: z.coerce.number().int().min(1).default(1),
});

// ═══════════════════════════════════════════
// Snapshot Schemas
// ═══════════════════════════════════════════

export const snapshotCaptureSchema = z.object({
  device_ip: z.string().min(7),
  channel: z.coerce.number().int().min(1).default(1),
  quality: z.coerce.number().int().min(0).max(2).default(2),
});

// ═══════════════════════════════════════════
// Device Schemas
// ═══════════════════════════════════════════

export const deviceLoginSchema = z.object({
  ip: z.string().min(7),
  port: z.coerce.number().int().default(8000),
  username: z.string().min(1),
  password: z.string().min(1),
  name: z.string().optional(),
  site_id: z.string().optional(),
  device_id: z.string().optional(),
});

export const bulkLoginSchema = z.array(deviceLoginSchema);

// ═══════════════════════════════════════════
// Discovery Schemas
// ═══════════════════════════════════════════

export const discoveryScanSchema = z.object({
  timeout: z.coerce.number().int().min(3).max(60).default(10),
});

// Type exports
export type PTZMoveInput = z.infer<typeof ptzMoveSchema>;
export type PTZPresetInput = z.infer<typeof ptzPresetSchema>;
export type RecordingSearchInput = z.infer<typeof recordingSearchSchema>;
export type RecordingDownloadInput = z.infer<typeof recordingDownloadSchema>;
export type SnapshotCaptureInput = z.infer<typeof snapshotCaptureSchema>;
export type DeviceLoginInput = z.infer<typeof deviceLoginSchema>;
