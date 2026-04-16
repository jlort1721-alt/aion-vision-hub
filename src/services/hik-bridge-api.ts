// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Hikvision Bridge API Service Layer
// SDK-based device control: PTZ, alarms, recordings, discovery
// Communicates with /hik-bridge/* Fastify routes
// ═══════════════════════════════════════════════════════════

import { apiClient } from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────

export interface HikBridgeHealth {
  status: string;
  sdk_initialized: boolean;
  sdk_version: string;
  connected_devices: number;
  alarm_subscriptions: number;
  uptime_seconds: number;
}

export interface HikDeviceStatus {
  ip: string;
  port: number;
  name: string;
  device_id: string | null;
  site_id: string | null;
  online: boolean;
  login_id: number | null;
  channel_count: number;
  last_heartbeat: string | null;
  connected_at: string | null;
  reconnect_count: number;
  error: string | null;
}

export interface HikDeviceInfo {
  serial_number: string;
  device_name: string;
  device_type: number;
  channel_count: number;
  start_channel: number;
  disk_count: number;
  firmware_version: string;
  ip: string;
  port: number;
  login_id: number;
}

export interface HikAlarmSubscription {
  device_ip: string;
  device_name: string;
  subscribed: boolean;
  subscribed_at: string | null;
  event_count: number;
}

export interface HikRecordingFile {
  filename: string;
  start_time: string;
  end_time: string;
  file_size: number;
  channel: number;
}

export interface HikDownloadStatus {
  download_id: string;
  device_ip: string;
  filename: string;
  status: "pending" | "downloading" | "completed" | "failed";
  progress: number;
  local_path: string | null;
  file_size: number;
  error: string | null;
}

export interface HikSnapshot {
  filename: string;
  path: string;
  size: number;
  captured_at: string;
}

export interface HikDiscoveredDevice {
  ip: string;
  port: number;
  serial_number: string;
  device_type: string;
  firmware_version: string;
  mac_address: string;
  is_activated: boolean;
  already_registered: boolean;
}

export interface HikPTZPreset {
  index: number;
  name: string;
  enabled: boolean;
}

interface BridgeResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

// ── API Service ───────────────────────────────────────────

