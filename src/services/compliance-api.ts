import { apiClient } from '@/lib/api-client';

export const complianceTemplatesApi = {
  list: (filters?: Record<string, any>) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/compliance/templates', filters as Record<string, string | number | boolean | undefined>),
  get: (id: string) => apiClient.get<{ success: boolean; data: any }>(`/compliance/templates/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post<{ success: boolean; data: any }>('/compliance/templates', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch<{ success: boolean; data: any }>(`/compliance/templates/${id}`, data),
  approve: (id: string) => apiClient.post<{ success: boolean; data: any }>(`/compliance/templates/${id}/approve`),
  delete: (id: string) => apiClient.delete<void>(`/compliance/templates/${id}`),
};

export const retentionPoliciesApi = {
  list: (filters?: Record<string, any>) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/compliance/retention', filters as Record<string, string | number | boolean | undefined>),
  get: (id: string) => apiClient.get<{ success: boolean; data: any }>(`/compliance/retention/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post<{ success: boolean; data: any }>('/compliance/retention', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch<{ success: boolean; data: any }>(`/compliance/retention/${id}`, data),
  delete: (id: string) => apiClient.delete<void>(`/compliance/retention/${id}`),
};

export const complianceStatsApi = {
  get: () => apiClient.get<{ success: boolean; data: any }>('/compliance/stats'),
};
