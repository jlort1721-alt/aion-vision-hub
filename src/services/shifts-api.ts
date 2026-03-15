// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Shifts API Service Layer
// ═══════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

async function shiftFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
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

// ── Shifts ────────────────────────────────────────────────

export const shiftsApi = {
  list: (filters?: { isActive?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return shiftFetch<{ success: boolean; data: any[]; meta: any }>(`/shifts/shifts${qs ? '?' + qs : ''}`);
  },

  get: (id: string) =>
    shiftFetch<{ success: boolean; data: any }>(`/shifts/shifts/${id}`),

  create: (shift: Record<string, unknown>) =>
    shiftFetch<{ success: boolean; data: any }>('/shifts/shifts', { method: 'POST', body: JSON.stringify(shift) }),

  update: (id: string, updates: Record<string, unknown>) =>
    shiftFetch<{ success: boolean; data: any }>(`/shifts/shifts/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  delete: (id: string) =>
    shiftFetch<void>(`/shifts/shifts/${id}`, { method: 'DELETE' }),
};

// ── Shift Assignments ─────────────────────────────────────

export const shiftAssignmentsApi = {
  list: (filters?: { status?: string; userId?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return shiftFetch<{ success: boolean; data: any[]; meta: any }>(`/shifts/assignments${qs ? '?' + qs : ''}`);
  },

  create: (assignment: Record<string, unknown>) =>
    shiftFetch<{ success: boolean; data: any }>('/shifts/assignments', { method: 'POST', body: JSON.stringify(assignment) }),

  update: (id: string, updates: Record<string, unknown>) =>
    shiftFetch<{ success: boolean; data: any }>(`/shifts/assignments/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  stats: () =>
    shiftFetch<{ success: boolean; data: { totalScheduled: number; checkedIn: number; missed: number; excused: number } }>('/shifts/assignments/stats'),
};
