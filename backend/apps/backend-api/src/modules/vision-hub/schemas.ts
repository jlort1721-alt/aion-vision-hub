import { z } from "zod";

export const vhDeviceFilterSchema = z.object({
  vendor: z.enum(["dahua", "hikvision"]).optional(),
  device_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const vhStartStreamSchema = z.object({
  kind: z.enum(["gb28181", "p2p_dahua"]).default("gb28181"),
  channel_id: z.string().optional(),
});

export const vhEventFilterSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

export type VhDeviceFilter = z.infer<typeof vhDeviceFilterSchema>;
export type VhStartStreamInput = z.infer<typeof vhStartStreamSchema>;
export type VhEventFilter = z.infer<typeof vhEventFilterSchema>;
