// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Shifts API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── Shifts ────────────────────────────────────────────────

export const shiftsApi = {
  list: (filters?: { isActive?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/shifts/shifts', filters as Record<string, string | number | boolean | undefined>),

  get: (id: string) =>
    apiClient.get<{ success: boolean; data: any }>(`/shifts/shifts/${id}`),

  create: (shift: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/shifts/shifts', shift),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: any }>(`/shifts/shifts/${id}`, updates),

  delete: (id: string) =>
    apiClient.delete<void>(`/shifts/shifts/${id}`),
};

// ── Shift Assignments ─────────────────────────────────────

export const shiftAssignmentsApi = {
  list: (filters?: { status?: string; userId?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>('/shifts/assignments', filters as Record<string, string | number | boolean | undefined>),

  create: (assignment: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: any }>('/shifts/assignments', assignment),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: any }>(`/shifts/assignments/${id}`, updates),

  stats: () =>
    apiClient.get<{ success: boolean; data: { totalScheduled: number; checkedIn: number; missed: number; excused: number } }>('/shifts/assignments/stats'),
};
