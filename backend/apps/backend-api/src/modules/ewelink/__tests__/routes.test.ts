import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// ── Mock auth plugin — requireRole returns a no-op preHandler ───
vi.mock('../../../plugins/auth.js', () => ({
  requireRole: vi.fn().mockImplementation(() => async () => {}),
}));

// ── Mock the eWeLink proxy service singleton ────────────────────
vi.mock('../service.js', () => ({
  ewelinkProxyService: {
    healthCheck: vi.fn().mockResolvedValue({
      configured: true,
      region: 'us',
      status: 'connected',
      message: 'OK',
      authenticated: true,
      encryptionEnabled: true,
    }),
    testConnection: vi.fn().mockResolvedValue({
      configured: true,
      region: 'us',
      status: 'connected',
      message: 'Full pipeline verified. 3 devices (2 online).',
      authenticated: true,
      encryptionEnabled: true,
      deviceCount: 3,
      onlineCount: 2,
    }),
    getStatus: vi.fn().mockResolvedValue({
      configured: true,
      authenticated: true,
      region: 'us',
      encryptionEnabled: true,
      tokenExpiresAt: '2026-04-08T00:00:00.000Z',
    }),
    login: vi.fn().mockResolvedValue({
      success: true,
      data: { user: 'u***@example.com', region: 'us' },
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    listDevices: vi.fn().mockResolvedValue([
      {
        deviceId: 'dev-001',
        name: 'Test Switch',
        brandName: 'Sonoff',
        productModel: 'BASIC R3',
        online: true,
        params: { switch: 'off' },
      },
    ]),
    getDeviceState: vi.fn().mockResolvedValue({
      success: true,
      data: { switch: 'off', voltage: '220.5' },
    }),
    controlDevice: vi.fn().mockResolvedValue({
      success: true,
      data: { action: 'on', outlet: undefined },
    }),
    batchControl: vi.fn().mockResolvedValue([
      { deviceId: 'dev-001', success: true },
    ]),
  },
}));

// Mock shared-contracts
vi.mock('@aion/shared-contracts', () => ({
  AppError: class AppError extends Error {
    constructor(public code: string, message: string, public statusCode: number) {
      super(message);
    }
  },
  ErrorCodes: {},
}));

// Mock logger
vi.mock('@aion/common-utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

import { ZodError } from 'zod';
import { registerEWeLinkRoutes } from '../routes.js';

describe('eWeLink routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    // Register error handler to properly handle Zod validation errors
    app.setErrorHandler((error, _request, reply) => {
      if (error instanceof ZodError) {
        reply.code(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request data' },
        });
        return;
      }
      reply.code(500).send({ success: false, error: { message: error instanceof Error ? error.message : 'Unknown' } });
    });

    // Decorate request with tenantId and audit to simulate auth middleware
    app.decorateRequest('tenantId', 'tenant-456');
    app.decorateRequest('audit', null as any);
    app.addHook('preHandler', async (request) => {
      (request as any).tenantId = 'tenant-456';
      (request as any).audit = vi.fn().mockResolvedValue(undefined);
    });

    await app.register(registerEWeLinkRoutes, { prefix: '/ewelink' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /ewelink/health ────────────────────────────────────
  describe('GET /ewelink/health', () => {
    it('returns 200 with health status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/ewelink/health',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('configured', true);
      expect(body.data).toHaveProperty('status', 'connected');
      expect(body.data).toHaveProperty('encryptionEnabled', true);
    });
  });

  // ── GET /ewelink/test-connection ────────────────────────────
  describe('GET /ewelink/test-connection', () => {
    it('returns 200 with full pipeline test result', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/ewelink/test-connection',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('deviceCount', 3);
      expect(body.data).toHaveProperty('onlineCount', 2);
    });
  });

  // ── GET /ewelink/status ─────────────────────────────────────
  describe('GET /ewelink/status', () => {
    it('returns lightweight auth status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/ewelink/status',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('authenticated', true);
      expect(body.data).toHaveProperty('encryptionEnabled', true);
      expect(body.data).toHaveProperty('tokenExpiresAt');
    });
  });

  // ── POST /ewelink/login ────────────────────────────────────
  describe('POST /ewelink/login', () => {
    it('returns success on valid login', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/ewelink/login',
        payload: {
          email: 'user@example.com',
          password: 'password123',
          countryCode: '+1',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
    });

    it('rejects invalid email format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/ewelink/login',
        payload: {
          email: 'not-an-email',
          password: 'password123',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects empty password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/ewelink/login',
        payload: {
          email: 'user@example.com',
          password: '',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('does not leak tokens in response', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/ewelink/login',
        payload: {
          email: 'user@example.com',
          password: 'password123',
          countryCode: '+1',
        },
      });

      const body = res.json();
      const bodyStr = JSON.stringify(body);
      expect(bodyStr).not.toContain('accessToken');
      expect(bodyStr).not.toContain('refreshToken');
      expect(bodyStr).not.toContain('EWELINK_APP_SECRET');
      expect(bodyStr).not.toContain('EWELINK_APP_ID');
    });
  });

  // ── POST /ewelink/logout ───────────────────────────────────
  describe('POST /ewelink/logout', () => {
    it('returns success', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/ewelink/logout',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
    });
  });

  // ── GET /ewelink/devices ───────────────────────────────────
  describe('GET /ewelink/devices', () => {
    it('returns device list wrapped in data envelope', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/ewelink/devices',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('devices');
      expect(body.data).toHaveProperty('total', 1);
      expect(Array.isArray(body.data.devices)).toBe(true);
      expect(body.data.devices[0]).toHaveProperty('deviceId', 'dev-001');
    });
  });

  // ── GET /ewelink/devices/:deviceId/state ────────────────────
  describe('GET /ewelink/devices/:deviceId/state', () => {
    it('returns device state', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/ewelink/devices/dev-001/state',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
    });
  });

  // ── POST /ewelink/devices/control ──────────────────────────
  describe('POST /ewelink/devices/control', () => {
    it('controls a device successfully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/ewelink/devices/control',
        payload: {
          deviceId: 'dev-001',
          action: 'on',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
    });

    it('rejects invalid action', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/ewelink/devices/control',
        payload: {
          deviceId: 'dev-001',
          action: 'invalid',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects missing deviceId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/ewelink/devices/control',
        payload: {
          action: 'on',
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /ewelink/devices/batch ────────────────────────────
  describe('POST /ewelink/devices/batch', () => {
    it('executes batch control', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/ewelink/devices/batch',
        payload: {
          actions: [
            { deviceId: 'dev-001', action: 'on' },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('rejects empty actions array', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/ewelink/devices/batch',
        payload: {
          actions: [],
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
