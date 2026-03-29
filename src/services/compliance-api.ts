import { apiClient } from '@/lib/api-client';

export const complianceTemplatesApi = {
  list: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta: Record<string, unknown> }>('/compliance/templates', filters as Record<string, string | number | boolean | undefined>),
  get: (id: string) => apiClient.get<{ success: boolean; data: Record<string, unknown> }>(`/compliance/templates/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/compliance/templates', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/compliance/templates/${id}`, data),
  approve: (id: string) => apiClient.post<{ success: boolean; data: Record<string, unknown> }>(`/compliance/templates/${id}/approve`),
  delete: (id: string) => apiClient.delete<void>(`/compliance/templates/${id}`),
};

export const retentionPoliciesApi = {
  list: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta: Record<string, unknown> }>('/compliance/retention', filters as Record<string, string | number | boolean | undefined>),
  get: (id: string) => apiClient.get<{ success: boolean; data: Record<string, unknown> }>(`/compliance/retention/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/compliance/retention', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/compliance/retention/${id}`, data),
  delete: (id: string) => apiClient.delete<void>(`/compliance/retention/${id}`),
};

export const complianceStatsApi = {
  get: () => apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/compliance/stats'),
};
