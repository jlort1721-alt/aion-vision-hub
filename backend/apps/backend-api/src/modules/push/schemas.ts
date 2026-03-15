import { z } from 'zod';

// ── Subscribe Schema ──────────────────────────────────────

export const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});
export type SubscribeInput = z.infer<typeof subscribeSchema>;

// ── Unsubscribe Schema ────────────────────────────────────

export const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;

// ── Send Push Schema ──────────────────────────────────────

export const sendPushSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().min(1).max(1024),
  url: z.string().url().optional(),
  userIds: z.array(z.string().uuid()).optional(),
  roles: z.array(z.string()).optional(),
});
export type SendPushInput = z.infer<typeof sendPushSchema>;
