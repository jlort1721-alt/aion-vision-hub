import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

async function keysFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
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

export const keysApi = {
  list: (filters?: Record<string, any>) => {
    const params = new URLSearchParams();
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    const qs = params.toString();
    return keysFetch<{ success: boolean; data: any[]; meta: any }>(`/keys${qs ? '?' + qs : ''}`);
  },
  get: (id: string) => keysFetch<{ success: boolean; data: any }>(`/keys/${id}`),
  create: (data: Record<string, unknown>) => keysFetch<{ success: boolean; data: any }>('/keys', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => keysFetch<{ success: boolean; data: any }>(`/keys/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => keysFetch<void>(`/keys/${id}`, { method: 'DELETE' }),
  assign: (id: string, data: { toHolder: string; notes?: string }) => keysFetch<{ success: boolean; data: any }>(`/keys/${id}/assign`, { method: 'POST', body: JSON.stringify(data) }),
  returnKey: (id: string, data?: { notes?: string }) => keysFetch<{ success: boolean; data: any }>(`/keys/${id}/return`, { method: 'POST', body: JSON.stringify(data || {}) }),
  getStats: () => keysFetch<{ success: boolean; data: any }>('/keys/stats'),
};

export const keyLogsApi = {
  list: (filters?: Record<string, any>) => {
    const params = new URLSearchParams();
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    const qs = params.toString();
    return keysFetch<{ success: boolean; data: any[]; meta: any }>(`/keys/logs${qs ? '?' + qs : ''}`);
  },
};
