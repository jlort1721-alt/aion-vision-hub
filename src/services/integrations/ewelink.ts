/**
 * eWeLink / Sonoff Integration Service — Frontend Proxy Client
 *
 * This client calls the BACKEND /ewelink/* proxy endpoints.
 * All credentials (App ID, App Secret, user tokens) are stored server-side.
 * The browser NEVER sees eWeLink API credentials or tokens.
 *
 * ARCHITECTURE:
 *   Frontend (this file) → Backend /ewelink/* → eWeLink Cloud API
 *
 * SETUP:
 *   1. Set EWELINK_APP_ID and EWELINK_APP_SECRET in backend/.env
 *   2. Users authenticate via the Domotics page (calls /ewelink/login)
 *   3. Backend manages tokens and proxies all device operations
 *
 * SECURITY:
 *   - No VITE_EWELINK_* env vars are read or used
 *   - No tokens are stored or cached in the browser
 *   - All API calls are authenticated via the user's JWT session
 */

import { supabase } from '@/integrations/supabase/client';

// ── Types ──

export interface EWeLinkDevice {
  deviceId: string;
  name: string;
  brandName: string;
  productModel: string;
  online: boolean;
  params: Record<string, unknown>;
  switches?: Array<{ switch: 'on' | 'off'; outlet: number }>;
  firmware?: string;
  deviceType?: string;
  createdAt?: string;
  sectionId?: string;
}

export interface EWeLinkDeviceAction {
  deviceId: string;
  action: 'on' | 'off' | 'toggle';
  outlet?: number;
}

export interface EWeLinkResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

export interface EWeLinkHealthCheck {
  configured: boolean;
  region: string;
  status: 'connected' | 'error' | 'not_configured';
  message: string;
  latencyMs?: number;
  deviceCount?: number;
  onlineCount?: number;
  authenticated: boolean;
  encryptionEnabled?: boolean;
}

export interface EWeLinkStoredAccount {
  label: string;
  email: string; // masked
}

export interface EWeLinkStatus {
  configured: boolean;
  authenticated: boolean;
  region: string;
  encryptionEnabled: boolean;
  tokenExpiresAt: string | null;
  activeAccount: string | null;
  storedAccounts: EWeLinkStoredAccount[];
  hasStoredAccounts: boolean;
}

export interface EWeLinkSyncResult {
  synced: number;
  online: number;
  offline: number;
  errors: string[];
  devices: EWeLinkDevice[];
}

export type EWeLinkLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface EWeLinkLogEntry {
  timestamp: string;
  level: EWeLinkLogLevel;
  action: string;
  message: string;
  deviceId?: string;
  latencyMs?: number;
  error?: string;
}

const LOG_MAX_ENTRIES = 200;

// ── Backend API base ──

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiCall<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({ message: resp.statusText }));
    throw new Error(errorData.message || `API error ${resp.status}`);
  }

  return resp.json();
}

// ── Service (proxies to backend) ──

export class EWeLinkService {
  private logs: EWeLinkLogEntry[] = [];
  private _authenticated = false;
  private sectionMap: Map<string, string> = new Map();

  isConfigured(): boolean {
    // Always true from frontend perspective — backend handles this
    return true;
  }

  isAuthenticated(): boolean {
    return this._authenticated;
  }

  // ── Logging ──

  private log(level: EWeLinkLogLevel, action: string, message: string, extra?: Partial<EWeLinkLogEntry>) {
    const entry: EWeLinkLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      action,
      message,
      ...extra,
    };

