import { apiClient } from '@/lib/api-client';

export const keysApi = {
  list: (filters?: Record<string, any>) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/keys', filters as Record<string, string | number | boolean | undefined>),
  get: (id: string) => apiClient.get<{ success: boolean; data: any }>(`/keys/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post<{ success: boolean; data: any }>('/keys', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch<{ success: boolean; data: any }>(`/keys/${id}`, data),
  delete: (id: string) => apiClient.delete<void>(`/keys/${id}`),
  assign: (id: string, data: { toHolder: string; notes?: string }) => apiClient.post<{ success: boolean; data: any }>(`/keys/${id}/assign`, data),
  returnKey: (id: string, data?: { notes?: string }) => apiClient.post<{ success: boolean; data: any }>(`/keys/${id}/return`, data || {}),
  getStats: () => apiClient.get<{ success: boolean; data: any }>('/keys/stats'),
};

export const keyLogsApi = {
  list: (filters?: Record<string, any>) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/keys/logs', filters as Record<string, string | number | boolean | undefined>),
};