export const hikBridgeApi = {
  // ── Health / Status ──────────────────────────────────────

  /** Verificar estado del bridge y SDK */
  getStatus: () =>
    apiClient.get<BridgeResponse<HikBridgeHealth>>("/hik-bridge/status"),

  /** Metricas de conexiones */
  getMetrics: () =>
    apiClient.get<BridgeResponse<Record<string, unknown>>>(
      "/hik-bridge/metrics",
    ),

  // ── Dispositivos ─────────────────────────────────────────

  /** Listar dispositivos conectados via SDK */
  listDevices: () =>
    apiClient.get<BridgeResponse<HikDeviceStatus[]>>("/hik-bridge/devices"),

  /** Info detallada de un dispositivo */
  getDeviceInfo: (ip: string) =>
    apiClient.get<BridgeResponse<HikDeviceInfo>>(
      `/hik-bridge/devices/${encodeURIComponent(ip)}/info`,
    ),

  /** Estado de un dispositivo */
  getDeviceStatus: (ip: string) =>
    apiClient.get<BridgeResponse<HikDeviceStatus>>(
      `/hik-bridge/devices/${encodeURIComponent(ip)}/status`,
    ),

  /** Login a un dispositivo */
  loginDevice: (params: {
    ip: string;
    port?: number;
    username: string;
    password: string;
    name?: string;
  }) =>
    apiClient.post<BridgeResponse<HikDeviceInfo>>(
      "/hik-bridge/devices/login",
      params,
    ),

  /** Login masivo */
  bulkLogin: (
    devices: Array<{
      ip: string;
      port?: number;
      username: string;
      password: string;
      name?: string;
    }>,
  ) =>
    apiClient.post<BridgeResponse<HikDeviceStatus[]>>(
      "/hik-bridge/devices/bulk-login",
      devices,
    ),

  /** Logout de un dispositivo */
  logoutDevice: (ip: string) =>
    apiClient.delete<BridgeResponse<{ ip: string; logged_out: boolean }>>(
      `/hik-bridge/devices/${encodeURIComponent(ip)}/logout`,
    ),

  /** Refrescar dispositivos desde AION API */
  refreshDevices: () =>
    apiClient.post<BridgeResponse<HikDeviceStatus[]>>(
      "/hik-bridge/devices/refresh",
      {},
    ),

  // ── Alarmas ──────────────────────────────────────────────

  /** Suscribir alarmas SDK para un dispositivo */
  subscribeAlarms: (deviceId: string) =>
    apiClient.post<BridgeResponse<HikAlarmSubscription>>(
      `/hik-bridge/${encodeURIComponent(deviceId)}/alarms/subscribe`,
      {},
    ),

  /** Desuscribir alarmas */
  unsubscribeAlarms: (deviceId: string) =>
    apiClient.delete<BridgeResponse<{ ip: string }>>(
      `/hik-bridge/${encodeURIComponent(deviceId)}/alarms/unsubscribe`,
    ),

  /** Listar suscripciones activas */
  listAlarmSubscriptions: () =>
    apiClient.get<BridgeResponse<HikAlarmSubscription[]>>(
      "/hik-bridge/alarms/subscriptions",
    ),

  /** Obtener alarmas recientes */
  getRecentAlarms: (count = 100) =>
    apiClient.get<BridgeResponse<unknown[]>>(
      `/hik-bridge/alarms/recent?count=${count}`,
    ),

  // ── PTZ ──────────────────────────────────────────────────

  /** Mover camara PTZ */
  ptzMove: (
    deviceId: string,
    params: {
      channel?: number;
      direction: string;
      speed?: number;
    },
  ) =>
    apiClient.post<BridgeResponse<{ action: string; success: boolean }>>(
      `/hik-bridge/${encodeURIComponent(deviceId)}/ptz/move`,
      params,
    ),

  /** Detener movimiento PTZ */
  ptzStop: (deviceId: string, channel = 1) =>
    apiClient.post<BridgeResponse<{ action: string; success: boolean }>>(
      `/hik-bridge/${encodeURIComponent(deviceId)}/ptz/stop`,
      { channel },
    ),

  /** Ejecutar preset PTZ */
  ptzPreset: (
    deviceId: string,
    params: {
      channel?: number;
      preset_index: number;
      action?: "goto" | "set" | "clear";
    },
  ) =>
    apiClient.post<BridgeResponse<{ action: string; success: boolean }>>(
      `/hik-bridge/${encodeURIComponent(deviceId)}/ptz/preset`,
      params,
    ),

  /** Listar presets PTZ */
  getPtzPresets: (deviceId: string, channel = 1) =>
    apiClient.get<BridgeResponse<HikPTZPreset[]>>(
      `/hik-bridge/${encodeURIComponent(deviceId)}/ptz/presets?channel=${channel}`,
    ),

  // ── Snapshots ────────────────────────────────────────────

  /** Capturar snapshot via SDK */
  captureSnapshot: (deviceId: string, channel = 1) =>
    apiClient.post<BridgeResponse<HikSnapshot>>(
      `/hik-bridge/${encodeURIComponent(deviceId)}/snapshot/${channel}`,
      {},
    ),

  /** Listar snapshots guardados */
  listSnapshots: (deviceIp?: string) => {
    const qs = deviceIp ? `?device_ip=${encodeURIComponent(deviceIp)}` : "";
    return apiClient.get<BridgeResponse<HikSnapshot[]>>(
      `/hik-bridge/snapshots${qs}`,
    );
  },

  // ── Grabaciones ──────────────────────────────────────────

  /** Buscar grabaciones en dispositivo */
  searchRecordings: (params: {
    device_ip: string;
    channel?: number;
    start_time: string;
    end_time: string;
  }) =>
    apiClient.post<BridgeResponse<HikRecordingFile[]>>(
      "/hik-bridge/recordings/search",
      params,
    ),

  /** Iniciar descarga de grabacion */
  startDownload: (params: {
    device_ip: string;
    filename: string;
    channel?: number;
  }) =>
    apiClient.post<BridgeResponse<HikDownloadStatus>>(
      "/hik-bridge/recordings/download",
      params,
    ),

  /** Estado de una descarga */
  getDownloadStatus: (downloadId: string) =>
    apiClient.get<BridgeResponse<HikDownloadStatus>>(
      `/hik-bridge/recordings/${encodeURIComponent(downloadId)}/status`,
    ),

  /** Listar todas las descargas */
  listDownloads: () =>
    apiClient.get<BridgeResponse<HikDownloadStatus[]>>(
      "/hik-bridge/recordings/downloads",
    ),

  // ── Discovery ────────────────────────────────────────────

  /** Escanear red para dispositivos Hikvision (SADP) */
  scanNetwork: (timeout = 10) =>
    apiClient.post<BridgeResponse<HikDiscoveredDevice[]>>(
      "/hik-bridge/discovery/scan",
      { timeout },
    ),
};
