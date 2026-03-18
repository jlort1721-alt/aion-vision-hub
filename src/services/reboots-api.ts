import { supabase } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

async function rebootsFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
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

export const rebootsApi = {
  list: (filters?: Record<string, any>) => {
    const params = new URLSearchParams();
    if (filters) Object.entries(filters).forEach(([k, v]) => { if (v !== undefined) params.set(k, String(v)); });
    const qs = params.toString();
    return rebootsFetch<{ success: boolean; data: any[] }>(`/reboots${qs ? '?' + qs : ''}`);
  },
  get: (id: string) => rebootsFetch<{ success: boolean; data: any }>(`/reboots/${id}`),
  create: (data: { deviceId?: string; sectionId?: string; reason: string }) =>
    rebootsFetch<{ success: boolean; data: any }>('/reboots', { method: 'POST', body: JSON.stringify(data) }),
  complete: (id: string, data: { status: 'completed' | 'failed'; result?: string; recoveryTimeSeconds?: number }) =>
    rebootsFetch<{ success: boolean; data: any }>(`/reboots/${id}/complete`, { method: 'POST', body: JSON.stringify(data) }),
};

export const aiApi = {
  chat: (messages: Array<{ role: string; content: string }>, options?: { temperature?: number; maxTokens?: number }) =>
    rebootsFetch<{ success: boolean; data: { content: string } }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, ...options }),
    }),
};
