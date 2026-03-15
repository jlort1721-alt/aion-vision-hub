// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Automation API Service Layer
// ═══════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

async function automationFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
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

// ── Automation Rules ────────────────────────────────────────

export const automationRulesApi = {
  list: (filters?: { isActive?: string; triggerType?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return automationFetch<{ success: boolean; data: any[]; meta: any }>(`/automation/rules${qs ? '?' + qs : ''}`);
  },

  get: (id: string) =>
    automationFetch<{ success: boolean; data: any }>(`/automation/rules/${id}`),

  create: (rule: Record<string, unknown>) =>
    automationFetch<{ success: boolean; data: any }>('/automation/rules', { method: 'POST', body: JSON.stringify(rule) }),

  update: (id: string, updates: Record<string, unknown>) =>
    automationFetch<{ success: boolean; data: any }>(`/automation/rules/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),

  delete: (id: string) =>
    automationFetch<void>(`/automation/rules/${id}`, { method: 'DELETE' }),
};

// ── Automation Executions ───────────────────────────────────

export const automationExecutionsApi = {
  list: (filters?: { ruleId?: string; status?: string; page?: number; perPage?: number }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    }
    const qs = params.toString();
    return automationFetch<{ success: boolean; data: any[]; meta: any }>(`/automation/executions${qs ? '?' + qs : ''}`);
  },
};

// ── Automation Stats ────────────────────────────────────────

export const automationStatsApi = {
  get: () =>
    automationFetch<{ success: boolean; data: { totalRules: number; activeRules: number; executions24h: number; successRate: number } }>('/automation/stats'),
};
