import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { createHash, randomUUID } from 'crypto';

// ── Hoisted mocks ─────────────────────────────────────────────────

const { mockLimitFn, mockInsertValues, mockUpdateSet } = vi.hoisted(() => ({
  mockLimitFn: vi.fn().mockResolvedValue([]),
  mockInsertValues: vi.fn().mockResolvedValue(undefined),
  mockUpdateSet: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('../db/client.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: (...args: unknown[]) => mockLimitFn(...args),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({ values: mockInsertValues }),
    update: vi.fn().mockReturnValue({ set: mockUpdateSet }),
  },
}));

vi.mock('../db/schema/index.js', () => ({
  profiles: { id: 'id', userId: 'user_id', tenantId: 'tenant_id' },
  userRoles: { userId: 'user_id', role: 'role' },
  refreshTokens: { id: 'id', tokenHash: 'token_hash', family: 'family', revokedAt: 'revoked_at' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ op: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  isNull: vi.fn((a: unknown) => ({ op: 'isNull', a })),
}));

vi.mock('../lib/supabase.js', () => ({
  verifySupabaseToken: vi.fn().mockResolvedValue({ id: 'user-123', email: 'admin@aion.dev' }),
}));

vi.mock('../plugins/auth.js', () => ({
  requireRole: vi.fn().mockImplementation(() => async () => {}),
  default: {
    [Symbol.for('skip-override')]: true,
    [Symbol.for('fastify.display-name')]: 'auth',
  },
}));

vi.mock('@aion/common-utils', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
}));

vi.mock('@aion/shared-contracts', () => ({
  AppError: class AppError extends Error {
    constructor(public code: string, message: string, public statusCode: number) {
      super(message);
    }
  },
  ErrorCodes: {},
}));

import { registerAuthRoutes } from '../modules/auth/routes.js';
import { registerErrorHandler } from '../middleware/error-handler.js';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('Auth Token Refresh Endpoint', () => {
  let app: FastifyInstance;
  const mockJwtSign = vi.fn().mockReturnValue('new-access-token-xyz');

  beforeAll(async () => {
    app = Fastify({ logger: false });
    registerErrorHandler(app);

    app.decorate('jwt', { sign: mockJwtSign, verify: vi.fn() } as any);
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockLimitFn.mockResolvedValue([]);
    mockInsertValues.mockResolvedValue(undefined);
    mockUpdateSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  });

  describe('POST /auth/refresh', () => {
    it('returns new token pair with valid refresh token', async () => {
      const rawToken = randomUUID();
      const storedToken = {
        id: 'tok-1',
        userId: 'user-123',
        tenantId: 'tenant-456',
        tokenHash: hashToken(rawToken),
        family: randomUUID(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: null,
        createdAt: new Date(),
      };

      mockLimitFn.mockResolvedValue([storedToken]);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: rawToken },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('success', true);
      expect(body.data).toHaveProperty('accessToken');
      expect(body.data).toHaveProperty('refreshToken');
      expect(body.data).toHaveProperty('expiresIn', 86400);
    });

    it('rejects when refreshToken is missing (Zod validation)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body).toHaveProperty('success', false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 when refresh token is not in DB', async () => {
      mockLimitFn.mockResolvedValue([]);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: randomUUID() },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.error.code).toBe('AUTH_REFRESH_INVALID');
    });

    it('detects reuse and revokes family', async () => {
      const storedToken = {
        id: 'tok-2',
        userId: 'user-123',
        tenantId: 'tenant-456',
        tokenHash: 'hash',
        family: randomUUID(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: new Date(), // Already revoked — reuse!
        createdAt: new Date(),
      };

      mockLimitFn.mockResolvedValue([storedToken]);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: randomUUID() },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.error.code).toBe('AUTH_REFRESH_REUSED');
    });

    it('returns 401 when token is expired', async () => {
      const storedToken = {
        id: 'tok-3',
        userId: 'user-123',
        tenantId: 'tenant-456',
        tokenHash: 'hash',
        family: randomUUID(),
        expiresAt: new Date(Date.now() - 1000), // Expired
        revokedAt: null,
        createdAt: new Date(),
      };

      mockLimitFn.mockResolvedValue([storedToken]);

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: randomUUID() },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.error.code).toBe('AUTH_REFRESH_EXPIRED');
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
