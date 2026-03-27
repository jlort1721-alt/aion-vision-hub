// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Device Control API Service Layer
// Quick actions: open gate, reboot, toggle relay, etc.
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

export interface DeviceCommandResult {
  success: boolean;
  data?: {
    brand?: string;
    model?: string;
    latencyMs?: number;
    message?: string;
    error?: string;
  };
}

export interface DeviceDetectResult {
  success: boolean;
  data: {
    brand: string;
    model: string;
    capabilities: string[];
    error?: string;
  };
}

export const deviceControlApi = {
  /** Auto-detect device brand and capabilities */
  detect: (params: { ip: string; port?: number; username?: string; password?: string }) =>
    apiClient.post<DeviceDetectResult>('/device-control/detect', params),

  /** Execute command on device by connection params */
  execute: (connection: { ip: string; port?: number; username?: string; password?: string }, command: { action: string; params?: Record<string, unknown> }) =>
    apiClient.post<DeviceCommandResult>('/device-control/execute', { connection, command }),

  /** Execute command on a registered device by ID */
  executeById: (deviceId: string, command: { action: string; params?: Record<string, unknown> }) =>
    apiClient.post<DeviceCommandResult>(`/device-control/execute/${deviceId}`, command),

  /** Quick action: Open gate/door on a device */
  openGate: (deviceId: string, reason?: string) =>
    apiClient.post<DeviceCommandResult>(`/device-control/execute/${deviceId}`, {
      action: 'open_door',
      params: { relay_index: 1, reason: reason || 'Manual open from dashboard' },
    }),

  /** Quick action: Reboot a device */
  reboot: (deviceId: string, reason?: string) =>
    apiClient.post<DeviceCommandResult>(`/device-control/execute/${deviceId}`, {
      action: 'reboot',
      params: { reason: reason || 'Manual reboot from dashboard' },
    }),

  /** Quick action: Toggle relay */
  toggleRelay: (deviceId: string, state: 'on' | 'off', reason?: string) =>
    apiClient.post<DeviceCommandResult>(`/device-control/execute/${deviceId}`, {
      action: 'toggle_relay',
      params: { state, reason: reason || `Manual relay ${state} from dashboard` },
    }),
};
