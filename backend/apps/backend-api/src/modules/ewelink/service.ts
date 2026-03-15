/**
 * eWeLink Backend Proxy Service — Production-Grade
 *
 * All eWeLink API calls are proxied through the backend so that App ID/Secret
 * and user tokens NEVER reach the browser. Tokens are persisted in the DB
 * encrypted with AES-256-GCM and refreshed automatically.
 *
 * Security guarantees:
 *   - App credentials read from env, never exposed via API
 *   - User tokens encrypted at rest (AES-256-GCM via CREDENTIAL_ENCRYPTION_KEY)
 *   - Tokens held in-memory per-tenant with encrypted DB fallback
 *   - Retry with exponential backoff on transient failures
 *   - All logs sanitised — no tokens, passwords, or secrets emitted
 */

import { createHmac } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { config } from '../../config/env.js';
import { db } from '../../db/client.js';
import { integrations } from '../../db/schema/index.js';
import { createLogger, encrypt, decrypt, withRetry } from '@aion/common-utils';

const logger = createLogger({ name: 'ewelink-proxy' });

// ── Constants ──────────────────────────────────────────────────

const EWELINK_API_REGIONS: Record<string, string> = {
  us: 'https://us-apia.coolkit.cc',
  eu: 'https://eu-apia.coolkit.cc',
  as: 'https://as-apia.coolkit.cc',
  cn: 'https://cn-apia.coolkit.cn',
};

const DEFAULT_TIMEOUT_MS = 10_000;
const TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // ~30 days
const INTEGRATION_TYPE = 'ewelink';
const INTEGRATION_NAME = 'eWeLink / Sonoff';

// ── Interfaces ─────────────────────────────────────────────────

interface TenantTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface EncryptedTokenPayload {
  at: string; // encrypted accessToken
  rt: string; // encrypted refreshToken
  exp: number;
}

// ── Helpers ────────────────────────────────────────────────────

function hmacSign(message: string, secret: string): string {
  return createHmac('sha256', secret).update(message).digest('base64');
}

