// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Analytics API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── Dashboard ───────────────────────────────────────────────

export const analyticsDashboardApi = {
  get: () =>
    apiClient.get<{ success: boolean; data: {
      events24h: number;
      activeIncidents: number;
      devicesOnline: number;
      slaCompliance: number;
      patrolCompliance: number;
      alertCount: number;
    } }>('/analytics/dashboard'),
};

// ── Event Trends ────────────────────────────────────────────

export const analyticsEventsApi = {
  trends: (filters?: { from?: string; to?: string; period?: string }) =>
    apiClient.get<{ success: boolean; data: { date: string; count: number }[] }>('/analytics/events/trends', filters as Record<string, string | number | boolean | undefined>),

  topTypes: () =>
    apiClient.get<{ success: boolean; data: { type: string; count: number; percentage: number }[] }>('/analytics/events/top-types'),
};

// ── Incident Metrics ────────────────────────────────────────

export const analyticsIncidentsApi = {
  metrics: () =>
    apiClient.get<{ success: boolean; data: { open: number; in_progress: number; resolved: number; closed: number } }>('/analytics/incidents/metrics'),
};

// ── Device Status ───────────────────────────────────────────

export const analyticsDevicesApi = {
  status: () =>
    apiClient.get<{ success: boolean; data: { site: string; online: number; offline: number; total: number }[] }>('/analytics/devices/status'),
};