    this.logs.unshift(entry);
    if (this.logs.length > LOG_MAX_ENTRIES) {
      this.logs = this.logs.slice(0, LOG_MAX_ENTRIES);
    }
  }

  getLogs(limit: number = 50): EWeLinkLogEntry[] {
    return this.logs.slice(0, limit);
  }

  clearLogs() {
    this.logs = [];
  }

  // ── Authentication (via backend proxy) ──

  async login(email: string, password: string, countryCode: string = '+1'): Promise<EWeLinkResult> {
    this.log('info', 'login', 'Authenticating via backend proxy');

    try {
      const result = await apiCall<{ success: boolean; data: unknown }>('POST', '/ewelink/login', {
        email,
        password,
        countryCode,
      });

      if (result.success) {
        this._authenticated = true;
        this.log('info', 'login', 'Login successful (via backend)');
      }

      return { success: result.success, data: result.data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      this.log('error', 'login', msg);
      return { success: false, error: msg };
    }
  }

  logout() {
    this._authenticated = false;
    apiCall('POST', '/ewelink/logout').catch(() => {});
    this.log('info', 'logout', 'Session cleared');
  }

  // ── Stored Account Operations (via backend proxy) ──

  async getStoredAccounts(): Promise<{ accounts: EWeLinkStoredAccount[]; hasStoredAccounts: boolean }> {
    try {
      const result = await apiCall<{ success: boolean; data: { accounts: EWeLinkStoredAccount[]; hasStoredAccounts: boolean } }>(
        'GET',
        '/ewelink/accounts',
      );
      return result.data;
    } catch {
      return { accounts: [], hasStoredAccounts: false };
    }
  }

  async autoLogin(accountLabel?: string): Promise<EWeLinkResult> {
    this.log('info', 'auto_login', `Auto-login attempt${accountLabel ? ` with ${accountLabel}` : ''}`);

    try {
      const result = await apiCall<{ success: boolean; data: { success: boolean; error?: string; account?: string } }>(
        'POST',
        '/ewelink/auto-login',
        accountLabel ? { accountLabel } : {},
      );

      if (result.data?.success) {
        this._authenticated = true;
        this.log('info', 'auto_login', `Auto-login successful (${result.data.account})`);
      }

      return { success: result.data?.success ?? false, error: result.data?.error, data: result.data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Auto-login failed';
      this.log('error', 'auto_login', msg);
      return { success: false, error: msg };
    }
  }

  async switchAccount(accountLabel: string): Promise<EWeLinkResult> {
    this.log('info', 'switch_account', `Switching to ${accountLabel}`);

    try {
      const result = await apiCall<{ success: boolean; data: { success: boolean; error?: string; account?: string } }>(
        'POST',
        '/ewelink/switch-account',
        { accountLabel },
      );

      if (result.data?.success) {
        this._authenticated = true;
        this.log('info', 'switch_account', `Switched to ${accountLabel}`);
      }

      return { success: result.data?.success ?? false, error: result.data?.error, data: result.data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Account switch failed';
      this.log('error', 'switch_account', msg);
      return { success: false, error: msg };
    }
  }

  // ── Device Operations (via backend proxy) ──

  async listDevices(): Promise<EWeLinkDevice[]> {
    this.log('info', 'list_devices', 'Fetching device list via backend');

    const result = await apiCall<{ success: boolean; data: { devices: EWeLinkDevice[]; total: number } }>('GET', '/ewelink/devices');
    const devices = result.data?.devices || [];

    // Apply local section mapping
    for (const device of devices) {
      const sectionId = this.sectionMap.get(device.deviceId);
      if (sectionId) device.sectionId = sectionId;
    }

    this.log('info', 'list_devices', `Found ${devices.length} devices`);
    return devices;
  }

  async getDeviceState(deviceId: string): Promise<EWeLinkResult> {
    this.log('debug', 'get_state', `Querying state for ${deviceId}`, { deviceId });

    try {
      const result = await apiCall<{ success: boolean; data: unknown }>('GET', `/ewelink/devices/${deviceId}/state`);
      return { success: result.success, data: result.data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get state';
      return { success: false, error: msg };
    }
  }

  async controlDevice(action: EWeLinkDeviceAction): Promise<EWeLinkResult> {
    this.log('info', 'control', `Sending "${action.action}" to device ${action.deviceId}`, {
      deviceId: action.deviceId,
    });

    try {
      const result = await apiCall<{ success: boolean; data: unknown }>('POST', '/ewelink/devices/control', {
        deviceId: action.deviceId,
        action: action.action,
        outlet: action.outlet,
      });

      this.log('info', 'control', `Control result: ${result.success ? 'OK' : 'FAIL'}`, {
        deviceId: action.deviceId,
      });

      return { success: result.success, data: result.data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Control failed';
      this.log('error', 'control', msg, { deviceId: action.deviceId });
      return { success: false, error: msg };
    }
  }

  async controlMultipleDevices(
    actions: EWeLinkDeviceAction[],
  ): Promise<{ results: Array<EWeLinkResult & { deviceId: string }> }> {
    this.log('info', 'batch_control', `Batch controlling ${actions.length} devices`);

    try {
      const result = await apiCall<{ success: boolean; data: Array<EWeLinkResult & { deviceId: string }> }>(
        'POST',
        '/ewelink/devices/batch',
        { actions },
      );

      return { results: result.data || [] };
    } catch (err) {
      return {
        results: actions.map((a) => ({
          success: false,
          error: err instanceof Error ? err.message : 'Batch failed',
          deviceId: a.deviceId,
        })),
      };
    }
  }

  // ── Device Sync ──

  async syncDevices(): Promise<EWeLinkSyncResult> {
    this.log('info', 'sync', 'Starting device sync');

    try {
      const devices = await this.listDevices();
      return {
        synced: devices.length,
        online: devices.filter((d) => d.online).length,
        offline: devices.filter((d) => !d.online).length,
        errors: [],
        devices,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      this.log('error', 'sync', msg);
      return { synced: 0, online: 0, offline: 0, errors: [msg], devices: [] };
    }
  }

  // ── Section Mapping (local, for UI grouping) ──

  setSectionMapping(deviceId: string, sectionId: string) {
    this.sectionMap.set(deviceId, sectionId);
  }

  removeSectionMapping(deviceId: string) {
    this.sectionMap.delete(deviceId);
  }

  getSectionMapping(): Map<string, string> {
    return new Map(this.sectionMap);
  }

  loadSectionMappings(mappings: Array<{ deviceId: string; sectionId: string }>) {
    this.sectionMap.clear();
    for (const m of mappings) {
      this.sectionMap.set(m.deviceId, m.sectionId);
    }
  }

  async getDevicesBySection(sectionId: string): Promise<EWeLinkDevice[]> {
    const devices = await this.listDevices();
    return devices.filter((d) => this.sectionMap.get(d.deviceId) === sectionId);
  }

  // ── Health & Status (via backend proxy) ──

  async testConnection(): Promise<EWeLinkHealthCheck> {
    this.log('info', 'health', 'Running health check via backend');

    try {
      const result = await apiCall<{ success: boolean; data: EWeLinkHealthCheck }>('GET', '/ewelink/health');
      this._authenticated = result.data?.authenticated || false;
      return result.data;
    } catch (err) {
      return {
        configured: false,
        region: 'unknown',
        status: 'error',
        message: err instanceof Error ? err.message : 'Health check failed',
        latencyMs: 0,
        authenticated: false,
      };
    }
  }

  async testFullPipeline(): Promise<EWeLinkHealthCheck> {
    this.log('info', 'test_connection', 'Running full pipeline test via backend');

    try {
      const result = await apiCall<{ success: boolean; data: EWeLinkHealthCheck }>('GET', '/ewelink/test-connection');
      this._authenticated = result.data?.authenticated || false;
      return result.data;
    } catch (err) {
      return {
        configured: false,
        region: 'unknown',
        status: 'error',
        message: err instanceof Error ? err.message : 'Connection test failed',
        latencyMs: 0,
        authenticated: false,
      };
    }
  }

  async getStatus(): Promise<EWeLinkStatus> {
    try {
      const result = await apiCall<{ success: boolean; data: EWeLinkStatus }>('GET', '/ewelink/status');
      this._authenticated = result.data?.authenticated || false;
      return result.data;
    } catch {
      return {
        configured: false,
        authenticated: false,
        region: 'unknown',
        encryptionEnabled: false,
        tokenExpiresAt: null,
      };
    }
  }
}

// ── Singleton Instance ──

export const ewelink = new EWeLinkService();
