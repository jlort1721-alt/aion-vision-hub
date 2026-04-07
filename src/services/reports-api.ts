/**
 * AION — Reports API Service Layer
 *
 * Correct flow:
 * 1. POST /reports — create report request (name, type, format, parameters)
 * 2. POST /reports/:id/generate — trigger actual generation
 * 3. GET /reports/:id/export — get generated data (data URI or metadata)
 */

import { apiClient } from '@/lib/api-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const reportsApi = {
  /** List all reports with optional filters */
  list: (filters?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta?: Record<string, unknown> }>('/reports', filters),

  /** Create a report request, then trigger generation in one step */
  generate: async (params: {
    type: string;
    site_id?: string;
    date_from: string;
    date_to: string;
    format: string;
  }) => {
    // Step 1: Create report record with correct schema fields
    const createPayload = {
      name: `${params.type}-${params.date_from}-to-${params.date_to}`,
      type: params.type,
      format: params.format.toLowerCase(), // Backend expects lowercase: pdf, csv, json
      parameters: {
        siteId: params.site_id,
        dateFrom: params.date_from,
        dateTo: params.date_to,
      },
    };

    const created = await apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/reports', createPayload);
    const reportId = (created as any)?.data?.id ?? (created as any)?.id;

    if (!reportId) {
      throw new Error('Failed to create report — no ID returned');
    }

    // Step 2: Trigger actual generation
    const generated = await apiClient.post<{ success: boolean; data: Record<string, unknown> }>(`/reports/${reportId}/generate`);
    return generated;
  },

  /** Download a completed report as blob */
  download: async (id: string): Promise<Blob> => {
    const token = localStorage.getItem('aion_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Backend endpoint is /export, not /download
    const response = await fetch(`${API_BASE_URL}/reports/${id}/export`, { headers });
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

    // Backend returns JSON with { data: { resultUrl: "data:..." } }
    const json = await response.json();
    const resultUrl = json?.data?.resultUrl;

    if (resultUrl && resultUrl.startsWith('data:')) {
      // Convert data URI to Blob
      const [header, base64] = resultUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }

    // Fallback: return raw response as blob
    return new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  },

  /** Delete a report */
  delete: (id: string) =>
    apiClient.delete<void>(`/reports/${id}`),
};
