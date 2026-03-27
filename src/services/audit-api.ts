import { apiClient } from '@/lib/api-client';

export const auditApi = {
  list: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<{ success: boolean; data: any[]; meta?: any }>('/audit', filters),

  export: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<Blob>('/audit/export', filters),
};
