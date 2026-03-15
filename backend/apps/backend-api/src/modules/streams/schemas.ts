import { z } from 'zod';

const streamTypes = ['main', 'sub', 'third'] as const;
const streamProtocols = ['rtsp', 'webrtc', 'hls'] as const;

// ── Stream Profile (within a registration) ──────────────────
const streamProfileSchema = z.object({
  type: z.enum(streamTypes),
  url: z.string().min(1, 'Stream URL is required').max(512),
  codec: z.string().min(1).max(32),
  resolution: z.string().min(1).max(32),
  fps: z.coerce.number().int().min(1).max(120),
  bitrate: z.coerce.number().int().optional(),
  channel: z.coerce.number().int().min(0).optional(),
});

// ── Register Stream ─────────────────────────────────────────
export const registerStreamSchema = z.object({
  deviceId: z.string().uuid('deviceId must be a valid UUID'),
  gatewayId: z.string().min(1, 'gatewayId is required').max(128),
  siteId: z.string().uuid('siteId must be a valid UUID'),
  profiles: z
    .array(streamProfileSchema)
    .min(1, 'At least one stream profile is required')
    .max(8),
  activeProfile: z.enum(streamTypes).default('sub'),
});

export type RegisterStreamInput = z.infer<typeof registerStreamSchema>;

// ── Stream URL Request ──────────────────────────────────────
export const streamUrlSchema = z.object({
  type: z.enum(streamTypes).default('sub'),
  channel: z.coerce.number().int().min(0).optional(),
  protocol: z.enum(streamProtocols).default('hls'),
});

export type StreamUrlInput = z.infer<typeof streamUrlSchema>;
