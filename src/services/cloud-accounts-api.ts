// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Cloud Accounts API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

export const cloudAccountsApi = {
  /** GET /cloud-accounts/mapping — Cloud account mapping with risk analysis */
  getMapping: () =>
    apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/cloud-accounts/mapping'),

  /** GET /cloud-accounts/inventory — Device inventory summary */
  getInventory: () =>
    apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/cloud-accounts/inventory'),

  /** GET /cloud-accounts/pending — Pending devices list */
  getPending: () =>
    apiClient.get<{ success: boolean; data: { items: Record<string, unknown>[]; total: number } }>('/cloud-accounts/pending'),
};
