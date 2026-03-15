// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Scheduled Reports API Service Layer
// ═══════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

async function reportFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
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

// ── Scheduled Reports ─────────────────────────────────────

export const scheduledReportsApi = {
  list: (filters?: { isActive?: string; type?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return reportFetch<{ success: boolean; data: any[]; meta: any }>(`/scheduled-reports${qs ? '?' + qs : ''}`);
  },

  get: (id: string) =>
    reportFetch<{ success: boolean; data: any }>(`/scheduled-reports/${id}`),

  create: (report: Record<string, unknown>) =>
    reportFetch<{ success: boolean; data: any }>('/scheduled-reports', { method: 'POST', body: JSON.stringify(report) }),

  update: (id: string, updates: Record<string, unknown>) =>
    reportFetch<{ success: boolean; data: any }>(`/scheduled-reports/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  delete: (id: string) =>
    reportFetch<void>(`/scheduled-reports/${id}`, { method: 'DELETE' }),
};
