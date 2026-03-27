// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Operations API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

export const operationsApi = {
  /** GET /operations/dashboard — Full consolidated operations dashboard */
  getDashboard: () =>
    apiClient.get<{ success: boolean; data: any }>('/operations/dashboard'),

  /** GET /operations/sites-status — Lightweight site status array */
  getSitesStatus: () =>
    apiClient.get<{ success: boolean; data: any[] }>('/operations/sites-status'),
};
