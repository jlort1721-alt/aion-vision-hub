// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Intercom API Service
// Call session management, door relay, and operator actions
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── Types ──────────────────────────────────────────────────

export interface CallSession {
  id: string;
  caller_id: string;
  caller_name?: string;
  device_id: string;
  device_name?: string;
  site_name?: string;
  status: 'ringing' | 'active' | 'on-hold' | 'ended' | 'missed';
  mode: 'ai' | 'human';
  attended_by?: string;
  started_at: string;
  answered_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  access_granted?: boolean;
  recording_url?: string;
  notes?: string;
}

export interface CallStats {
  active_calls: number;
  calls_today: number;
  avg_duration_seconds: number;
  ai_handled: number;
  human_handled: number;
  access_granted: number;
}

export interface CallSessionFilters {
  status?: string;
  mode?: string;
  device_id?: string;
  page?: number;
  page_size?: number;
}

export interface OperatorStatus {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'away';
  active_calls: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ── API Methods ────────────────────────────────────────────

export const intercomApi = {
  /** List active call sessions (ringing, active, on-hold) */
  listActiveCalls: () =>
    apiClient.get<ApiResponse<CallSession[]>>('/intercom/sessions', { status: 'active' }),

  /** Get aggregated call statistics */
  getCallStats: () =>
    apiClient.get<ApiResponse<CallStats>>('/intercom/sessions/stats'),

  /** List recent/historical call sessions with filters */
  listRecentCalls: (filters?: CallSessionFilters) =>
    apiClient.get<ApiResponse<CallSession[]>>('/intercom/sessions', filters as Record<string, string | number | boolean | undefined>),

  /** Answer a ringing call */
  answerCall: (sessionId: string) =>
    apiClient.post<ApiResponse<CallSession>>(`/intercom/sessions/${sessionId}`, { action: 'answer' }),

  /** Place an active call on hold */
  holdCall: (sessionId: string) =>
    apiClient.post<ApiResponse<CallSession>>(`/intercom/sessions/${sessionId}`, { action: 'hold' }),

  /** Resume a held call */
  resumeCall: (sessionId: string) =>
    apiClient.post<ApiResponse<CallSession>>(`/intercom/sessions/${sessionId}`, { action: 'resume' }),

  /** Transfer call to another operator */
  transferCall: (sessionId: string, target: string) =>
    apiClient.post<ApiResponse<{ transferred: boolean }>>(`/intercom/sessions/${sessionId}/handoff`, { target }),

  /** Hang up / end a call */
  hangupCall: (sessionId: string) =>
    apiClient.post<ApiResponse<CallSession>>(`/intercom/sessions/${sessionId}/end`),

  /** Open door relay on a device */
  openDoor: (deviceId: string, reason?: string) =>
    apiClient.post<ApiResponse<{ success: boolean }>>('/intercom/door/open', { deviceId, reason }),

  /** Test device reachability */
  testDevice: (ipAddress: string, brand: string) =>
    apiClient.post<ApiResponse<{ reachable: boolean; latency_ms: number }>>('/intercom/devices/test', { ipAddress, brand }),
};
