import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

async function contractsFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
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

export const contractsApi = {
  list: (filters?: Record<string, any>) => {
    const params = new URLSearchParams();
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    const qs = params.toString();
    return contractsFetch<{ success: boolean; data: any[]; meta: any }>(`/contracts${qs ? '?' + qs : ''}`);
  },
  get: (id: string) => contractsFetch<{ success: boolean; data: any }>(`/contracts/${id}`),
  create: (data: Record<string, unknown>) => contractsFetch<{ success: boolean; data: any }>('/contracts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => contractsFetch<{ success: boolean; data: any }>(`/contracts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => contractsFetch<void>(`/contracts/${id}`, { method: 'DELETE' }),
  getStats: () => contractsFetch<{ success: boolean; data: any }>('/contracts/stats'),
};

export const invoicesApi = {
  list: (filters?: Record<string, any>) => {
    const params = new URLSearchParams();
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    const qs = params.toString();
    return contractsFetch<{ success: boolean; data: any[]; meta: any }>(`/contracts/invoices${qs ? '?' + qs : ''}`);
  },
  get: (id: string) => contractsFetch<{ success: boolean; data: any }>(`/contracts/invoices/${id}`),
  create: (data: Record<string, unknown>) => contractsFetch<{ success: boolean; data: any }>('/contracts/invoices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => contractsFetch<{ success: boolean; data: any }>(`/contracts/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  markPaid: (id: string, data: Record<string, unknown>) => contractsFetch<{ success: boolean; data: any }>(`/contracts/invoices/${id}/pay`, { method: 'POST', body: JSON.stringify(data) }),
  getStats: () => contractsFetch<{ success: boolean; data: any }>('/contracts/invoices/stats'),
};
