// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Cloud Accounts API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

export interface CloudAccount {
  id: string;
  provider: 'ewelink' | 'hikconnect' | 'imou';
  label: string;
  email?: string;
  status: 'active' | 'inactive' | 'error';
  device_count: number;
  last_sync?: string;
  created_at: string;
}

export const cloudAccountsApi = {
  /** GET /cloud-accounts — List all cloud accounts */
  list: () =>
    apiClient.get<{ success: boolean; data: CloudAccount[] }>('/cloud-accounts'),

  /** GET /cloud-accounts/:id — Get single account */
  get: (id: string) =>
    apiClient.get<{ success: boolean; data: CloudAccount }>(`/cloud-accounts/${id}`),

  /** POST /cloud-accounts — Create new account */
  create: (data: Omit<CloudAccount, 'id' | 'device_count' | 'created_at'>) =>
    apiClient.post<{ success: boolean; data: CloudAccount }>('/cloud-accounts', data),

  /** PATCH /cloud-accounts/:id — Update account */
  update: (id: string, data: Partial<Pick<CloudAccount, 'label' | 'email' | 'status'>>) =>
    apiClient.patch<{ success: boolean; data: CloudAccount }>(`/cloud-accounts/${id}`, data),

  /** DELETE /cloud-accounts/:id — Remove account */
  delete: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/cloud-accounts/${id}`),

  /** GET /cloud-accounts/mapping — Cloud account mapping with risk analysis */
  getMapping: () =>
    apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/cloud-accounts/mapping'),

  /** GET /cloud-accounts/inventory — Device inventory summary */
  getInventory: () =>
    apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/cloud-accounts/inventory'),

  /** GET /cloud-accounts/pending — Pending devices list */
  getPending: () =>
    apiClient.get<{ success: boolean; data: { items: Record<string, unknown>[]; total: number } }>('/cloud-accounts/pending'),

  /** POST /cloud-accounts/:id/sync — Force sync devices */
  sync: (id: string) =>
    apiClient.post<{ success: boolean; data: { synced: number } }>(`/cloud-accounts/${id}/sync`, {}),
};
