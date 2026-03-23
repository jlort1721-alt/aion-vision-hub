import { apiClient } from '@/lib/api-client';

export const trainingProgramsApi = {
  list: (filters?: Record<string, any>) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/training/programs', filters as Record<string, string | number | boolean | undefined>),
  get: (id: string) => apiClient.get<{ success: boolean; data: any }>(`/training/programs/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post<{ success: boolean; data: any }>('/training/programs', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch<{ success: boolean; data: any }>(`/training/programs/${id}`, data),
  delete: (id: string) => apiClient.delete<void>(`/training/programs/${id}`),
};

export const certificationsApi = {
  list: (filters?: Record<string, any>) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/training/certifications', filters as Record<string, string | number | boolean | undefined>),
  get: (id: string) => apiClient.get<{ success: boolean; data: any }>(`/training/certifications/${id}`),
  enroll: (data: { programId: string; userId: string; userName: string }) => apiClient.post<{ success: boolean; data: any }>('/training/certifications', data),
  complete: (id: string, data: { score: number; notes?: string }) => apiClient.post<{ success: boolean; data: any }>(`/training/certifications/${id}/complete`, data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch<{ success: boolean; data: any }>(`/training/certifications/${id}`, data),
  getExpiring: (days?: number) => apiClient.get<{ success: boolean; data: any[] }>('/training/certifications/expiring', { days: days || 30 }),
};

export const trainingStatsApi = {
  get: () => apiClient.get<{ success: boolean; data: any }>('/training/stats'),
};
