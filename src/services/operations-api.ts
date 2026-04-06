// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Operations API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

export interface OperationsDashboard {
  total_sites: number;
  online_sites: number;
  total_devices: number;
  online_devices: number;
  active_incidents: number;
  active_operators: number;
  events_today: number;
  alerts_pending: number;
}

export const operationsApi = {
  /** GET /operations/dashboard — Full consolidated operations dashboard */
  getDashboard: () =>
    apiClient.get<{ success: boolean; data: OperationsDashboard }>('/operations/dashboard'),

  /** GET /operations/sites-status — Lightweight site status array */
  getSitesStatus: () =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[] }>('/operations/sites-status'),

  /** GET /operations/kpi — Key performance indicators */
  getKpi: (period?: 'day' | 'week' | 'month') =>
    apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/operations/kpi', period ? { period } : undefined),

  /** GET /operations/timeline — Recent operations timeline */
  getTimeline: (limit?: number) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[] }>('/operations/timeline', limit ? { limit } : undefined),
};
