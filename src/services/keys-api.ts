import { apiClient } from '@/lib/api-client';

export const keysApi = {
  list: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta: Record<string, unknown> }>('/keys', filters as Record<string, string | number | boolean | undefined>),
  get: (id: string) => apiClient.get<{ success: boolean; data: Record<string, unknown> }>(`/keys/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/keys', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/keys/${id}`, data),
  delete: (id: string) => apiClient.delete<void>(`/keys/${id}`),
  assign: (id: string, data: { toHolder: string; notes?: string }) => apiClient.post<{ success: boolean; data: Record<string, unknown> }>(`/keys/${id}/assign`, data),
  returnKey: (id: string, data?: { notes?: string }) => apiClient.post<{ success: boolean; data: Record<string, unknown> }>(`/keys/${id}/return`, data || {}),
  getStats: () => apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/keys/stats'),
};

export const keyLogsApi = {
  list: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta: Record<string, unknown> }>('/keys/logs', filters as Record<string, string | number | boolean | undefined>),
};
