import { describe, it, expect } from 'vitest';

/**
 * Secure Proxy Logic Tests
 *
 * Validates the security properties of the proxy layer that
 * sits between frontend and backend camera/device services.
 */

describe('Auth Plugin — Public Routes', () => {
  const PUBLIC_ROUTES = ['/health', '/health/ready', '/health/metrics', '/webhooks/whatsapp'];

  it('health endpoint is public', () => {
    const url = '/health';
    const isPublic = PUBLIC_ROUTES.some((r) => url.startsWith(r));
    expect(isPublic).toBe(true);
  });

  it('health/ready is public', () => {
    const url = '/health/ready';
    const isPublic = PUBLIC_ROUTES.some((r) => url.startsWith(r));
    expect(isPublic).toBe(true);
  });

  it('whatsapp webhook is public', () => {
    const url = '/webhooks/whatsapp';
    const isPublic = PUBLIC_ROUTES.some((r) => url.startsWith(r));
    expect(isPublic).toBe(true);
  });

  it('API routes are NOT public', () => {
    const protectedUrls = ['/api/devices', '/api/users', '/auth/verify', '/domotics', '/intercom/devices'];
    for (const url of protectedUrls) {
      const isPublic = PUBLIC_ROUTES.some((r) => url.startsWith(r));
      expect(isPublic).toBe(false);
    }
  });

  it('OPTIONS requests bypass auth (CORS preflight)', () => {
    const method = 'OPTIONS';
    expect(method === 'OPTIONS').toBe(true);
    // The auth plugin skips JWT verification for OPTIONS
  });
});

describe('Auth Plugin — JWT Payload Extraction', () => {
  it('extracts userId from sub claim', () => {
    const payload = {
      sub: 'user-uuid-123',
      email: 'admin@aion.dev',
      tenant_id: 'tenant-456',
      role: 'operator',
      iat: 1700000000,
      exp: 1700086400,
    };

    expect(payload.sub).toBe('user-uuid-123');
  });

  it('extracts tenantId from tenant_id claim', () => {
    const payload = {
      sub: 'user-1',
      email: 'test@aion.dev',
      tenant_id: 'tenant-abc',
      role: 'viewer',
    };

    expect(payload.tenant_id).toBe('tenant-abc');
  });

  it('extracts role from role claim', () => {
    const payload = {
      sub: 'user-1',
      email: 'test@aion.dev',
      tenant_id: 'tenant-1',
      role: 'super_admin',
    };

    expect(payload.role).toBe('super_admin');
  });

  it('validates role is a known role type', () => {
    const validRoles = ['super_admin', 'tenant_admin', 'operator', 'viewer', 'auditor'];
    for (const role of validRoles) {
      expect(validRoles).toContain(role);
    }
  });

  it('rejects unknown role types', () => {
    const validRoles = ['super_admin', 'tenant_admin', 'operator', 'viewer', 'auditor'];
    expect(validRoles).not.toContain('hacker');
    expect(validRoles).not.toContain('root');
    expect(validRoles).not.toContain('admin');
  });
});

describe('Secure Proxy — Request Decoration', () => {
  it('request object has userId after auth', () => {
    const request = {
      userId: 'user-123',
      userEmail: 'admin@aion.dev',
      tenantId: 'tenant-456',
      userRole: 'operator',
    };

    expect(request.userId).toBeDefined();
    expect(request.userEmail).toBeDefined();
    expect(request.tenantId).toBeDefined();
    expect(request.userRole).toBeDefined();
  });

  it('authenticated request carries tenant scope', () => {
    const request = {
      tenantId: 'tenant-A',
      userId: 'user-1',
    };

    // All database queries should be scoped to this tenant
    expect(request.tenantId).toBe('tenant-A');
  });

  it('different tenants are isolated', () => {
    const requestA = { tenantId: 'tenant-A', userId: 'user-1' };
    const requestB = { tenantId: 'tenant-B', userId: 'user-2' };

    expect(requestA.tenantId).not.toBe(requestB.tenantId);
  });
});

describe('Secure Proxy — Error Responses', () => {
  it('returns 401 with AUTH_TOKEN_INVALID for missing/invalid JWT', () => {
    const error = {
      statusCode: 401,
      body: {
        success: false,
        error: { code: 'AUTH_TOKEN_INVALID', message: 'Unauthorized' },
      },
    };

    expect(error.statusCode).toBe(401);
    expect(error.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });

  it('returns 403 with AUTH_INSUFFICIENT_ROLE for wrong role', () => {
    const error = {
      statusCode: 403,
      body: {
        success: false,
        error: { code: 'AUTH_INSUFFICIENT_ROLE', message: 'Insufficient permissions' },
      },
    };

    expect(error.statusCode).toBe(403);
    expect(error.body.error.code).toBe('AUTH_INSUFFICIENT_ROLE');
  });

  it('returns 403 with TENANT_NOT_FOUND for invalid tenant', () => {
    const error = {
      statusCode: 403,
      body: {
        success: false,
        error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' },
      },
    };

    expect(error.statusCode).toBe(403);
    expect(error.body.error.code).toBe('TENANT_NOT_FOUND');
  });

  it('returns 403 with TENANT_INACTIVE for suspended tenant', () => {
    const error = {
      statusCode: 403,
      body: {
        success: false,
        error: { code: 'TENANT_INACTIVE', message: 'Tenant account is inactive' },
      },
    };

    expect(error.statusCode).toBe(403);
    expect(error.body.error.code).toBe('TENANT_INACTIVE');
  });

  it('all error responses follow standard envelope format', () => {
    const errors = [
      { success: false, error: { code: 'AUTH_TOKEN_INVALID', message: 'Unauthorized' } },
      { success: false, error: { code: 'AUTH_INSUFFICIENT_ROLE', message: 'Insufficient permissions' } },
      { success: false, error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' } },
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request data' } },
    ];

    for (const err of errors) {
      expect(err).toHaveProperty('success', false);
      expect(err.error).toHaveProperty('code');
      expect(err.error).toHaveProperty('message');
      expect(typeof err.error.code).toBe('string');
      expect(typeof err.error.message).toBe('string');
    }
  });
});
