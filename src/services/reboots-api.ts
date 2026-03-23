import { apiClient } from '@/lib/api-client';

export const rebootsApi = {
  list: (filters?: Record<string, any>) =>
    apiClient.get<{ success: boolean; data: any[] }>('/reboots', filters),
  get: (id: string) =>
    apiClient.get<{ success: boolean; data: any }>(`/reboots/${id}`),
  create: (data: { deviceId?: string; sectionId?: string; reason: string }) =>
    apiClient.post<{ success: boolean; data: any }>('/reboots', data),
  complete: (id: string, data: { status: 'completed' | 'failed'; result?: string; recoveryTimeSeconds?: number }) =>
    apiClient.post<{ success: boolean; data: any }>(`/reboots/${id}/complete`, data),
};

export const aiApi = {
  chat: (messages: Array<{ role: string; content: string }>, options?: { temperature?: number; maxTokens?: number }) =>
    apiClient.post<{ success: boolean; data: { content: string } }>('/ai/chat', { messages, ...options }),
};
