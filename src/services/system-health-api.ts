import { apiClient } from '@/lib/api-client';

export const systemHealthApi = {
  getStatus: () => apiClient.get<any>('/health'),

  getReady: () => apiClient.get<any>('/health/ready'),

  getDevices: () => apiClient.get<any>('/health/devices'),
};
