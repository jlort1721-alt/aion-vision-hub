import { apiClient } from '@/lib/api-client';

export const systemHealthApi = {
  getStatus: () => apiClient.get<Record<string, unknown>>('/health'),

  getReady: () => apiClient.get<Record<string, unknown>>('/health/ready'),

  getDevices: () => apiClient.get<Record<string, unknown>>('/health/devices'),
};
