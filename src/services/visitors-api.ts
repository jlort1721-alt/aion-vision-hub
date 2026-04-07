// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Visitors API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── Visitors ────────────────────────────────────────────────

export const visitorsApi = {
  list: (filters?: { search?: string; blacklisted?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta: Record<string, unknown> }>('/visitors', filters as Record<string, string | number | boolean | undefined>),

  get: (id: string) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown> }>(`/visitors/${id}`),

  create: (visitor: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/visitors', visitor),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/visitors/${id}`, updates),

  delete: (id: string) =>
    apiClient.delete<void>(`/visitors/${id}`),
};

// ── Visitor Passes ──────────────────────────────────────────

export const visitorPassesApi = {
  list: (filters?: { status?: string; visitorId?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta: Record<string, unknown> }>('/visitors/passes', filters as Record<string, string | number | boolean | undefined>),

  create: (pass: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/visitors/passes', pass),

  revoke: (id: string) =>
    apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/visitors/passes/${id}/revoke`),

  checkIn: (id: string) =>
    apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/visitors/passes/${id}/check-in`),

  checkOut: (id: string) =>
    apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/visitors/passes/${id}/check-out`),
};

// ── QR Validation ───────────────────────────────────────────

export const visitorQrApi = {
  validate: (qrToken: string) =>
    apiClient.post<{ success: boolean; data: { visitor: Record<string, unknown>; pass: Record<string, unknown>; valid: boolean } }>('/visitors/validate-qr', { qrToken }),
};

// ── Visitor Stats ───────────────────────────────────────────

export const visitorStatsApi = {
  get: () =>
    apiClient.get<{ success: boolean; data: { totalVisitors: number; activePasses: number; checkedInToday: number; blacklisted: number } }>('/visitors/stats'),
};
