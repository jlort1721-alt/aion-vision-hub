// ============================================================
// AION — Hikvision Bridge Client (TypeScript)
// HTTP client for the Python hik-bridge microservice (port 8100)
// Pattern: same as modules/clave-bridge/routes.ts
// ============================================================

import { createLogger } from "@aion/common-utils";
import { fetchWithTimeout } from "../../lib/http-client.js";

const logger = createLogger({ name: "hik-bridge-client" });

// Internal-only — hik-bridge runs on localhost
const HIK_BRIDGE_URL = process.env.HIK_BRIDGE_URL || "http://localhost:8100";
const HIK_BRIDGE_API_KEY = process.env.HIK_BRIDGE_API_KEY || "";
const ALLOWED_HOSTS = ["localhost", "127.0.0.1", "::1"];

function validateBridgeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

interface BridgeResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

type RequestMethod = "GET" | "POST" | "DELETE";

async function bridgeRequest<T = unknown>(
  method: RequestMethod,
  path: string,
  body?: unknown,
  timeoutMs = 10_000,
): Promise<BridgeResponse<T>> {
  const url = `${HIK_BRIDGE_URL}${path}`;

  if (!validateBridgeUrl(url)) {
    throw new Error("Invalid hik-bridge URL — must be localhost");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (HIK_BRIDGE_API_KEY) {
    headers["X-API-Key"] = HIK_BRIDGE_API_KEY;
  }

  try {
    const response = await fetchWithTimeout(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      timeout: timeoutMs,
    });

    const data = (await response.json()) as BridgeResponse<T>;

    if (!response.ok) {
      logger.warn(
        { path, status: response.status },
        "hik-bridge error response",
      );
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("abort") || message.includes("timeout")) {
      logger.warn({ path, timeoutMs }, "hik-bridge request timeout");
      return { success: false, error: "Bridge request timeout" };
    }
    logger.warn({ path, error: message }, "hik-bridge connection failed");
    return { success: false, error: `Bridge unavailable: ${message}` };
  }
}

// ═══════════════════════════════════════════
// Health
// ═══════════════════════════════════════════

export async function getHealth(): Promise<BridgeResponse> {
  return bridgeRequest("GET", "/health");
}

export async function getMetrics(): Promise<BridgeResponse> {
  return bridgeRequest("GET", "/metrics");
}

// ═══════════════════════════════════════════
// Devices
// ═══════════════════════════════════════════

export async function listDevices(): Promise<BridgeResponse> {
  return bridgeRequest("GET", "/api/devices");
}

export async function getDeviceInfo(ip: string): Promise<BridgeResponse> {
  return bridgeRequest("GET", `/api/devices/${encodeURIComponent(ip)}/info`);
}

export async function getDeviceStatus(ip: string): Promise<BridgeResponse> {
  return bridgeRequest("GET", `/api/devices/${encodeURIComponent(ip)}/status`);
}

export async function loginDevice(credentials: {
  ip: string;
  port?: number;
  username: string;
  password: string;
  name?: string;
  site_id?: string;
  device_id?: string;
}): Promise<BridgeResponse> {
  return bridgeRequest("POST", "/api/devices/login", credentials, 15_000);
}

export async function bulkLogin(
  devices: Array<{
    ip: string;
    port?: number;
    username: string;
    password: string;
    name?: string;
  }>,
): Promise<BridgeResponse> {
  return bridgeRequest("POST", "/api/devices/bulk-login", devices, 60_000);
}

export async function logoutDevice(ip: string): Promise<BridgeResponse> {
  return bridgeRequest(
    "DELETE",
    `/api/devices/${encodeURIComponent(ip)}/logout`,
  );
}

export async function refreshDevices(): Promise<BridgeResponse> {
  return bridgeRequest("POST", "/api/devices/refresh", {}, 30_000);
}

// ═══════════════════════════════════════════
// Alarms
// ═══════════════════════════════════════════

export async function subscribeAlarms(ip: string): Promise<BridgeResponse> {
  return bridgeRequest(
    "POST",
    `/api/alarms/subscribe/${encodeURIComponent(ip)}`,
  );
}

export async function unsubscribeAlarms(ip: string): Promise<BridgeResponse> {
  return bridgeRequest(
    "DELETE",
    `/api/alarms/unsubscribe/${encodeURIComponent(ip)}`,
  );
}

export async function listAlarmSubscriptions(): Promise<BridgeResponse> {
  return bridgeRequest("GET", "/api/alarms/subscriptions");
}

export async function getRecentAlarms(count = 100): Promise<BridgeResponse> {
  return bridgeRequest("GET", `/api/alarms/recent?count=${count}`);
}

// ═══════════════════════════════════════════
// PTZ
// ═══════════════════════════════════════════

