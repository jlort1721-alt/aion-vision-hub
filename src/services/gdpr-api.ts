import { apiClient } from '@/lib/api-client';

export const gdprApi = {
  exportData: (params?: { format?: string; includeEvents?: boolean; includeIncidents?: boolean; includeAuditLogs?: boolean }) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/gdpr/export-data', params),

  deleteData: (confirmEmail: string, reason?: string, retainAuditLogs?: boolean) =>
    apiClient.post<{ success: boolean; data: { deletedItems: string[]; anonymizedItems: string[] } }>('/gdpr/delete-data', {
      confirmEmail,
      reason,
      retainAuditLogs: retainAuditLogs ?? true,
    }),

  listConsents: () =>
    apiClient.get<{ success: boolean; data: Array<{ id: string; type: string; action: string; details: unknown; recordedAt: string }> }>('/gdpr/consents'),

  recordConsent: (consentType: string, version: string, granted: boolean) =>
    apiClient.post<{ success: boolean; data: unknown }>('/gdpr/consents', { consentType, version, granted }),

  verifyIntegrity: (fromDate?: string, toDate?: string) =>
    apiClient.post<{ success: boolean; data: { verified: boolean; totalRecords: number; invalidRecords: number } }>('/gdpr/verify-integrity', {
      fromDate,
      toDate,
    }),
};
