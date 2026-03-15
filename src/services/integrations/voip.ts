/**
 * VoIP / SIP / Intercom Integration Service — Frontend Client
 *
 * Routes all VoIP operations through the backend /intercom API module.
 * SIP credentials and PBX configuration are stored server-side only.
 *
 * For browser-based WebRTC calls, requires SIP.js library and
 * WSS transport configured on the PBX.
 *
 * ARCHITECTURE:
 *   Frontend (WebRTC/SIP.js) ←→ PBX (Asterisk ARI) ←→ Intercom (Fanvil SIP)
 *                                     ↕
 *                              Backend API (/intercom)
 *                                     ↕
 *                          ElevenLabs TTS (greetings)
 *                          AION Agent (AI conversation)
 *
 * SETUP:
 *   1. Deploy Asterisk/FreePBX with ARI enabled
 *   2. Set SIP_HOST, SIP_ARI_URL, SIP_ARI_USERNAME, SIP_ARI_PASSWORD in backend .env
 *   3. Configure intercom devices with SIP accounts
 *   4. Register devices in AION intercom module
 *   5. For WebRTC: configure WSS transport, set VITE_SIP_SERVER
 *
 * FANVIL SPECIFIC:
 *   Auto-provisioning via HTTP CGI API:
 *   http://<device-ip>/cgi-bin/ConfigManApp.com?key=<parameter>&value=<value>
 */

import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────

export interface VoIPConfig {
  sipServer: string;
  sipPort: number;
  sipTransport: 'udp' | 'tcp' | 'tls' | 'wss';
  sipDomain: string;
}

export interface SIPDevice {
  id: string;
  name: string;
  sipUri: string;
  ipAddress: string;
  brand: string;
  model: string;
  status: 'online' | 'offline' | 'ringing' | 'in_call';
}

export type CallMode = 'ai' | 'human' | 'mixed';

export interface CallSession {
  id: string;
  deviceId?: string;
  direction: 'inbound' | 'outbound';
  status: string;
  mode: CallMode;
  callerUri: string;
  calleeUri: string;
  attendedBy?: string;
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  greetingText?: string;
  handoffOccurred?: boolean;
  handoffReason?: string;
  visitorName?: string;
  visitorDestination?: string;
  accessGranted?: boolean;
  notes?: string;
}

export interface CallSessionFilters {
  deviceId?: string;
  sectionId?: string;
  direction?: 'inbound' | 'outbound';
  status?: string;
  mode?: CallMode;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface InitiateCallRequest {
  deviceId?: string;
  targetUri: string;
  sourceExtension?: string;
  mode?: CallMode;
  autoAnswer?: boolean;
  priority?: 'normal' | 'emergency';
  greetingContext?: string;
  customGreetingText?: string;
}

export interface InitiateCallResult {
  session: CallSession;
  sipResult: { success: boolean; error?: string };
  greeting?: { text: string; audioBytes: number };
}

export interface VoIPHealthCheck {
  sip: {
    provider: string;
    configured: boolean;
    status: 'connected' | 'registered' | 'error' | 'not_configured';
    message: string;
    latencyMs: number;
    sipServer?: string;
    transport?: string;
    activeCalls?: number;
  };
  voice: {
    provider: string;
    configured: boolean;
    status: string;
    message: string;
    latencyMs: number;
  };
  system: {
    sipConfigured: boolean;
    voiceConfigured: boolean;
    readyForCalls: boolean;
    readyForAI: boolean;
  };
}

export interface VoipConfig {
  sipHost?: string;
  sipPort?: number;
  sipTransport?: string;
  sipDomain?: string;
  pbxType?: string;
  defaultMode?: CallMode;
  greetingContext?: string;
  greetingLanguage?: string;
  greetingVoiceId?: string;
  aiTimeoutSeconds?: number;
  doorOpenDtmf?: string;
  autoOpenEnabled?: boolean;
  operatorExtension?: string;
  recordingEnabled?: boolean;
  customSiteName?: string;
  configured?: boolean;
}

export interface DeviceTestResult {
  reachable: boolean;
  httpReachable?: boolean;
  sipReachable?: boolean;
  latencyMs: number;
  deviceModel?: string;
  firmwareVersion?: string;
  error?: string;
}

export interface ProvisionResult {
  success: boolean;
  message: string;
  requiresReboot?: boolean;
  error?: string;
}

export interface DoorActionResult {
  success: boolean;
  message: string;
}

export interface ConnectorInfo {
  brand: string;
  displayName: string;
}

export interface CallStats {
  total: number;
  completed: number;
  missed: number;
  failed: number;
  aiHandled: number;
  humanHandled: number;
  mixedHandled: number;
  handoffs: number;
  accessGranted: number;
  accessDenied: number;
  avgDurationSeconds: number;
}

// ── Backend API Client ────────────────────────────────────

const BACKEND_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  };
}

