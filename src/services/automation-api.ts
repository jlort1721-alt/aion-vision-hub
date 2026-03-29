// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Automation API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── Automation Rules ────────────────────────────────────────

export const automationRulesApi = {
  list: (filters?: { isActive?: string; triggerType?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta: Record<string, unknown> }>('/automation/rules', filters as Record<string, string | number | boolean | undefined>),

  get: (id: string) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown> }>(`/automation/rules/${id}`),

  create: (rule: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/automation/rules', rule),

  update: (id: string, updates: Record<string, unknown>) =>
    apiClient.patch<{ success: boolean; data: Record<string, unknown> }>(`/automation/rules/${id}`, updates),

  delete: (id: string) =>
    apiClient.delete<void>(`/automation/rules/${id}`),
};

// ── Automation Executions ───────────────────────────────────

export const automationExecutionsApi = {
  list: (filters?: { ruleId?: string; status?: string; page?: number; perPage?: number }) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; meta: Record<string, unknown> }>('/automation/executions', filters as Record<string, string | number | boolean | undefined>),
};

// ── Automation Stats ────────────────────────────────────────

export const automationStatsApi = {
  get: () =>
    apiClient.get<{ success: boolean; data: { totalRules: number; activeRules: number; executions24h: number; successRate: number } }>('/automation/stats'),
};
