import { z } from "zod";

export const searchRecordingsSchema = z.object({
  device_id: z.string().uuid(),
  channel: z.coerce.number().int().min(1).max(128),
  from: z.string().datetime(),
  to: z.string().datetime(),
});
export type SearchRecordingsInput = z.infer<typeof searchRecordingsSchema>;

export const playbackParamsSchema = z.object({
  device_id: z.string().uuid(),
  channel: z.coerce.number().int().min(1).max(128),
  from: z.string().datetime(),
  to: z.string().datetime(),
  format: z.enum(["hls", "mp4"]).optional().default("hls"),
});
export type PlaybackParamsInput = z.infer<typeof playbackParamsSchema>;

export const recordingItemSchema = z.object({
  track_id: z.string(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  duration_seconds: z.number(),
  size_bytes: z.number().nullable(),
  download_url: z.string().nullable(),
});
export type RecordingItem = z.infer<typeof recordingItemSchema>;
