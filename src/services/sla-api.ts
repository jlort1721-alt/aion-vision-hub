// ═══════════════════════════════════════════════════════════
// AION VISION HUB — SLA API Service Layer
// ═══════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

async function slaFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
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

// ── SLA Definitions ───────────────────────────────────────

export const slaDefinitionsApi = {
  list: (filters?: { severity?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return slaFetch<{ success: boolean; data: any[]; meta: any }>(`/sla/definitions${qs ? '?' + qs : ''}`);
  },

  get: (id: string) =>
    slaFetch<{ success: boolean; data: any }>(`/sla/definitions/${id}`),

  create: (definition: Record<string, unknown>) =>
    slaFetch<{ success: boolean; data: any }>('/sla/definitions', { method: 'POST', body: JSON.stringify(definition) }),

  update: (id: string, updates: Record<string, unknown>) =>
    slaFetch<{ success: boolean; data: any }>(`/sla/definitions/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  delete: (id: string) =>
    slaFetch<void>(`/sla/definitions/${id}`, { method: 'DELETE' }),
};

// ── SLA Tracking ──────────────────────────────────────────

export const slaTrackingApi = {
  list: (filters?: { status?: string; breached?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return slaFetch<{ success: boolean; data: any[]; meta: any }>(`/sla/tracking${qs ? '?' + qs : ''}`);
  },

  create: (tracking: Record<string, unknown>) =>
    slaFetch<{ success: boolean; data: any }>('/sla/tracking', { method: 'POST', body: JSON.stringify(tracking) }),

  update: (id: string, updates: Record<string, unknown>) =>
    slaFetch<{ success: boolean; data: any }>(`/sla/tracking/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  stats: () =>
    slaFetch<{ success: boolean; data: { activeSlas: number; met: number; breached: number; responseBreachRate: number } }>('/sla/stats'),
};
