// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Push Notifications API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

export const pushApi = {
  /** GET /push/vapid-public-key — Get the VAPID public key (no auth required) */
  getVapidPublicKey: () =>
    apiClient.get<{ success: boolean; data: { vapidPublicKey: string } }>('/push/vapid-public-key'),

  /** POST /push/subscribe — Subscribe to push notifications */
  subscribe: (subscription: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/push/subscribe', { subscription }),

  /** POST /push/unsubscribe — Unsubscribe from push notifications */
  unsubscribe: (endpoint: string) =>
    apiClient.post<{ success: boolean; data: any }>('/push/unsubscribe', { endpoint }),

  /** GET /push/subscriptions — List current user subscriptions */
  listSubscriptions: () =>
    apiClient.get<{ success: boolean; data: any[] }>('/push/subscriptions'),

  /** POST /push/send — Send push notification (tenant_admin+) */
  send: (data: { title: string; body: string; url?: string; userIds?: string[] }) =>
    apiClient.post<{ success: boolean; data: { sent: number; failed: number } }>('/push/send', data),
};
