// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Reports API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

export const reportsApi = {
  list: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<{ success: boolean; data: any[]; meta?: any }>('/reports', filters),

  generate: (params: { type: string; site_id?: string; date_from: string; date_to: string; format: string }) =>
    apiClient.post<{ success: boolean; data: any }>('/reports/generate', params),

  download: (id: string) =>
    apiClient.get<Blob>(`/reports/${id}/download`),

  delete: (id: string) =>
    apiClient.delete<void>(`/reports/${id}`),
};
