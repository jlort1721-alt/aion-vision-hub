import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

async function complianceFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
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

export const complianceTemplatesApi = {
  list: (filters?: Record<string, any>) => {
    const params = new URLSearchParams();
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    const qs = params.toString();
    return complianceFetch<{ success: boolean; data: any[]; meta: any }>(`/compliance/templates${qs ? '?' + qs : ''}`);
  },
  get: (id: string) => complianceFetch<{ success: boolean; data: any }>(`/compliance/templates/${id}`),
  create: (data: Record<string, unknown>) => complianceFetch<{ success: boolean; data: any }>('/compliance/templates', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => complianceFetch<{ success: boolean; data: any }>(`/compliance/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  approve: (id: string) => complianceFetch<{ success: boolean; data: any }>(`/compliance/templates/${id}/approve`, { method: 'POST' }),
  delete: (id: string) => complianceFetch<void>(`/compliance/templates/${id}`, { method: 'DELETE' }),
};

export const retentionPoliciesApi = {
  list: (filters?: Record<string, any>) => {
    const params = new URLSearchParams();
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    const qs = params.toString();
    return complianceFetch<{ success: boolean; data: any[]; meta: any }>(`/compliance/retention${qs ? '?' + qs : ''}`);
  },
  get: (id: string) => complianceFetch<{ success: boolean; data: any }>(`/compliance/retention/${id}`),
  create: (data: Record<string, unknown>) => complianceFetch<{ success: boolean; data: any }>('/compliance/retention', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => complianceFetch<{ success: boolean; data: any }>(`/compliance/retention/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => complianceFetch<void>(`/compliance/retention/${id}`, { method: 'DELETE' }),
};

export const complianceStatsApi = {
  get: () => complianceFetch<{ success: boolean; data: any }>('/compliance/stats'),
};
