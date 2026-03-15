// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Emergency API Service Layer
// ═══════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

async function emergencyFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
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

// ── Emergency Protocols ───────────────────────────────────

export const emergencyProtocolsApi = {
  list: (filters?: { type?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return emergencyFetch<{ success: boolean; data: any[]; meta: any }>(`/emergency/protocols${qs ? '?' + qs : ''}`);
  },

  get: (id: string) =>
    emergencyFetch<{ success: boolean; data: any }>(`/emergency/protocols/${id}`),

  create: (protocol: Record<string, unknown>) =>
    emergencyFetch<{ success: boolean; data: any }>('/emergency/protocols', { method: 'POST', body: JSON.stringify(protocol) }),

  update: (id: string, updates: Record<string, unknown>) =>
    emergencyFetch<{ success: boolean; data: any }>(`/emergency/protocols/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  delete: (id: string) =>
    emergencyFetch<void>(`/emergency/protocols/${id}`, { method: 'DELETE' }),
};

// ── Emergency Contacts ────────────────────────────────────

export const emergencyContactsApi = {
  list: (filters?: { role?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return emergencyFetch<{ success: boolean; data: any[]; meta: any }>(`/emergency/contacts${qs ? '?' + qs : ''}`);
  },

  get: (id: string) =>
    emergencyFetch<{ success: boolean; data: any }>(`/emergency/contacts/${id}`),

  create: (contact: Record<string, unknown>) =>
    emergencyFetch<{ success: boolean; data: any }>('/emergency/contacts', { method: 'POST', body: JSON.stringify(contact) }),

  update: (id: string, updates: Record<string, unknown>) =>
    emergencyFetch<{ success: boolean; data: any }>(`/emergency/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  delete: (id: string) =>
    emergencyFetch<void>(`/emergency/contacts/${id}`, { method: 'DELETE' }),
};

// ── Emergency Activations ─────────────────────────────────

export const emergencyActivationsApi = {
  list: (filters?: { status?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return emergencyFetch<{ success: boolean; data: any[]; meta: any }>(`/emergency/activations${qs ? '?' + qs : ''}`);
  },

  create: (activation: Record<string, unknown>) =>
    emergencyFetch<{ success: boolean; data: any }>('/emergency/activations', { method: 'POST', body: JSON.stringify(activation) }),

  resolve: (id: string, data?: Record<string, unknown>) =>
    emergencyFetch<{ success: boolean; data: any }>(`/emergency/activations/${id}/resolve`, { method: 'PATCH', body: JSON.stringify(data || {}) }),

  cancel: (id: string, data?: Record<string, unknown>) =>
    emergencyFetch<{ success: boolean; data: any }>(`/emergency/activations/${id}/cancel`, { method: 'PATCH', body: JSON.stringify(data || {}) }),

  stats: () =>
    emergencyFetch<{ success: boolean; data: { activeEmergencies: number; totalProtocols: number; emergencyContacts: number; resolvedToday: number } }>('/emergency/stats'),
};
