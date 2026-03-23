// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Visitors API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── Visitors ────────────────────────────────────────────────

export const visitorsApi = {
  list: (filters?: { search?: string; blacklisted?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/visitors', filters as Record<string, string | number | boolean | undefined>),

  get: (id: string) =>
    apiClient.get<{ success: boolean; data: any }>(`/visitors/${id}`),

  create: (visitor: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/visitors', visitor),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: any }>(`/visitors/${id}`, updates),

  delete: (id: string) =>
    apiClient.delete<void>(`/visitors/${id}`),
};

// ── Visitor Passes ──────────────────────────────────────────

export const visitorPassesApi = {
  list: (filters?: { status?: string; visitorId?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/visitors/passes', filters as Record<string, string | number | boolean | undefined>),

  create: (pass: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/visitors/passes', pass),

  revoke: (id: string) =>
    apiClient.patch<{ success: boolean; data: any }>(`/visitors/passes/${id}/revoke`),

  checkIn: (id: string) =>
    apiClient.patch<{ success: boolean; data: any }>(`/visitors/passes/${id}/check-in`),

  checkOut: (id: string) =>
    apiClient.patch<{ success: boolean; data: any }>(`/visitors/passes/${id}/check-out`),
};

// ── QR Validation ───────────────────────────────────────────

export const visitorQrApi = {
  validate: (token: string) =>
    apiClient.post<{ success: boolean; data: { visitor: any; pass: any; valid: boolean } }>('/visitors/validate-qr', { token }),
};

// ── Visitor Stats ───────────────────────────────────────────

export const visitorStatsApi = {
  get: () =>
    apiClient.get<{ success: boolean; data: { totalVisitors: number; activePasses: number; checkedInToday: number; blacklisted: number } }>('/visitors/stats'),
};
