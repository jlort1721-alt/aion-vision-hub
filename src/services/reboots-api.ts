import { apiClient } from '@/lib/api-client';

export const rebootsApi = {
  list: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[] }>('/reboots', filters),
  get: (id: string) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown> }>(`/reboots/${id}`),
  create: (data: { deviceId?: string; sectionId?: string; reason: string }) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/reboots', data),
  complete: (id: string, data: { status: 'completed' | 'failed'; result?: string; recoveryTimeSeconds?: number }) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>(`/reboots/${id}/complete`, data),
};

export const aiApi = {
  chat: (messages: Array<{ role: string; content: string }>, options?: { temperature?: number; maxTokens?: number }) =>
    apiClient.post<{ success: boolean; data: { content: string } }>('/ai/chat', { messages, ...options }),
};
