import { apiClient } from '@/lib/api-client';

export const trainingProgramsApi = {
  list: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta: Record<string, unknown> }>('/training/programs', filters as Record<string, string | number | boolean | undefined>),
  get: (id: string) => apiClient.get<{ success: boolean; data: Record<string, unknown> }>(`/training/programs/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/training/programs', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/training/programs/${id}`, data),
  delete: (id: string) => apiClient.delete<void>(`/training/programs/${id}`),
};

export const certificationsApi = {
  list: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta: Record<string, unknown> }>('/training/certifications', filters as Record<string, string | number | boolean | undefined>),
  get: (id: string) => apiClient.get<{ success: boolean; data: Record<string, unknown> }>(`/training/certifications/${id}`),
  enroll: (data: { programId: string; userId: string; userName: string }) => apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/training/certifications', data),
  complete: (id: string, data: { score: number; notes?: string }) => apiClient.post<{ success: boolean; data: Record<string, unknown> }>(`/training/certifications/${id}/complete`, data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/training/certifications/${id}`, data),
  getExpiring: (days?: number) => apiClient.get<{ success: boolean; data: Record<string, unknown>[] }>('/training/certifications/expiring', { days: days || 30 }),
};

export const trainingStatsApi = {
  get: () => apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/training/stats'),
};