async function intercomFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const resp = await fetch(`${BACKEND_BASE}/intercom-api${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers || {}) },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `Intercom API error ${resp.status}`);
  }
  const json = await resp.json();
  return json.data ?? json;
}

// ── Service Class ─────────────────────────────────────────

export class VoIPService {
  private sipServer: string;
  private sipPort: number;
  private sipTransport: string;
  private sipDomain: string;

  constructor(config?: Partial<VoIPConfig>) {
    this.sipServer = config?.sipServer || import.meta.env.VITE_SIP_SERVER || '';
    this.sipPort = config?.sipPort || parseInt(import.meta.env.VITE_SIP_PORT || '5060');
    this.sipTransport = config?.sipTransport || import.meta.env.VITE_SIP_TRANSPORT || 'udp';
    this.sipDomain = config?.sipDomain || import.meta.env.VITE_SIP_DOMAIN || '';
  }

  isConfigured(): boolean {
    return this.sipServer.length > 0;
  }

  // ── Health & Diagnostics ────────────────────────────────

  async healthCheck(): Promise<VoIPHealthCheck> {
    try {
      return await intercomFetch<VoIPHealthCheck>('/voip/health');
    } catch {
      // Fallback to local-only check
      return {
        sip: {
          provider: 'noop',
          configured: false,
          status: 'not_configured',
          message: 'Backend intercom API not reachable',
          latencyMs: 0,
        },
        voice: {
          provider: 'unknown',
          configured: false,
          status: 'not_configured',
          message: 'Backend not reachable',
          latencyMs: 0,
        },
        system: {
          sipConfigured: false,
          voiceConfigured: false,
          readyForCalls: false,
          readyForAI: false,
        },
      };
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    try {
      const health = await this.healthCheck();
      return {
        success: health.system.readyForCalls,
        message: health.sip.message,
        latencyMs: health.sip.latencyMs,
      };
    } catch {
      if (!this.isConfigured()) {
        return { success: false, message: 'VoIP not configured. Set SIP_HOST in backend .env.', latencyMs: 0 };
      }
      return this.testWssConnection();
    }
  }

  private async testWssConnection(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    if (this.sipTransport !== 'wss') {
      return {
        success: false,
        message: `SIP configured (${this.sipServer}:${this.sipPort}/${this.sipTransport}) but backend not reachable for verification.`,
        latencyMs: 0,
      };
    }

    return new Promise((resolve) => {
      const start = Date.now();
      const timeout = setTimeout(() => {
        resolve({ success: false, message: 'WSS connection timeout (5s)', latencyMs: Date.now() - start });
      }, 5000);

      try {
        const ws = new WebSocket(`wss://${this.sipServer}:${this.sipPort}`);
        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve({ success: true, message: `WSS SIP reachable at ${this.sipServer}:${this.sipPort}`, latencyMs: Date.now() - start });
        };
        ws.onerror = () => {
          clearTimeout(timeout);
          resolve({ success: false, message: `WSS unreachable at ${this.sipServer}:${this.sipPort}`, latencyMs: Date.now() - start });
        };
      } catch {
        clearTimeout(timeout);
        resolve({ success: false, message: 'WebSocket creation failed', latencyMs: Date.now() - start });
      }
    });
  }

  // ── Call Sessions ───────────────────────────────────────

  async initiateCall(request: InitiateCallRequest): Promise<InitiateCallResult> {
    return intercomFetch<InitiateCallResult>('/sessions/initiate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async listSessions(filters?: CallSessionFilters): Promise<CallSession[]> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined) params.set(key, String(val));
      });
    }
    const query = params.toString();
    return intercomFetch<CallSession[]>(`/sessions${query ? `?${query}` : ''}`);
  }

  async getSession(sessionId: string): Promise<CallSession> {
    return intercomFetch<CallSession>(`/sessions/${sessionId}`);
  }

  async updateSession(sessionId: string, data: Partial<CallSession>): Promise<CallSession> {
    return intercomFetch<CallSession>(`/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async endCall(sessionId: string, notes?: string): Promise<CallSession> {
    return intercomFetch<CallSession>(`/sessions/${sessionId}/end`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async handoffToHuman(sessionId: string, reason?: string): Promise<void> {
    await intercomFetch(`/sessions/${sessionId}/handoff`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getCallStats(from?: string, to?: string): Promise<CallStats> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return intercomFetch<CallStats>(`/sessions/stats${query ? `?${query}` : ''}`);
  }

  // ── Door Control ────────────────────────────────────────

  async openDoor(deviceId: string, relayIndex = 1): Promise<DoorActionResult> {
    return intercomFetch<DoorActionResult>('/door/open', {
      method: 'POST',
      body: JSON.stringify({ deviceId, relayIndex }),
    });
  }

  // ── Device Testing & Provisioning ───────────────────────

  async testDevice(ipAddress: string, brand = 'fanvil', credentials?: { username?: string; password?: string }): Promise<DeviceTestResult> {
    return intercomFetch<DeviceTestResult>('/devices/test', {
      method: 'POST',
      body: JSON.stringify({ ipAddress, brand, credentials }),
    });
  }

  async provisionDevice(params: {
    deviceId: string;
    sipUsername: string;
    sipPassword: string;
    displayName?: string;
    lineIndex?: number;
  }): Promise<ProvisionResult> {
    return intercomFetch<ProvisionResult>('/devices/provision', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async listConnectors(): Promise<ConnectorInfo[]> {
    return intercomFetch<ConnectorInfo[]>('/connectors');
  }

  // ── VoIP Configuration ─────────────────────────────────

  async getVoipConfig(): Promise<VoipConfig> {
    return intercomFetch<VoipConfig>('/voip/config');
  }

  async updateVoipConfig(config: Partial<VoipConfig>): Promise<VoipConfig> {
    return intercomFetch<VoipConfig>('/voip/config', {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
  }

  // ── Legacy helpers (backward compatibility) ─────────────

  buildSipUri(extension: string): string {
    return `sip:${extension}@${this.sipDomain || this.sipServer}`;
  }

  getFanvilProvisioningUrl(deviceIp: string, param: string, value: string): string {
    return `http://${deviceIp}/cgi-bin/ConfigManApp.com?key=${encodeURIComponent(param)}&value=${encodeURIComponent(value)}`;
  }

  getDeviceConfigTemplate(brand: string): Record<string, string> {
    const templates: Record<string, Record<string, string>> = {
      fanvil: {
        'SIP Server': this.sipServer,
        'SIP Port': String(this.sipPort),
        'Transport': this.sipTransport.toUpperCase(),
        'Proxy URL': `${this.sipServer}:${this.sipPort}`,
        'Auto Answer': 'Enabled',
        'DTMF Mode': 'RFC2833',
      },
      hikvision: {
        'SIP Server Address': this.sipServer,
        'SIP Server Port': String(this.sipPort),
        'Protocol Type': this.sipTransport.toUpperCase(),
      },
      dahua: {
        'SIP Server': this.sipServer,
        'SIP Port': String(this.sipPort),
        'Transport': this.sipTransport,
      },
    };
    return templates[brand.toLowerCase()] || templates.fanvil;
  }
}

// Singleton instance
export const voipService = new VoIPService();
