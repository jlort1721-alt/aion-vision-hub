/**
 * eWeLink Direct API v2 (CoolKit) — Fallback for MCP
 *
 * Provides direct REST API integration with eWeLink Cloud.
 * Used as contingency when MCP server is unavailable.
 * Supports multi-account, auto token refresh, and real-time WebSocket.
 */
import crypto from 'crypto';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'ewelink-direct' });

const API_URLS: Record<string, string> = {
  us: 'https://us-apia.coolkit.cc',
  eu: 'https://eu-apia.coolkit.cc',
  as: 'https://as-apia.coolkit.cc',
  cn: 'https://cn-apia.coolkit.cc',
};

export interface EwelinkDevice {
  deviceid: string;
  name: string;
  brandName?: string;
  productModel?: string;
  online: boolean;
  params: Record<string, unknown>;
  uiid?: number;
  account: string;
}

interface AccountConfig {
  email: string;
  password: string;
  label: string;
}

interface AccountSession {
  config: AccountConfig;
  at: string;
  rt: string;
  apikey: string;
  tokenExpiry: number;
}

export class EwelinkDirectService {
  private appId: string;
  private appSecret: string;
  private region: string;
  private baseUrl: string;
  private accounts: AccountConfig[];
  private sessions: Map<string, AccountSession> = new Map();
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private healthy = false;

  constructor(options: {
    appId?: string;
    appSecret?: string;
    region?: string;
    accounts: AccountConfig[];
  }) {
    this.appId = options.appId || '';
    this.appSecret = options.appSecret || '';
    this.region = options.region || 'us';
    this.baseUrl = API_URLS[this.region] || API_URLS.us;
    this.accounts = options.accounts;
  }

  isConfigured(): boolean {
    return this.accounts.length > 0 && this.accounts.some(a => a.email && a.password);
  }

  isHealthy(): boolean {
    return this.healthy && this.sessions.size > 0;
  }

  // ── Authentication ─────────────────────────────────────────

  private signBody(body: string): string {
    if (this.appSecret) {
      return crypto.createHmac('sha256', this.appSecret).update(body).digest('base64');
    }
    return '';
  }

