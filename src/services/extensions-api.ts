// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Voice Extensions API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

export const extensionsApi = {
  /** GET /extensions — List all voice extensions */
  list: () =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[] }>('/extensions'),

  /** POST /extensions — Create a new voice extension */
  create: (extension: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/extensions', extension),

  /** PATCH /extensions/:id — Update a voice extension */
  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/extensions/${id}`, updates),

  /** DELETE /extensions/:id — Delete a voice extension */
  delete: (id: string) =>
    apiClient.delete<void>(`/extensions/${id}`),

  /** POST /extensions/:id/preview — Generate TTS audio preview */
  preview: (id: string) =>
    apiClient.post<{ success: boolean; data: { audioBase64: string; cached: boolean; format: string } }>(`/extensions/${id}/preview`),

  /** POST /extensions/:id/synthesize — Force-generate new TTS audio */
  synthesize: (id: string) =>
    apiClient.post<{ success: boolean; data: { audioBase64: string; format: string } }>(`/extensions/${id}/synthesize`),

  /** GET /extensions/voices — List available TTS voices */
  listVoices: () =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[] }>('/extensions/voices'),

  /** GET /extensions/health — ElevenLabs service health check */
  health: () =>
    apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/extensions/health'),
};
