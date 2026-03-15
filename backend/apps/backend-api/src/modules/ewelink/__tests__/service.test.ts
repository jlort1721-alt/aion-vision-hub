import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock external dependencies ──────────────────────────────────

// Global fetch mock
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock env config
vi.mock('../../../config/env.js', () => ({
  config: {
    EWELINK_APP_ID: 'test-app-id',
    EWELINK_APP_SECRET: 'test-app-secret-32chars-minimum!',
    EWELINK_REGION: 'us',
    CREDENTIAL_ENCRYPTION_KEY: 'test-encryption-key-32chars-min!',
  },
}));

// Mock DB — use inline fns to avoid hoisting issues
vi.mock('../../../db/client.js', () => {
  const selectLimitFn = vi.fn().mockResolvedValue([]);
  return {
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: selectLimitFn,
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    },
  };
});

vi.mock('../../../db/schema/index.js', () => ({
  integrations: {
    id: 'id',
    tenantId: 'tenant_id',
    type: 'type',
    config: 'config',
  },
}));

// Mock common-utils
vi.mock('@aion/common-utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
  encrypt: vi.fn((plaintext: string) => `enc:${plaintext}`),
  decrypt: vi.fn((ciphertext: string) => ciphertext.replace('enc:', '')),
  withRetry: vi.fn(async (fn: () => Promise<any>) => fn()),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: any, val: any) => ({ type: 'eq', val })),
  and: vi.fn((...conditions: any[]) => ({ type: 'and', conditions })),
}));

import { ewelinkProxyService } from '../service.js';

