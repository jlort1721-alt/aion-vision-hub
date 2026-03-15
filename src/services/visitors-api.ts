// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Visitors API Service Layer
// ═══════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

async function visitorsFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
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

// ── Visitors ────────────────────────────────────────────────

export const visitorsApi = {
  list: (filters?: { search?: string; blacklisted?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return visitorsFetch<{ success: boolean; data: any[]; meta: any }>(`/visitors${qs ? '?' + qs : ''}`);
  },

  get: (id: string) =>
    visitorsFetch<{ success: boolean; data: any }>(`/visitors/${id}`),

  create: (visitor: Record<string, unknown>) =>
    visitorsFetch<{ success: boolean; data: any }>('/visitors', { method: 'POST', body: JSON.stringify(visitor) }),

  update: (id: string, updates: Record<string, unknown>) =>
    visitorsFetch<{ success: boolean; data: any }>(`/visitors/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  delete: (id: string) =>
    visitorsFetch<void>(`/visitors/${id}`, { method: 'DELETE' }),
};

// ── Visitor Passes ──────────────────────────────────────────

export const visitorPassesApi = {
  list: (filters?: { status?: string; visitorId?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return visitorsFetch<{ success: boolean; data: any[]; meta: any }>(`/visitors/passes${qs ? '?' + qs : ''}`);
  },

  create: (pass: Record<string, unknown>) =>
    visitorsFetch<{ success: boolean; data: any }>('/visitors/passes', { method: 'POST', body: JSON.stringify(pass) }),

  revoke: (id: string) =>
    visitorsFetch<{ success: boolean; data: any }>(`/visitors/passes/${id}/revoke`, { method: 'PATCH' }),

  checkIn: (id: string) =>
    visitorsFetch<{ success: boolean; data: any }>(`/visitors/passes/${id}/check-in`, { method: 'PATCH' }),

  checkOut: (id: string) =>
    visitorsFetch<{ success: boolean; data: any }>(`/visitors/passes/${id}/check-out`, { method: 'PATCH' }),
};

// ── QR Validation ───────────────────────────────────────────

export const visitorQrApi = {
  validate: (token: string) =>
    visitorsFetch<{ success: boolean; data: { visitor: any; pass: any; valid: boolean } }>('/visitors/validate-qr', { method: 'POST', body: JSON.stringify({ token }) }),
};

// ── Visitor Stats ───────────────────────────────────────────

export const visitorStatsApi = {
  get: () =>
    visitorsFetch<{ success: boolean; data: { totalVisitors: number; activePasses: number; checkedInToday: number; blacklisted: number } }>('/visitors/stats'),
};
