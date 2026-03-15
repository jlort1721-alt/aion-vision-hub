// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Analytics API Service Layer
// ═══════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

async function analyticsFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
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

// ── Dashboard ───────────────────────────────────────────────

export const analyticsDashboardApi = {
  get: () =>
    analyticsFetch<{ success: boolean; data: {
      events24h: number;
      activeIncidents: number;
      devicesOnline: number;
      slaCompliance: number;
      patrolCompliance: number;
      alertCount: number;
    } }>('/analytics/dashboard'),
};

// ── Event Trends ────────────────────────────────────────────

export const analyticsEventsApi = {
  trends: (filters?: { from?: string; to?: string; period?: string }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return analyticsFetch<{ success: boolean; data: { date: string; count: number }[] }>(`/analytics/events/trends${qs ? '?' + qs : ''}`);
  },

  topTypes: () =>
    analyticsFetch<{ success: boolean; data: { type: string; count: number; percentage: number }[] }>('/analytics/events/top-types'),
};

// ── Incident Metrics ────────────────────────────────────────

export const analyticsIncidentsApi = {
  metrics: () =>
    analyticsFetch<{ success: boolean; data: { open: number; in_progress: number; resolved: number; closed: number } }>('/analytics/incidents/metrics'),
};

// ── Device Status ───────────────────────────────────────────

export const analyticsDevicesApi = {
  status: () =>
    analyticsFetch<{ success: boolean; data: { site: string; online: number; offline: number; total: number }[] }>('/analytics/devices/status'),
};
