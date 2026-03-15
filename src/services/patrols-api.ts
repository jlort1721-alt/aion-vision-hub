// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Patrols API Service Layer
// ═══════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

async function patrolFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
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

// ── Patrol Routes ─────────────────────────────────────────

export const patrolRoutesApi = {
  list: (filters?: { isActive?: string; siteId?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return patrolFetch<{ success: boolean; data: any[]; meta: any }>(`/patrols/routes${qs ? '?' + qs : ''}`);
  },

  get: (id: string) =>
    patrolFetch<{ success: boolean; data: any }>(`/patrols/routes/${id}`),

  create: (route: Record<string, unknown>) =>
    patrolFetch<{ success: boolean; data: any }>('/patrols/routes', { method: 'POST', body: JSON.stringify(route) }),

  update: (id: string, updates: Record<string, unknown>) =>
    patrolFetch<{ success: boolean; data: any }>(`/patrols/routes/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  delete: (id: string) =>
    patrolFetch<void>(`/patrols/routes/${id}`, { method: 'DELETE' }),
};

// ── Checkpoints ───────────────────────────────────────────

export const patrolCheckpointsApi = {
  listByRoute: (routeId: string) =>
    patrolFetch<{ success: boolean; data: any[] }>(`/patrols/routes/${routeId}/checkpoints`),

  create: (routeId: string, checkpoint: Record<string, unknown>) =>
    patrolFetch<{ success: boolean; data: any }>(`/patrols/routes/${routeId}/checkpoints`, { method: 'POST', body: JSON.stringify(checkpoint) }),

  update: (checkpointId: string, updates: Record<string, unknown>) =>
    patrolFetch<{ success: boolean; data: any }>(`/patrols/checkpoints/${checkpointId}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  delete: (checkpointId: string) =>
    patrolFetch<void>(`/patrols/checkpoints/${checkpointId}`, { method: 'DELETE' }),
};

// ── Patrol Logs ───────────────────────────────────────────

export const patrolLogsApi = {
  list: (filters?: { routeId?: string; status?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return patrolFetch<{ success: boolean; data: any[]; meta: any }>(`/patrols/logs${qs ? '?' + qs : ''}`);
  },

  create: (log: Record<string, unknown>) =>
    patrolFetch<{ success: boolean; data: any }>('/patrols/logs', { method: 'POST', body: JSON.stringify(log) }),

  stats: () =>
    patrolFetch<{ success: boolean; data: { totalRoutes: number; complianceRate: number; completedToday: number; missedToday: number } }>('/patrols/stats'),
};
