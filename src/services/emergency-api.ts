// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Emergency API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── Emergency Protocols ───────────────────────────────────

export const emergencyProtocolsApi = {
  list: (filters?: { type?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta: Record<string, unknown> }>('/emergency/protocols', filters as Record<string, string | number | boolean | undefined>),

  get: (id: string) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown> }>(`/emergency/protocols/${id}`),

  create: (protocol: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/emergency/protocols', protocol),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/emergency/protocols/${id}`, updates),

  delete: (id: string) =>
    apiClient.delete<void>(`/emergency/protocols/${id}`),
};

// ── Emergency Contacts ────────────────────────────────────

export const emergencyContactsApi = {
  list: (filters?: { role?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta: Record<string, unknown> }>('/emergency/contacts', filters as Record<string, string | number | boolean | undefined>),

  get: (id: string) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown> }>(`/emergency/contacts/${id}`),

  create: (contact: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/emergency/contacts', contact),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/emergency/contacts/${id}`, updates),

  delete: (id: string) =>
    apiClient.delete<void>(`/emergency/contacts/${id}`),
};

// ── Emergency Activations ─────────────────────────────────

export const emergencyActivationsApi = {
  list: (filters?: { status?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta: Record<string, unknown> }>('/emergency/activations', filters as Record<string, string | number | boolean | undefined>),

  create: (activation: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/emergency/activations', activation),

  resolve: (id: string, data?: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/emergency/activations/${id}/resolve`, data || {}),

  cancel: (id: string, data?: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/emergency/activations/${id}/cancel`, data || {}),

  stats: () =>
    apiClient.get<{ success: boolean; data: { activeEmergencies: number; totalProtocols: number; emergencyContacts: number; resolvedToday: number } }>('/emergency/stats'),
};
