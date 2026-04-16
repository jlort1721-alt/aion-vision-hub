import { z } from "zod";

export const linkTypeEnum = z.enum(["intercom", "door", "iot_relay", "sensor"]);

export const createCameraLinkSchema = z.object({
  cameraId: z.string().uuid(),
  linkedDeviceId: z.string().uuid(),
  linkType: linkTypeEnum,
  priority: z.number().int().min(0).max(999).default(100),
});

export type CreateCameraLinkInput = z.infer<typeof createCameraLinkSchema>;
