import { z } from "zod";

export const startRecordingSchema = z.object({
  cameraId: z.string().uuid(),
  durationSec: z.number().int().min(10).max(900).default(60),
  reason: z.string().min(1).max(500),
});

export type StartRecordingInput = z.infer<typeof startRecordingSchema>;
