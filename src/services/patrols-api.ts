// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Patrols API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── Patrol Routes ─────────────────────────────────────────

export const patrolRoutesApi = {
  list: (filters?: { isActive?: string; siteId?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/patrols/routes', filters as Record<string, string | number | boolean | undefined>),

  get: (id: string) =>
    apiClient.get<{ success: boolean; data: any }>(`/patrols/routes/${id}`),

  create: (route: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/patrols/routes', route),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: any }>(`/patrols/routes/${id}`, updates),

  delete: (id: string) =>
    apiClient.delete<void>(`/patrols/routes/${id}`),
};

// ── Checkpoints ───────────────────────────────────────────

export const patrolCheckpointsApi = {
  listByRoute: (routeId: string) =>
    apiClient.get<{ success: boolean; data: any[] }>(`/patrols/routes/${routeId}/checkpoints`),

  create: (routeId: string, checkpoint: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>(`/patrols/routes/${routeId}/checkpoints`, checkpoint),

  update: (checkpointId: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: any }>(`/patrols/checkpoints/${checkpointId}`, updates),

  delete: (checkpointId: string) =>
    apiClient.delete<void>(`/patrols/checkpoints/${checkpointId}`),
};

// ── Patrol Logs ───────────────────────────────────────────

export const patrolLogsApi = {
  list: (filters?: { routeId?: string; status?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/patrols/logs', filters as Record<string, string | number | boolean | undefined>),

  create: (log: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/patrols/logs', log),

  stats: () =>
    apiClient.get<{ success: boolean; data: { totalRoutes: number; complianceRate: number; completedToday: number; missedToday: number } }>('/patrols/stats'),
};
