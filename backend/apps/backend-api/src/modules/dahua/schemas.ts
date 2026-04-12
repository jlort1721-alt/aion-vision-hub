import { z } from "zod";

export const deviceIdParam = z.object({
  deviceId: z.string().uuid(),
});

export const channelParam = z.object({
  deviceId: z.string().uuid(),
  channel: z.coerce.number().int().min(1).max(128),
});

export const ptzBody = z.object({
  channel: z.number().int().min(1).max(128).default(1),
  direction: z
    .enum(["left", "right", "up", "down", "zoomIn", "zoomOut"])
    .optional(),
  speed: z.number().int().min(1).max(10).default(5),
  preset: z.number().int().min(1).max(255).optional(),
  action: z.enum(["move", "stop", "preset"]).optional(),
});

export const streamUrlQuery = z.object({
  channel: z.coerce.number().int().min(1).default(1),
  substream: z.enum(["true", "false"]).default("true"),
});

export const eventsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  deviceId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
});
