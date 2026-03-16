import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

async function trainingFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
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

export const trainingProgramsApi = {
  list: (filters?: Record<string, any>) => {
    const params = new URLSearchParams();
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    const qs = params.toString();
    return trainingFetch<{ success: boolean; data: any[]; meta: any }>(`/training/programs${qs ? '?' + qs : ''}`);
  },
  get: (id: string) => trainingFetch<{ success: boolean; data: any }>(`/training/programs/${id}`),
  create: (data: Record<string, unknown>) => trainingFetch<{ success: boolean; data: any }>('/training/programs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => trainingFetch<{ success: boolean; data: any }>(`/training/programs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => trainingFetch<void>(`/training/programs/${id}`, { method: 'DELETE' }),
};

export const certificationsApi = {
  list: (filters?: Record<string, any>) => {
    const params = new URLSearchParams();
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    const qs = params.toString();
    return trainingFetch<{ success: boolean; data: any[]; meta: any }>(`/training/certifications${qs ? '?' + qs : ''}`);
  },
  get: (id: string) => trainingFetch<{ success: boolean; data: any }>(`/training/certifications/${id}`),
  enroll: (data: { programId: string; userId: string; userName: string }) => trainingFetch<{ success: boolean; data: any }>('/training/certifications', { method: 'POST', body: JSON.stringify(data) }),
  complete: (id: string, data: { score: number; notes?: string }) => trainingFetch<{ success: boolean; data: any }>(`/training/certifications/${id}/complete`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) => trainingFetch<{ success: boolean; data: any }>(`/training/certifications/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getExpiring: (days?: number) => trainingFetch<{ success: boolean; data: any[] }>(`/training/certifications/expiring?days=${days || 30}`),
};

export const trainingStatsApi = {
  get: () => trainingFetch<{ success: boolean; data: any }>('/training/stats'),
};
