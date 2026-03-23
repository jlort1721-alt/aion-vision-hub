// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Alerts API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── Alert Rules ─────────────────────────────────────────────

export const alertRulesApi = {
  list: (filters?: { isActive?: string; severity?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/alerts/rules', filters as Record<string, string | number | boolean | undefined>),

  get: (id: string) =>
    apiClient.get<{ success: boolean; data: any }>(`/alerts/rules/${id}`),

  create: (rule: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/alerts/rules', rule),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: any }>(`/alerts/rules/${id}`, updates),

  delete: (id: string) =>
    apiClient.delete<void>(`/alerts/rules/${id}`),
};

// ── Alert Instances ─────────────────────────────────────────

export const alertInstancesApi = {
  list: (filters?: { status?: string; severity?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/alerts/instances', filters as Record<string, string | number | boolean | undefined>),

  stats: () =>
    apiClient.get<{ success: boolean; data: { total: number; byStatus: Record<string, number>; activeCritical: number; activeHigh: number } }>('/alerts/instances/stats'),

  get: (id: string) =>
    apiClient.get<{ success: boolean; data: any }>(`/alerts/instances/${id}`),

  acknowledge: (id: string, note?: string) =>
    apiClient.patch<{ success: boolean; data: any }>(`/alerts/instances/${id}/acknowledge`, { note }),

  resolve: (id: string) =>
    apiClient.patch<{ success: boolean; data: any }>(`/alerts/instances/${id}/resolve`),
};

// ── Escalation Policies ─────────────────────────────────────

export const escalationPoliciesApi = {
  list: () =>
    apiClient.get<{ success: boolean; data: any[] }>('/alerts/escalation-policies'),

  create: (policy: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/alerts/escalation-policies', policy),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: any }>(`/alerts/escalation-policies/${id}`, updates),

  delete: (id: string) =>
    apiClient.delete<void>(`/alerts/escalation-policies/${id}`),
};

// ── Notification Channels ───────────────────────────────────

export const notificationChannelsApi = {
  list: () =>
    apiClient.get<{ success: boolean; data: any[] }>('/alerts/channels'),

  create: (channel: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/alerts/channels', channel),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: any }>(`/alerts/channels/${id}`, updates),

  delete: (id: string) =>
    apiClient.delete<void>(`/alerts/channels/${id}`),
};

// ── Notification Log ────────────────────────────────────────

export const notificationLogApi = {
  list: (filters?: { type?: string; status?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/alerts/notifications', filters as Record<string, string | number | boolean | undefined>),
};
