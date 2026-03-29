// ═══════════════════════════════════════════════════════════
// AION VISION HUB — LPR (License Plate Recognition) API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── LPR Cameras ─────────────────────────────────────────────

export const lprCamerasApi = {
  /** GET /lpr/cameras — List LPR cameras, optionally filtered by site */
  list: (filters?: { siteId?: string }) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[] }>('/lpr/cameras', filters as Record<string, string | number | boolean | undefined>),

  /** POST /lpr/cameras/:deviceId/configure — Configure a device as LPR camera */
  configure: (deviceId: string, config: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>(`/lpr/cameras/${deviceId}/configure`, config),
};

// ── Detections ──────────────────────────────────────────────

export const lprDetectionsApi = {
  /** POST /lpr/detections — Submit a plate detection */
  create: (detection: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/lpr/detections', detection),

  /** GET /lpr/detections — List recent detections with filters */
  list: (filters?: { plate?: string; confidence?: number; status?: string; from?: string; to?: string; cameraId?: string; limit?: number; offset?: number }) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; total?: number }>('/lpr/detections', filters as Record<string, string | number | boolean | undefined>),

  /** POST /lpr/detections/:id/action — Execute action on detection (open_gate, deny, manual_override) */
  action: (id: string, body: { action: string; notes?: string; relayDeviceId?: string }) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>(`/lpr/detections/${id}/action`, body),
};

// ── Matches & Manual Lookup ─────────────────────────────────

export const lprMatchesApi = {
  /** GET /lpr/matches — List plate matches against registered vehicles */
  list: (filters?: { limit?: number; offset?: number }) =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[]; total?: number }>('/lpr/matches', filters as Record<string, string | number | boolean | undefined>),

  /** POST /lpr/match — Manual plate lookup against registered vehicles */
  match: (plate: string) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/lpr/match', { plate }),
};

// ── Stats ───────────────────────────────────────────────────

export const lprStatsApi = {
  /** GET /lpr/stats — Detection statistics */
  get: () =>
    apiClient.get<{ success: boolean; data: Record<string, unknown> }>('/lpr/stats'),
};

// ── Unified export ──────────────────────────────────────────

export const lprApi = {
  cameras: lprCamerasApi,
  detections: lprDetectionsApi,
  matches: lprMatchesApi,
  stats: lprStatsApi,
};
