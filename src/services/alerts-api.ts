// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Alerts API Service Layer
// ═══════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

async function alertFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const resp = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      ...(options?.headers || {}),
    },
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: { message: resp.statusText } }));
    throw new Error(err.error?.message || `API error ${resp.status}`);
  }

  if (resp.status === 204) return {} as T;
  return resp.json();
}

// ── Alert Rules ─────────────────────────────────────────────

export const alertRulesApi = {
  list: (filters?: { isActive?: string; severity?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return alertFetch<{ success: boolean; data: any[]; meta: any }>(`/alerts/rules${qs ? '?' + qs : ''}`);
  },

  get: (id: string) =>
    alertFetch<{ success: boolean; data: any }>(`/alerts/rules/${id}`),

  create: (rule: Record<string, unknown>) =>
    alertFetch<{ success: boolean; data: any }>('/alerts/rules', { method: 'POST', body: JSON.stringify(rule) }),

  update: (id: string, updates: Record<string, unknown>) =>
    alertFetch<{ success: boolean; data: any }>(`/alerts/rules/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  delete: (id: string) =>
    alertFetch<void>(`/alerts/rules/${id}`, { method: 'DELETE' }),
};

// ── Alert Instances ─────────────────────────────────────────

export const alertInstancesApi = {
  list: (filters?: { status?: string; severity?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return alertFetch<{ success: boolean; data: any[]; meta: any }>(`/alerts/instances${qs ? '?' + qs : ''}`);
  },

  stats: () =>
    alertFetch<{ success: boolean; data: { total: number; byStatus: Record<string, number>; activeCritical: number; activeHigh: number } }>('/alerts/instances/stats'),

  get: (id: string) =>
    alertFetch<{ success: boolean; data: any }>(`/alerts/instances/${id}`),

  acknowledge: (id: string, note?: string) =>
    alertFetch<{ success: boolean; data: any }>(`/alerts/instances/${id}/acknowledge`, { method: 'PATCH', body: JSON.stringify({ note }) }),

  resolve: (id: string) =>
    alertFetch<{ success: boolean; data: any }>(`/alerts/instances/${id}/resolve`, { method: 'PATCH' }),
};

// ── Escalation Policies ─────────────────────────────────────

export const escalationPoliciesApi = {
  list: () =>
    alertFetch<{ success: boolean; data: any[] }>('/alerts/escalation-policies'),

  create: (policy: Record<string, unknown>) =>
    alertFetch<{ success: boolean; data: any }>('/alerts/escalation-policies', { method: 'POST', body: JSON.stringify(policy) }),

  update: (id: string, updates: Record<string, unknown>) =>
    alertFetch<{ success: boolean; data: any }>(`/alerts/escalation-policies/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  delete: (id: string) =>
    alertFetch<void>(`/alerts/escalation-policies/${id}`, { method: 'DELETE' }),
};

// ── Notification Channels ───────────────────────────────────

export const notificationChannelsApi = {
  list: () =>
    alertFetch<{ success: boolean; data: any[] }>('/alerts/channels'),

  create: (channel: Record<string, unknown>) =>
    alertFetch<{ success: boolean; data: any }>('/alerts/channels', { method: 'POST', body: JSON.stringify(channel) }),

  update: (id: string, updates: Record<string, unknown>) =>
    alertFetch<{ success: boolean; data: any }>(`/alerts/channels/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  delete: (id: string) =>
    alertFetch<void>(`/alerts/channels/${id}`, { method: 'DELETE' }),
};

// ── Notification Log ────────────────────────────────────────

export const notificationLogApi = {
  list: (filters?: { type?: string; status?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return alertFetch<{ success: boolean; data: any[]; meta: any }>(`/alerts/notifications${qs ? '?' + qs : ''}`);
  },
};
