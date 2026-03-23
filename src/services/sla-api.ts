// ═══════════════════════════════════════════════════════════
// AION VISION HUB — SLA API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── SLA Definitions ───────────────────────────────────────

export const slaDefinitionsApi = {
  list: (filters?: { severity?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/sla/definitions', filters as Record<string, string | number | boolean | undefined>),

  get: (id: string) =>
    apiClient.get<{ success: boolean; data: any }>(`/sla/definitions/${id}`),

  create: (definition: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/sla/definitions', definition),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: any }>(`/sla/definitions/${id}`, updates),

  delete: (id: string) =>
    apiClient.delete<void>(`/sla/definitions/${id}`),
};

// ── SLA Tracking ──────────────────────────────────────────

export const slaTrackingApi = {
  list: (filters?: { status?: string; breached?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/sla/tracking', filters as Record<string, string | number | boolean | undefined>),

  create: (tracking: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/sla/tracking', tracking),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: any }>(`/sla/tracking/${id}`, updates),

  stats: () =>
    apiClient.get<{ success: boolean; data: { activeSlas: number; met: number; breached: number; responseBreachRate: number } }>('/sla/stats'),
};
