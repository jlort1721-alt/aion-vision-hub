import { apiClient } from '@/lib/api-client';

export const contractsApi = {
  list: (filters?: Record<string, any>) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/contracts', filters as Record<string, string | number | boolean | undefined>),
  get: (id: string) => apiClient.get<{ success: boolean; data: any }>(`/contracts/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post<{ success: boolean; data: any }>('/contracts', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch<{ success: boolean; data: any }>(`/contracts/${id}`, data),
  delete: (id: string) => apiClient.delete<void>(`/contracts/${id}`),
  getStats: () => apiClient.get<{ success: boolean; data: any }>('/contracts/stats'),
};

export const invoicesApi = {
  list: (filters?: Record<string, any>) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/contracts/invoices', filters as Record<string, string | number | boolean | undefined>),
  get: (id: string) => apiClient.get<{ success: boolean; data: any }>(`/contracts/invoices/${id}`),
  create: (data: Record<string, unknown>) => apiClient.post<{ success: boolean; data: any }>('/contracts/invoices', data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch<{ success: boolean; data: any }>(`/contracts/invoices/${id}`, data),
  markPaid: (id: string, data: Record<string, unknown>) => apiClient.post<{ success: boolean; data: any }>(`/contracts/invoices/${id}/pay`, data),
  getStats: () => apiClient.get<{ success: boolean; data: any }>('/contracts/invoices/stats'),
};