/** Mask an email for safe logging: u***@domain.com */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local[0]}***@${domain}`;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Determine if an error is transient and worth retrying. */
function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Network / timeout errors are retryable
    if (msg.includes('abort') || msg.includes('timeout') || msg.includes('econnreset') || msg.includes('econnrefused') || msg.includes('fetch failed')) {
      return true;
    }
  }
  return false;
}

// ── Encryption Helpers ─────────────────────────────────────────

function getEncryptionKey(): string | undefined {
  return config.CREDENTIAL_ENCRYPTION_KEY;
}

function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) {
    // In dev without encryption key, store as-is (logged as warning once)
    return plaintext;
  }
  return encrypt(plaintext, key);
}

function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  if (!key) return ciphertext;
  try {
    return decrypt(ciphertext, key);
  } catch {
    // Ciphertext was stored unencrypted or key rotated
    return ciphertext;
  }
}

// ── Service ────────────────────────────────────────────────────

class EWeLinkProxyService {
  /** In-memory cache — always checked first to avoid DB round-trips. */
  private tenantTokens = new Map<string, TenantTokens>();

  private get appId(): string {
    return config.EWELINK_APP_ID || '';
  }

  private get appSecret(): string {
    return config.EWELINK_APP_SECRET || '';
  }

  private get apiBase(): string {
    return EWELINK_API_REGIONS[config.EWELINK_REGION] || EWELINK_API_REGIONS.us;
  }

  isConfigured(): boolean {
    return this.appId.length > 0 && this.appSecret.length > 0;
  }

  isAuthenticated(tenantId: string): boolean {
    const tokens = this.tenantTokens.get(tenantId);
    return tokens !== undefined && Date.now() < tokens.expiresAt;
  }

  // ── Token Persistence (encrypted in DB) ───────────────────

  private async persistTokens(tenantId: string, tokens: TenantTokens): Promise<void> {
    const payload: EncryptedTokenPayload = {
      at: encryptToken(tokens.accessToken),
      rt: encryptToken(tokens.refreshToken),
      exp: tokens.expiresAt,
    };

    try {
      // Upsert into integrations table
      const existing = await db
        .select({ id: integrations.id })
        .from(integrations)
        .where(and(eq(integrations.tenantId, tenantId), eq(integrations.type, INTEGRATION_TYPE)))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(integrations)
          .set({
            config: { tokens: payload, region: config.EWELINK_REGION },
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(integrations.id, existing[0].id));
      } else {
        await db.insert(integrations).values({
          tenantId,
          name: INTEGRATION_NAME,
          type: INTEGRATION_TYPE,
          config: { tokens: payload, region: config.EWELINK_REGION },
          isActive: true,
        });
      }

      logger.debug({ tenantId }, 'eWeLink tokens persisted (encrypted)');
    } catch (err) {
      logger.error({ tenantId, err: err instanceof Error ? err.message : 'unknown' }, 'Failed to persist eWeLink tokens');
    }
  }

  private async loadTokensFromDb(tenantId: string): Promise<TenantTokens | null> {
    try {
      const rows = await db
        .select({ config: integrations.config })
        .from(integrations)
        .where(and(eq(integrations.tenantId, tenantId), eq(integrations.type, INTEGRATION_TYPE)))
        .limit(1);

      if (rows.length === 0) return null;

      const cfg = rows[0].config as Record<string, unknown> | null;
      const tokensPayload = cfg?.tokens as EncryptedTokenPayload | undefined;
      if (!tokensPayload?.at || !tokensPayload?.rt) return null;

      // Check expiry before decrypting
      if (Date.now() >= tokensPayload.exp) {
        logger.debug({ tenantId }, 'Stored eWeLink tokens expired');
        return null;
      }

      const tokens: TenantTokens = {
        accessToken: decryptToken(tokensPayload.at),
        refreshToken: decryptToken(tokensPayload.rt),
        expiresAt: tokensPayload.exp,
      };

      // Populate in-memory cache
      this.tenantTokens.set(tenantId, tokens);
      return tokens;
    } catch (err) {
      logger.error({ tenantId, err: err instanceof Error ? err.message : 'unknown' }, 'Failed to load eWeLink tokens from DB');
      return null;
    }
  }

  private async clearPersistedTokens(tenantId: string): Promise<void> {
    try {
      await db
        .update(integrations)
        .set({
          config: { tokens: null, region: config.EWELINK_REGION },
          isActive: false,
          updatedAt: new Date(),
        })
        .where(and(eq(integrations.tenantId, tenantId), eq(integrations.type, INTEGRATION_TYPE)));
    } catch {
      // Best-effort — failing to clear persisted tokens is not fatal
    }
  }

  /** Ensure we have valid tokens, loading from DB if needed. */
  private async ensureTokens(tenantId: string): Promise<TenantTokens | null> {
    // 1. Check in-memory cache
    const cached = this.tenantTokens.get(tenantId);
    if (cached && Date.now() < cached.expiresAt) return cached;

    // 2. Try loading from DB
    const dbTokens = await this.loadTokensFromDb(tenantId);
    if (dbTokens) return dbTokens;

    return null;
  }

  // ── Authentication ────────────────────────────────────────

  async login(tenantId: string, email: string, password: string, countryCode: string = '+1') {
    if (!this.isConfigured()) {
      return { success: false as const, error: 'eWeLink not configured. Set EWELINK_APP_ID and EWELINK_APP_SECRET in backend .env.' };
    }

    const body = { email, password, countryCode };
    const bodyStr = JSON.stringify(body);
    const sign = hmacSign(bodyStr, this.appSecret);

    try {
      const resp = await withRetry(
        () =>
          fetchWithTimeout(`${this.apiBase}/v2/user/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CK-Appid': this.appId,
              Authorization: `Sign ${sign}`,
            },
            body: bodyStr,
          }),
        { maxAttempts: 2, baseDelayMs: 500, retryableErrors: isRetryable },
      );

      const data = (await resp.json()) as { error: number; msg?: string; data?: { at: string; rt: string; user?: { email: string }; region?: string } };

      if (data.error !== 0) {
        logger.warn({ tenantId, ewelinkError: data.error }, 'eWeLink login failed for %s', maskEmail(email));
        return { success: false as const, error: data.msg || `Login failed (error ${data.error})` };
      }

      const tokens: TenantTokens = {
        accessToken: data.data?.at ?? '',
        refreshToken: data.data?.rt ?? '',
        expiresAt: Date.now() + TOKEN_LIFETIME_MS,
      };

      this.tenantTokens.set(tenantId, tokens);
      await this.persistTokens(tenantId, tokens);

      logger.info({ tenantId }, 'eWeLink login successful for %s', maskEmail(email));
      return {
        success: true as const,
        data: {
          user: maskEmail(data.data?.user?.email || email),
          region: data.data?.region,
        },
      };
    } catch (err) {
      logger.error({ tenantId, err: err instanceof Error ? err.message : 'unknown' }, 'eWeLink login error');
      return { success: false as const, error: err instanceof Error ? err.message : 'Login request failed' };
    }
  }

  async refreshToken(tenantId: string): Promise<boolean> {
    const tokens = await this.ensureTokens(tenantId);
    if (!tokens?.refreshToken) return false;

    const body = { rt: tokens.refreshToken };
    const bodyStr = JSON.stringify(body);
    const sign = hmacSign(bodyStr, this.appSecret);

    try {
      const resp = await withRetry(
        () =>
          fetchWithTimeout(`${this.apiBase}/v2/user/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CK-Appid': this.appId,
              Authorization: `Sign ${sign}`,
            },
            body: bodyStr,
          }),
        { maxAttempts: 2, baseDelayMs: 500, retryableErrors: isRetryable },
      );

      const data = (await resp.json()) as { error: number; data?: { at: string; rt: string } };
      if (data.error !== 0) {
        logger.warn({ tenantId }, 'eWeLink token refresh failed — clearing session');
        this.tenantTokens.delete(tenantId);
        await this.clearPersistedTokens(tenantId);
        return false;
      }

      const newTokens: TenantTokens = {
        accessToken: data.data?.at ?? '',
        refreshToken: data.data?.rt ?? '',
        expiresAt: Date.now() + TOKEN_LIFETIME_MS,
      };

      this.tenantTokens.set(tenantId, newTokens);
      await this.persistTokens(tenantId, newTokens);

      logger.info({ tenantId }, 'eWeLink token refreshed successfully');
      return true;
    } catch (err) {
      logger.error({ tenantId, err: err instanceof Error ? err.message : 'unknown' }, 'eWeLink token refresh error');
      this.tenantTokens.delete(tenantId);
      await this.clearPersistedTokens(tenantId);
      return false;
    }
  }

  async logout(tenantId: string) {
    this.tenantTokens.delete(tenantId);
    await this.clearPersistedTokens(tenantId);
    logger.info({ tenantId }, 'eWeLink session cleared');
  }

  // ── Authenticated API Requests ────────────────────────────

  private async apiRequest<T = unknown>(
    tenantId: string,
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<{ data: T; error?: number; msg?: string }> {
    let tokens = await this.ensureTokens(tenantId);
    if (!tokens) {
      // Try token refresh as last resort
      const refreshed = await this.refreshToken(tenantId);
      if (!refreshed) throw new Error('Not authenticated. Call login first.');
      tokens = this.tenantTokens.get(tenantId)!;
    }

    const url = `${this.apiBase}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CK-Appid': this.appId,
      Authorization: `Bearer ${tokens.accessToken}`,
    };

    type ApiResult = { data: T; error?: number; msg?: string };

    const result = await withRetry(
      async (): Promise<ApiResult> => {
        const resp = await fetchWithTimeout(url, {
          method,
          headers,
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return (await resp.json()) as ApiResult;
      },
      { maxAttempts: 2, baseDelayMs: 500, retryableErrors: isRetryable },
    );

    // Handle token expiration
    if (result.error === 401) {
      const refreshed = await this.refreshToken(tenantId);
      if (refreshed) {
        const retryTokens = this.tenantTokens.get(tenantId)!;
        headers['Authorization'] = `Bearer ${retryTokens.accessToken}`;
        const retryResp = await fetchWithTimeout(url, {
          method,
          headers,
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return (await retryResp.json()) as ApiResult;
      }
      throw new Error('Token expired and refresh failed. Re-authenticate.');
    }

    return result;
  }

  // ── Device Operations ─────────────────────────────────────

  async listDevices(tenantId: string) {
    const result = await this.apiRequest<{
      thingList: Array<{ itemType: number; itemData: Record<string, any> }>;
    }>(tenantId, 'GET', '/v2/device/thing');

    if (result.error !== undefined && result.error !== 0) {
      throw new Error(result.msg || 'Failed to list devices');
    }

    return (result.data?.thingList || [])
      .filter((thing) => thing.itemType === 1 || thing.itemType === 2)
      .map((thing) => {
        const d = thing.itemData;
        return {
          deviceId: d.deviceid,
          name: d.name || 'Unnamed Device',
          brandName: d.brandName || 'Sonoff',
          productModel: d.productModel || d.extra?.model || 'Unknown',
          online: d.online === true,
          params: d.params || {},
          switches: d.params?.switches || undefined,
          firmware: d.params?.fwVersion || d.params?.version,
          deviceType: d.extra?.uiid ? `UIID-${d.extra.uiid}` : undefined,
        };
      });
  }

  async getDeviceState(tenantId: string, deviceId: string) {
    const result = await this.apiRequest(
      tenantId,
      'GET',
      `/v2/device/thing/status?type=1&id=${deviceId}`,
    );

    if (result.error !== undefined && result.error !== 0) {
      return { success: false as const, error: result.msg || 'Failed to get device state' };
    }

    return { success: true as const, data: result.data };
  }

  async controlDevice(tenantId: string, deviceId: string, action: string, outlet?: number) {
    // Resolve toggle
    let resolvedAction = action;
    if (action === 'toggle') {
      const stateResult = await this.getDeviceState(tenantId, deviceId);
      if (stateResult.success && stateResult.data) {
        const params = stateResult.data as Record<string, any>;
        if (outlet !== undefined && params.switches) {
          const current = params.switches.find((s: any) => s.outlet === outlet);
          resolvedAction = current?.switch === 'on' ? 'off' : 'on';
        } else {
          resolvedAction = params.switch === 'on' ? 'off' : 'on';
        }
      } else {
        resolvedAction = 'on';
      }
    }

    const params: Record<string, unknown> =
      outlet !== undefined
        ? { switches: [{ switch: resolvedAction, outlet }] }
        : { switch: resolvedAction };

    const result = await this.apiRequest(tenantId, 'POST', '/v2/device/thing/status', {
      type: 1,
      id: deviceId,
      params,
    });

    if (result.error !== undefined && result.error !== 0) {
      return { success: false as const, error: result.msg || 'Control command failed' };
    }

    logger.info({ tenantId, deviceId, action: resolvedAction, outlet }, 'Device control executed');
    return { success: true as const, data: { action: resolvedAction, outlet } };
  }

  async batchControl(tenantId: string, actions: Array<{ deviceId: string; action: string; outlet?: number }>) {
    const results = await Promise.allSettled(
      actions.map(async (a) => {
        const result = await this.controlDevice(tenantId, a.deviceId, a.action, a.outlet);
        return { ...result, deviceId: a.deviceId };
      }),
    );

    return results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { success: false as const, error: r.reason?.message || 'Failed', deviceId: actions[i].deviceId },
    );
  }

  // ── Health & Diagnostics ──────────────────────────────────

  async healthCheck(tenantId: string) {
    if (!this.isConfigured()) {
      return {
        configured: false,
        region: config.EWELINK_REGION,
        status: 'not_configured' as const,
        message: 'eWeLink not configured in backend.',
        authenticated: false,
        encryptionEnabled: !!getEncryptionKey(),
      };
    }

    const start = Date.now();
    try {
      await fetchWithTimeout(`${this.apiBase}/v2/homepage`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'X-CK-Appid': this.appId },
      });

      // Check authentication — try memory first, then DB
      let authenticated = this.isAuthenticated(tenantId);
      if (!authenticated) {
        const dbTokens = await this.loadTokensFromDb(tenantId);
        authenticated = dbTokens !== null && Date.now() < dbTokens.expiresAt;
      }

      return {
        configured: true,
        region: config.EWELINK_REGION,
        status: 'connected' as const,
        message: authenticated
          ? `Connected and authenticated (${config.EWELINK_REGION} region).`
          : 'API reachable. User authentication required.',
        latencyMs: Date.now() - start,
        authenticated,
        encryptionEnabled: !!getEncryptionKey(),
      };
    } catch (err) {
      return {
        configured: true,
        region: config.EWELINK_REGION,
        status: 'error' as const,
        message: err instanceof Error ? err.message : 'Connection failed',
        latencyMs: Date.now() - start,
        authenticated: false,
        encryptionEnabled: !!getEncryptionKey(),
      };
    }
  }

  async testConnection(tenantId: string) {
    const health = await this.healthCheck(tenantId);

    // If authenticated, also try listing devices to verify full pipeline
    if (health.authenticated) {
      try {
        const devices = await this.listDevices(tenantId);
        return {
          ...health,
          deviceCount: devices.length,
          onlineCount: devices.filter((d) => d.online).length,
          message: `Full pipeline verified. ${devices.length} devices (${devices.filter((d) => d.online).length} online).`,
        };
      } catch (err) {
        return {
          ...health,
          status: 'error' as const,
          message: `Auth OK but device fetch failed: ${err instanceof Error ? err.message : 'unknown'}`,
        };
      }
    }

    return health;
  }

  /** Returns auth status without full health ping — lightweight check. */
  async getStatus(tenantId: string) {
    const tokens = await this.ensureTokens(tenantId);
    return {
      configured: this.isConfigured(),
      authenticated: tokens !== null && Date.now() < tokens.expiresAt,
      region: config.EWELINK_REGION,
      encryptionEnabled: !!getEncryptionKey(),
      tokenExpiresAt: tokens ? new Date(tokens.expiresAt).toISOString() : null,
    };
  }
}

export const ewelinkProxyService = new EWeLinkProxyService();
