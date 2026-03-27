// ═══════════════════════════════════════════════════════════
// AION VISION HUB — ZKTeco Access-Control API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── Device Management ───────────────────────────────────────

export const zktecoDevicesApi = {
  /** POST /zkteco/devices/pair — Pair a new ZKTeco device */
  pair: (data: { ip: string; port?: number; name: string; siteId: string }) =>
    apiClient.post<{ success: boolean; data: any }>('/zkteco/devices/pair', data),

  /** GET /zkteco/devices — List paired ZKTeco devices */
  list: () =>
    apiClient.get<{ success: boolean; data: any[] }>('/zkteco/devices'),

  /** GET /zkteco/devices/:id/test — Test connectivity to a paired device */
  test: (id: string) =>
    apiClient.get<{ success: boolean; data: any }>(`/zkteco/devices/${id}/test`),

  /** POST /zkteco/devices/:id/open-door — Trigger door relay */
  openDoor: (id: string, doorId?: number, duration?: number) =>
    apiClient.post<{ success: boolean; data: any }>(`/zkteco/devices/${id}/open-door`, { doorId, duration }),

  /** POST /zkteco/devices/:id/sync — Sync device users/logs with platform */
  sync: (id: string) =>
    apiClient.post<{ success: boolean; data: any }>(`/zkteco/devices/${id}/sync`),
};

// ── Device Users ────────────────────────────────────────────

export const zktecoUsersApi = {
  /** GET /zkteco/devices/:id/users — List enrolled users on the device */
  list: (deviceId: string) =>
    apiClient.get<{ success: boolean; data: any[]; count: number }>(`/zkteco/devices/${deviceId}/users`),

  /** POST /zkteco/devices/:id/users — Enroll a user on the device */
  enroll: (deviceId: string, user: { id: string; name: string; privilege?: number; cardNumber?: string }) =>
    apiClient.post<{ success: boolean; data: any }>(`/zkteco/devices/${deviceId}/users`, user),

  /** DELETE /zkteco/devices/:id/users/:userId — Remove user from device */
  delete: (deviceId: string, userId: string) =>
    apiClient.delete<{ success: boolean; data: any }>(`/zkteco/devices/${deviceId}/users/${userId}`),
};

// ── Device Logs ─────────────────────────────────────────────

export const zktecoLogsApi = {
  /** GET /zkteco/devices/:id/logs — Retrieve attendance/access logs from device */
  list: (deviceId: string, from?: string) =>
    apiClient.get<{ success: boolean; data: any[]; count: number }>(`/zkteco/devices/${deviceId}/logs`, from ? { from } : undefined),
};

// ── Stats ───────────────────────────────────────────────────

export const zktecoStatsApi = {
  /** GET /zkteco/stats — Dashboard statistics for ZKTeco devices */
  get: () =>
    apiClient.get<{ success: boolean; data: any }>('/zkteco/stats'),
};

// ── Unified export ──────────────────────────────────────────

export const zktecoApi = {
  devices: zktecoDevicesApi,
  users: zktecoUsersApi,
  logs: zktecoLogsApi,
  stats: zktecoStatsApi,
};
