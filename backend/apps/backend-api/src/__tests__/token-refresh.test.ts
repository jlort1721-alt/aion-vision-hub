import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('../plugins/auth.js', () => ({
  requireRole: vi.fn().mockImplementation(() => async () => {}),
  default: {
    [Symbol.for('skip-override')]: true,
    [Symbol.for('fastify.display-name')]: 'auth',
  },
}));

vi.mock('@aion/shared-contracts', () => ({
  AppError: class AppError extends Error {
    constructor(public code: string, message: string, public statusCode: number) {
      super(message);
    }
  },
  ErrorCodes: {},
}));

vi.mock('@aion/common-utils', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

import { registerAuthRoutes } from '../modules/auth/routes.js';

describe('Auth Token Refresh Endpoint', () => {
  let app: FastifyInstance;
  const mockJwtSign = vi.fn().mockReturnValue('new-access-token-xyz');

  beforeAll(async () => {
    app = Fastify({ logger: false });

    // Simulate JWT plugin
    app.decorate('jwt', { sign: mockJwtSign, verify: vi.fn() } as any);

    // Decorate request with auth properties
    app.decorateRequest('userId', 'user-123');
    app.decorateRequest('userEmail', 'admin@aion.dev');
    app.decorateRequest('tenantId', 'tenant-456');
    app.decorateRequest('userRole', 'operator');
    app.decorateRequest('jwtVerify', null as any);

    app.addHook('preHandler', async (request) => {
      (request as any).userId = 'user-123';
      (request as any).userEmail = 'admin@aion.dev';
      (request as any).tenantId = 'tenant-456';
      (request as any).userRole = 'operator';
      (request as any).jwtVerify = vi.fn().mockResolvedValue({
        sub: 'user-123',
        email: 'admin@aion.dev',
        tenant_id: 'tenant-456',
        role: 'operator',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
    });

    await app.register(registerAuthRoutes, { prefix: '/auth' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/refresh', () => {
    it('returns new access token with valid refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: 'valid-refresh-token-123' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('accessToken');
      expect(body.data).toHaveProperty('expiresIn', 86400);
    });

    it('signs JWT with correct payload fields', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: 'valid-token' },
      });

      expect(mockJwtSign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-123',
          email: 'admin@aion.dev',
          tenant_id: 'tenant-456',
          role: 'operator',
        })
      );
    });

    it('rejects when refreshToken is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body).toHaveProperty('success', false);
      expect(body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(body.error).toHaveProperty('message', 'refreshToken required');
    });

    it('does not include refresh token in response', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: 'valid-token' },
      });

      const body = res.json();
      const bodyStr = JSON.stringify(body);
      expect(bodyStr).not.toContain('refreshToken');
    });
  });

  describe('POST /auth/verify', () => {
    it('returns user info for valid JWT', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/verify',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('valid', true);
      expect(body.data).toHaveProperty('userId', 'user-123');
      expect(body.data).toHaveProperty('tenantId', 'tenant-456');
      expect(body.data).toHaveProperty('role', 'operator');
      expect(body.data).toHaveProperty('email', 'admin@aion.dev');
    });

    it('returns expiration timestamp', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/verify',
      });

      const body = res.json();
      expect(body.data).toHaveProperty('expiresAt');
      expect(typeof body.data.expiresAt).toBe('number');
    });
  });
});