describe('EWeLinkProxyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Configuration ──────────────────────────────────────────

  describe('isConfigured', () => {
    it('returns true when APP_ID and APP_SECRET are set', () => {
      expect(ewelinkProxyService.isConfigured()).toBe(true);
    });
  });

  // ── Login ──────────────────────────────────────────────────

  describe('login', () => {
    it('sends HMAC-signed request to eWeLink API', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 0,
          data: {
            at: 'mock-access-token',
            rt: 'mock-refresh-token',
            user: { email: 'user@example.com' },
            region: 'us',
          },
        }),
      });

      const result = await ewelinkProxyService.login('tenant-1', 'user@example.com', 'pass123', '+1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('region', 'us');

      // Verify fetch was called with HMAC signature
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/v2/user/login');
      expect(options.headers).toHaveProperty('X-CK-Appid', 'test-app-id');
      expect(options.headers.Authorization).toMatch(/^Sign /);
    });

    it('masks email in log-safe response', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 0,
          data: {
            at: 'at-token',
            rt: 'rt-token',
            user: { email: 'longname@domain.com' },
            region: 'us',
          },
        }),
      });

      const result = await ewelinkProxyService.login('tenant-mask', 'longname@domain.com', 'pass', '+1');

      expect(result.success).toBe(true);
      expect(result.data?.user).toBe('l***@domain.com');
    });

    it('never returns tokens in the response payload', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 0,
          data: {
            at: 'secret-access-token',
            rt: 'secret-refresh-token',
            user: { email: 'user@example.com' },
            region: 'us',
          },
        }),
      });

      const result = await ewelinkProxyService.login('tenant-notokens', 'user@example.com', 'pass', '+1');

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('secret-access-token');
      expect(serialized).not.toContain('secret-refresh-token');
      expect(serialized).not.toContain('pass');
    });

    it('returns failure for invalid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 10004,
          msg: 'Invalid email or password',
        }),
      });

      const result = await ewelinkProxyService.login('tenant-bad', 'bad@example.com', 'wrong', '+1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email or password');
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));

      const result = await ewelinkProxyService.login('tenant-net', 'u@x.com', 'p', '+1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('fetch failed');
    });
  });

  // ── Token Refresh ──────────────────────────────────────────

  describe('refreshToken', () => {
    it('sends refresh request with HMAC signature', async () => {
      // Login first
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 0,
          data: { at: 'at-orig', rt: 'rt-orig', user: { email: 'u@x.com' }, region: 'us' },
        }),
      });
      await ewelinkProxyService.login('tenant-refresh', 'u@x.com', 'p', '+1');

      // Refresh
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 0,
          data: { at: 'at-new', rt: 'rt-new' },
        }),
      });

      const result = await ewelinkProxyService.refreshToken('tenant-refresh');
      expect(result).toBe(true);

      const [url, options] = mockFetch.mock.calls[1];
      expect(url).toContain('/v2/user/refresh');
      expect(options.headers.Authorization).toMatch(/^Sign /);
    });

    it('clears session on refresh failure', async () => {
      // Login
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 0,
          data: { at: 'at-1', rt: 'rt-1', user: { email: 'u@x.com' }, region: 'us' },
        }),
      });
      await ewelinkProxyService.login('tenant-refail', 'u@x.com', 'p', '+1');
      expect(ewelinkProxyService.isAuthenticated('tenant-refail')).toBe(true);

      // Refresh fails
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ error: 401, msg: 'Token expired' }),
      });

      const result = await ewelinkProxyService.refreshToken('tenant-refail');
      expect(result).toBe(false);
      expect(ewelinkProxyService.isAuthenticated('tenant-refail')).toBe(false);
    });
  });

  // ── Logout ─────────────────────────────────────────────────

  describe('logout', () => {
    it('clears in-memory authentication state', async () => {
      // Login
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 0,
          data: { at: 'at-1', rt: 'rt-1', user: { email: 'u@x.com' }, region: 'us' },
        }),
      });
      await ewelinkProxyService.login('tenant-logout', 'u@x.com', 'p', '+1');
      expect(ewelinkProxyService.isAuthenticated('tenant-logout')).toBe(true);

      await ewelinkProxyService.logout('tenant-logout');
      expect(ewelinkProxyService.isAuthenticated('tenant-logout')).toBe(false);
    });
  });

  // ── Device Operations ──────────────────────────────────────

  describe('listDevices', () => {
    it('returns filtered device list (excludes scenes)', async () => {
      // Login
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 0,
          data: { at: 'at-1', rt: 'rt-1', user: { email: 'u@x.com' }, region: 'us' },
        }),
      });
      await ewelinkProxyService.login('tenant-devices', 'u@x.com', 'p', '+1');

      // List devices
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 0,
          data: {
            thingList: [
              { itemType: 1, itemData: { deviceid: 'd1', name: 'Switch 1', online: true, params: { switch: 'off' } } },
              { itemType: 1, itemData: { deviceid: 'd2', name: 'Switch 2', online: false, params: { switch: 'on' } } },
              { itemType: 3, itemData: { deviceid: 'd3', name: 'Scene' } }, // Filtered out
            ],
          },
        }),
      });

      const devices = await ewelinkProxyService.listDevices('tenant-devices');
      expect(devices).toHaveLength(2);
      expect(devices[0]).toHaveProperty('deviceId', 'd1');
      expect(devices[1]).toHaveProperty('deviceId', 'd2');
    });
  });

  describe('controlDevice', () => {
    it('sends correct control payload for on/off', async () => {
      // Login
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 0,
          data: { at: 'at-1', rt: 'rt-1', user: { email: 'u@x.com' }, region: 'us' },
        }),
      });
      await ewelinkProxyService.login('tenant-ctrl', 'u@x.com', 'p', '+1');

      // Control
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ error: 0, data: {} }),
      });

      const result = await ewelinkProxyService.controlDevice('tenant-ctrl', 'd1', 'on');
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('action', 'on');
    });

    it('resolves toggle by querying current state', async () => {
      // Login
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 0,
          data: { at: 'at-1', rt: 'rt-1', user: { email: 'u@x.com' }, region: 'us' },
        }),
      });
      await ewelinkProxyService.login('tenant-toggle', 'u@x.com', 'p', '+1');

      // Get state (for toggle resolution) — current state is 'on'
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ error: 0, data: { switch: 'on' } }),
      });

      // Control (should resolve toggle to 'off')
      mockFetch.mockResolvedValueOnce({
        json: async () => ({ error: 0, data: {} }),
      });

      const result = await ewelinkProxyService.controlDevice('tenant-toggle', 'd1', 'toggle');
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('action', 'off');
    });
  });

  // ── Health Check ───────────────────────────────────────────

  describe('healthCheck', () => {
    it('reports encryptionEnabled status', async () => {
      mockFetch.mockResolvedValueOnce({ json: async () => ({}) });

      const result = await ewelinkProxyService.healthCheck('tenant-health');
      expect(result).toHaveProperty('encryptionEnabled', true);
    });

    it('reports error on connection failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await ewelinkProxyService.healthCheck('tenant-hfail');
      expect(result.status).toBe('error');
      expect(result.message).toContain('Connection refused');
    });
  });

  // ── Security: No Credential Leakage ────────────────────────

  describe('security: credential isolation', () => {
    it('login response never contains raw tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 0,
          data: {
            at: 'super-secret-access-token-xyz',
            rt: 'super-secret-refresh-token-xyz',
            user: { email: 'user@example.com' },
            region: 'us',
          },
        }),
      });

      const result = await ewelinkProxyService.login('tenant-sec', 'user@example.com', 'p', '+1');

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('super-secret-access-token-xyz');
      expect(serialized).not.toContain('super-secret-refresh-token-xyz');
    });

    it('healthCheck response never contains tokens or secrets', async () => {
      // Login first
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 0,
          data: { at: 'hidden-at', rt: 'hidden-rt', user: { email: 'u@x.com' }, region: 'us' },
        }),
      });
      await ewelinkProxyService.login('tenant-hcsec', 'u@x.com', 'p', '+1');

      // Health check
      mockFetch.mockResolvedValueOnce({ json: async () => ({}) });

      const result = await ewelinkProxyService.healthCheck('tenant-hcsec');
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('hidden-at');
      expect(serialized).not.toContain('hidden-rt');
      expect(serialized).not.toContain('test-app-secret');
    });

    it('getStatus response never contains tokens', async () => {
      // Login first
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: 0,
          data: { at: 'secret-at', rt: 'secret-rt', user: { email: 'u@x.com' }, region: 'us' },
        }),
      });
      await ewelinkProxyService.login('tenant-stsec', 'u@x.com', 'p', '+1');

      const result = await ewelinkProxyService.getStatus('tenant-stsec');
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('secret-at');
      expect(serialized).not.toContain('secret-rt');
      expect(result).toHaveProperty('authenticated', true);
      expect(result).toHaveProperty('tokenExpiresAt');
    });
  });
});
