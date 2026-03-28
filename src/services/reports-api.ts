// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Reports API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';
import { supabase } from '@/integrations/supabase/client';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const reportsApi = {
  list: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<{ success: boolean; data: any[]; meta?: any }>('/reports', filters),

  generate: (params: { type: string; site_id?: string; date_from: string; date_to: string; format: string }) =>
    apiClient.post<{ success: boolean; data: any }>('/reports/generate', params),

  download: async (id: string): Promise<Blob> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    const response = await fetch(`${API_BASE_URL}/reports/${id}/download`, { headers });
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }
    return response.blob();
  },

  delete: (id: string) =>
    apiClient.delete<void>(`/reports/${id}`),
};
