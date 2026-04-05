import { apiClient } from '@/lib/api-client';

export const auditApi = {
  list: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta?: Record<string, unknown> }>('/audit/logs', filters),

  export: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<Blob>('/audit/export', filters),
};