export async function ptzMove(params: {
  device_ip: string;
  channel?: number;
  direction: string;
  speed?: number;
}): Promise<BridgeResponse> {
  return bridgeRequest("POST", "/api/ptz/move", params);
}

export async function ptzStop(params: {
  device_ip: string;
  channel?: number;
}): Promise<BridgeResponse> {
  return bridgeRequest("POST", "/api/ptz/stop", params);
}

export async function ptzPreset(params: {
  device_ip: string;
  channel?: number;
  preset_index: number;
  action?: string;
}): Promise<BridgeResponse> {
  return bridgeRequest("POST", "/api/ptz/preset", params);
}

export async function getPtzPresets(
  ip: string,
  channel = 1,
): Promise<BridgeResponse> {
  return bridgeRequest(
    "GET",
    `/api/ptz/${encodeURIComponent(ip)}/presets?channel=${channel}`,
  );
}

// ═══════════════════════════════════════════
// Snapshots
// ═══════════════════════════════════════════

export async function captureSnapshot(params: {
  device_ip: string;
  channel?: number;
  quality?: number;
}): Promise<BridgeResponse> {
  return bridgeRequest("POST", "/api/snapshots/capture", params);
}

export async function listSnapshots(
  deviceIp?: string,
): Promise<BridgeResponse> {
  const qs = deviceIp ? `?device_ip=${encodeURIComponent(deviceIp)}` : "";
  return bridgeRequest("GET", `/api/snapshots${qs}`);
}

export async function getSnapshotFile(filename: string): Promise<Response> {
  const url = `${HIK_BRIDGE_URL}/api/snapshots/${encodeURIComponent(filename)}`;

  if (!validateBridgeUrl(url)) {
    return new Response("Invalid bridge URL", { status: 400 });
  }

  const headers: Record<string, string> = {};
  if (HIK_BRIDGE_API_KEY) {
    headers["X-API-Key"] = HIK_BRIDGE_API_KEY;
  }

  return fetchWithTimeout(url, { headers, timeout: 30_000 });
}

export async function deleteSnapshot(
  filename: string,
): Promise<BridgeResponse> {
  return bridgeRequest(
    "DELETE",
    `/api/snapshots/${encodeURIComponent(filename)}`,
  );
}

// ═══════════════════════════════════════════
// Recordings
// ═══════════════════════════════════════════

export async function searchRecordings(params: {
  device_ip: string;
  channel?: number;
  start_time: string;
  end_time: string;
  file_type?: number;
}): Promise<BridgeResponse> {
  return bridgeRequest("POST", "/api/recordings/search", params, 30_000);
}

export async function startRecordingDownload(params: {
  device_ip: string;
  filename: string;
  channel?: number;
}): Promise<BridgeResponse> {
  return bridgeRequest("POST", "/api/recordings/download", params);
}

export async function getDownloadStatus(
  downloadId: string,
): Promise<BridgeResponse> {
  return bridgeRequest(
    "GET",
    `/api/recordings/download/${encodeURIComponent(downloadId)}/status`,
  );
}

export async function listDownloads(): Promise<BridgeResponse> {
  return bridgeRequest("GET", "/api/recordings/downloads");
}

export async function getDownloadFile(downloadId: string): Promise<Response> {
  const url = `${HIK_BRIDGE_URL}/api/recordings/download/${encodeURIComponent(downloadId)}/file`;

  if (!validateBridgeUrl(url)) {
    return new Response("Invalid bridge URL", { status: 400 });
  }

  const headers: Record<string, string> = {};
  if (HIK_BRIDGE_API_KEY) {
    headers["X-API-Key"] = HIK_BRIDGE_API_KEY;
  }

  return fetchWithTimeout(url, { headers, timeout: 300_000 });
}

// ═══════════════════════════════════════════
// Discovery
// ═══════════════════════════════════════════

export async function scanNetwork(timeout = 10): Promise<BridgeResponse> {
  return bridgeRequest(
    "POST",
    `/api/discovery/scan?timeout=${timeout}`,
    {},
    (timeout + 5) * 1000,
  );
}

// ═══════════════════════════════════════════
// Health check utility
// ═══════════════════════════════════════════

let _bridgeAvailable: boolean | null = null;
let _lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 60_000; // 1 minute cache

export async function isBridgeAvailable(): Promise<boolean> {
  const now = Date.now();
  if (
    _bridgeAvailable !== null &&
    now - _lastHealthCheck < HEALTH_CHECK_INTERVAL
  ) {
    return _bridgeAvailable;
  }

  try {
    const result = await getHealth();
    _bridgeAvailable = result.success;
    _lastHealthCheck = now;
    return _bridgeAvailable;
  } catch {
    _bridgeAvailable = false;
    _lastHealthCheck = now;
    return false;
  }
}
