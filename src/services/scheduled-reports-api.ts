// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Scheduled Reports API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── Scheduled Reports ─────────────────────────────────────

export const scheduledReportsApi = {
  list: (filters?: { isActive?: string; type?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/scheduled-reports', filters as Record<string, string | number | boolean | undefined>),

  get: (id: string) =>
    apiClient.get<{ success: boolean; data: any }>(`/scheduled-reports/${id}`),

  create: (report: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/scheduled-reports', report),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: any }>(`/scheduled-reports/${id}`, updates),

  delete: (id: string) =>
    apiClient.delete<void>(`/scheduled-reports/${id}`),
};
