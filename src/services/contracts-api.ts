import { apiClient } from '@/lib/api-client';

export const contractsApi = {
  list: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta: Record<string, unknown> }>('/contracts', filters as Record<string, string | number | boolean | undefined>),
  get: (id: string) => apiClient.get<{ success: boolean; data: Record<string, unknown> }>(`/contracts/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/contracts', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/contracts/${id}`, data),
  delete: (id: string) => apiClient.delete<void>(`/contracts/${id}`),
  getStats: () => apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/contracts/stats'),
};

export const invoicesApi = {
  list: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta: Record<string, unknown> }>('/contracts/invoices', filters as Record<string, string | number | boolean | undefined>),
  get: (id: string) => apiClient.get<{ success: boolean; data: Record<string, unknown> }>(`/contracts/invoices/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/contracts/invoices', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/contracts/invoices/${id}`, data),
  markPaid: (id: string, data: Record<string, unknown>) => apiClient.post<{ success: boolean; data: Record<string, unknown> }>(`/contracts/invoices/${id}/pay`, data),
  getStats: () => apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/contracts/invoices/stats'),
};