  private buildHeaders(body: string, at?: string): Record<string, string> {
    const nonce = crypto.randomBytes(4).toString('hex');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CK-Nonce': nonce,
    };
    if (this.appId) headers['X-CK-Appid'] = this.appId;
    if (at) {
      headers['Authorization'] = `Bearer ${at}`;
    } else if (this.appSecret) {
      headers['Authorization'] = `Sign ${this.signBody(body)}`;
    }
    return headers;
  }

  private async apiRequest(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    at?: string,
  ): Promise<Record<string, unknown>> {
    const url = `${this.baseUrl}${path}`;
    const bodyStr = body ? JSON.stringify(body) : '';
    const headers = this.buildHeaders(bodyStr, at);

    const resp = await fetch(url, {
      method,
      headers,
      body: method !== 'GET' ? bodyStr : undefined,
      signal: AbortSignal.timeout(10000),
    });

    const data = await resp.json() as Record<string, unknown>;
    const error = data.error as number | undefined;

    if (error === 401 || error === 402) {
      throw new Error(`TOKEN_EXPIRED:${error}`);
    }
    if (error && error !== 0) {
      throw new Error(`EWELINK_ERROR:${error}:${data.msg || 'Unknown'}`);
    }

    return data;
  }

  async login(account: AccountConfig): Promise<AccountSession> {
    logger.info({ email: account.email }, 'eWeLink direct login');

    const body: Record<string, unknown> = {
      email: account.email,
      password: account.password,
      countryCode: '+57',
    };

    const data = await this.apiRequest('POST', '/v2/user/login', body);
    const result = data.data as Record<string, unknown>;

    if (!result?.at) {
      throw new Error(`Login failed for ${account.email}: ${JSON.stringify(data)}`);
    }

    const session: AccountSession = {
      config: account,
      at: result.at as string,
      rt: result.rt as string,
      apikey: (result.user as Record<string, unknown>)?.apikey as string || '',
      tokenExpiry: Date.now() + 29 * 24 * 60 * 60 * 1000, // 29 days
    };

    this.sessions.set(account.label, session);
    this.scheduleRefresh(account.label);
    logger.info({ email: account.email, label: account.label }, 'eWeLink login successful');
    return session;
  }

  async loginAll(): Promise<void> {
    for (const account of this.accounts) {
      try {
        await this.login(account);
      } catch (err) {
        logger.error({ email: account.email, err: (err as Error).message }, 'eWeLink login failed');
      }
    }
    this.healthy = this.sessions.size > 0;
  }

  private scheduleRefresh(label: string): void {
    const existing = this.refreshTimers.get(label);
    if (existing) clearTimeout(existing);

    // Refresh 24h before expiry
    const session = this.sessions.get(label);
    if (!session) return;

    const refreshIn = Math.max(session.tokenExpiry - Date.now() - 24 * 60 * 60 * 1000, 60000);
    const timer = setTimeout(async () => {
      try {
        await this.refreshToken(label);
      } catch {
        // If refresh fails, try full login
        try {
          await this.login(session.config);
        } catch (err) {
          logger.error({ label, err: (err as Error).message }, 'Token refresh and re-login both failed');
        }
      }
    }, refreshIn);
    this.refreshTimers.set(label, timer);
  }

  async refreshToken(label: string): Promise<void> {
    const session = this.sessions.get(label);
    if (!session) throw new Error(`No session for ${label}`);

    const data = await this.apiRequest('POST', '/v2/user/refresh', { rt: session.rt }, session.at);
    const result = data.data as Record<string, unknown>;

    if (result?.at) {
      session.at = result.at as string;
      session.rt = result.rt as string;
      session.tokenExpiry = Date.now() + 29 * 24 * 60 * 60 * 1000;
      this.scheduleRefresh(label);
      logger.info({ label }, 'Token refreshed');
    }
  }

  // ── Device Operations ──────────────────────────────────────

  private async getSessionForRequest(accountLabel?: string): Promise<AccountSession> {
    const label = accountLabel || 'primary';
    let session = this.sessions.get(label);

    if (!session) {
      // Try to login
      const config = this.accounts.find(a => a.label === label);
      if (config) {
        session = await this.login(config);
      }
    }

    if (!session) {
      // Fall back to any available session
      const firstSession = this.sessions.values().next().value as AccountSession | undefined;
      if (firstSession) return firstSession;
      throw new Error('No active eWeLink session');
    }

    return session;
  }

  private async requestWithRetry(
    accountLabel: string | undefined,
    fn: (session: AccountSession) => Promise<Record<string, unknown>>,
  ): Promise<Record<string, unknown>> {
    const session = await this.getSessionForRequest(accountLabel);
    try {
      return await fn(session);
    } catch (err) {
      if ((err as Error).message.startsWith('TOKEN_EXPIRED')) {
        await this.refreshToken(session.config.label);
        const refreshedSession = await this.getSessionForRequest(accountLabel);
        return fn(refreshedSession);
      }
      throw err;
    }
  }

  async getDevices(accountLabel?: string): Promise<EwelinkDevice[]> {
    if (accountLabel) {
      return this.getDevicesForAccount(accountLabel);
    }
    // Get devices from all accounts
    const allDevices: EwelinkDevice[] = [];
    for (const [label] of this.sessions) {
      try {
        const devices = await this.getDevicesForAccount(label);
        allDevices.push(...devices);
      } catch (err) {
        logger.warn({ label, err: (err as Error).message }, 'Failed to get devices for account');
      }
    }
    return allDevices;
  }

  private async getDevicesForAccount(label: string): Promise<EwelinkDevice[]> {
    const data = await this.requestWithRetry(label, async (session) => {
      return this.apiRequest('GET', '/v2/device/thing', undefined, session.at);
    });

    const things = (data.data as Record<string, unknown>)?.thingList as Array<Record<string, unknown>> || [];

    return things.map(thing => {
      const item = thing.itemData as Record<string, unknown> || thing;
      return {
        deviceid: item.deviceid as string || '',
        name: item.name as string || '',
        brandName: item.brandName as string,
        productModel: item.productModel as string,
        online: item.online === true,
        params: item.params as Record<string, unknown> || {},
        uiid: item.uiid as number,
        account: label,
      };
    });
  }

  async toggleDevice(deviceId: string, state: 'on' | 'off', accountLabel?: string): Promise<boolean> {
    try {
      await this.requestWithRetry(accountLabel, async (session) => {
        return this.apiRequest('POST', '/v2/device/thing/status', {
          type: 1,
          id: deviceId,
          params: { switch: state },
        }, session.at);
      });
      logger.info({ deviceId, state }, 'Device toggled via direct API');
      return true;
    } catch (err) {
      logger.error({ deviceId, state, err: (err as Error).message }, 'Toggle failed');
      return false;
    }
  }

  async pulseDevice(deviceId: string, durationMs = 1000, accountLabel?: string): Promise<boolean> {
    try {
      await this.requestWithRetry(accountLabel, async (session) => {
        return this.apiRequest('POST', '/v2/device/thing/status', {
          type: 1,
          id: deviceId,
          params: { pulse: 'on', pulseWidth: durationMs },
        }, session.at);
      });
      logger.info({ deviceId, durationMs }, 'Device pulsed via direct API');
      return true;
    } catch (err) {
      logger.error({ deviceId, durationMs, err: (err as Error).message }, 'Pulse failed');
      return false;
    }
  }

  async toggleChannel(deviceId: string, channel: number, state: 'on' | 'off', accountLabel?: string): Promise<boolean> {
    try {
      await this.requestWithRetry(accountLabel, async (session) => {
        return this.apiRequest('POST', '/v2/device/thing/status', {
          type: 1,
          id: deviceId,
          params: { switches: [{ switch: state, outlet: channel }] },
        }, session.at);
      });
      return true;
    } catch (err) {
      logger.error({ deviceId, channel, state, err: (err as Error).message }, 'Channel toggle failed');
      return false;
    }
  }

  async getDeviceStatus(deviceId: string, accountLabel?: string): Promise<Record<string, unknown> | null> {
    try {
      const data = await this.requestWithRetry(accountLabel, async (session) => {
        return this.apiRequest('GET', `/v2/device/thing/status?type=1&id=${deviceId}`, undefined, session.at);
      });
      return (data.data as Record<string, unknown>)?.params as Record<string, unknown> || null;
    } catch {
      return null;
    }
  }

  // ── Cleanup ────────────────────────────────────────────────

  stop(): void {
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    this.refreshTimers.clear();
    this.sessions.clear();
    this.healthy = false;
  }
}
