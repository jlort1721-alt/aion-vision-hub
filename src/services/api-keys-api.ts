// ═══════════════════════════════════════════════════════════
// AION VISION HUB — API Keys API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

export const apiKeysApi = {
  /** GET /api-keys — List API keys for tenant */
  list: () =>
    apiClient.get<{ success: boolean; data: any[] }>('/api-keys'),

  /** POST /api-keys — Create a new API key */
  create: (data: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any; warning?: string }>('/api-keys', data),

  /** DELETE /api-keys/:id — Revoke an API key */
  revoke: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/api-keys/${id}`),
};
