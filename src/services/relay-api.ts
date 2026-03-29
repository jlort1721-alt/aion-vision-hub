// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Relay Control API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

export const relayApi = {
  /** POST /relay/execute — Execute a relay action (open/close gate, door, barrier) */
  execute: (config: Record<string, unknown>, action: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/relay/execute', { config, action }),

  /** POST /relay/gate/open — Simplified gate open (pulse relay ON then OFF) */
  openGate: (config: Record<string, unknown>, durationMs?: number) =>
    apiClient.post<{ success: boolean; data: Record<string, unknown> }>('/relay/gate/open', { config, durationMs }),

  /** POST /relay/test — Test relay backend connectivity */
  test: (config: Record<string, unknown>) =>
    apiClient.post<{ success: boolean; reachable?: boolean; latencyMs?: number; data?: Record<string, unknown> }>('/relay/test', { config }),

  /** GET /relay/backends — List supported relay control backends */
  listBackends: () =>
    apiClient.get<{ success: boolean; data: Record<string, unknown>[] }>('/relay/backends'),
};
