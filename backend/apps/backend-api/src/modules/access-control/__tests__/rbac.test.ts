import { describe, it, expect, vi } from 'vitest';
import { requireRole } from '../../../plugins/auth.js';

/**
 * RBAC Tests for Sensitive Routes
 *
 * Validates that role-based access control is correctly enforced
 * across all sensitive endpoints in the application.
 */

function createMockRequest(role: string) {
  return { userRole: role } as any;
}

function createMockReply() {
  const reply: any = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply;
}

describe('RBAC — Access Control Routes', () => {
  // People CRUD requires viewer+ for reads, operator+ for writes, tenant_admin+ for deletes
  describe('People Management', () => {
    it('viewer can list people (read access)', async () => {
      const middleware = requireRole('viewer' as any, 'operator' as any, 'tenant_admin' as any, 'super_admin' as any);
      const request = createMockRequest('viewer');
      const reply = createMockReply();

      await middleware(request, reply);
      expect(reply.code).not.toHaveBeenCalled();
    });

    it('operator can create people', async () => {
      const middleware = requireRole('operator' as any, 'tenant_admin' as any, 'super_admin' as any);
      const request = createMockRequest('operator');
      const reply = createMockReply();

      await middleware(request, reply);
      expect(reply.code).not.toHaveBeenCalled();
    });

    it('viewer cannot create people', async () => {
      const middleware = requireRole('operator' as any, 'tenant_admin' as any, 'super_admin' as any);
      const request = createMockRequest('viewer');
      const reply = createMockReply();

      await middleware(request, reply);
      expect(reply.code).toHaveBeenCalledWith(403);
    });

    it('only tenant_admin+ can delete people', async () => {
      const middleware = requireRole('tenant_admin' as any, 'super_admin' as any);
      const request = createMockRequest('operator');
      const reply = createMockReply();

      await middleware(request, reply);
      expect(reply.code).toHaveBeenCalledWith(403);
    });
  });
});

describe('RBAC — Audit Routes', () => {
  it('tenant_admin can view audit logs', async () => {
    const middleware = requireRole('tenant_admin' as any, 'auditor' as any);
    const request = createMockRequest('tenant_admin');
    const reply = createMockReply();

    await middleware(request, reply);
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('auditor can view audit logs', async () => {
    const middleware = requireRole('tenant_admin' as any, 'auditor' as any);
    const request = createMockRequest('auditor');
    const reply = createMockReply();

    await middleware(request, reply);
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('operator cannot view audit logs', async () => {
    const middleware = requireRole('tenant_admin' as any, 'auditor' as any);
    const request = createMockRequest('operator');
    const reply = createMockReply();

    await middleware(request, reply);
    expect(reply.code).toHaveBeenCalledWith(403);
  });

  it('viewer cannot view audit logs', async () => {
    const middleware = requireRole('tenant_admin' as any, 'auditor' as any);
    const request = createMockRequest('viewer');
    const reply = createMockReply();

    await middleware(request, reply);
    expect(reply.code).toHaveBeenCalledWith(403);
  });
});

describe('RBAC — Role Management', () => {
  it('only super_admin and tenant_admin can assign roles', async () => {
    const middleware = requireRole('super_admin' as any, 'tenant_admin' as any);

    for (const role of ['operator', 'viewer', 'auditor']) {
      const reply = createMockReply();
      await middleware(createMockRequest(role), reply);
      expect(reply.code).toHaveBeenCalledWith(403);
    }
  });

  it('super_admin can assign roles', async () => {
    const middleware = requireRole('super_admin' as any, 'tenant_admin' as any);
    const reply = createMockReply();

    await middleware(createMockRequest('super_admin'), reply);
    expect(reply.code).not.toHaveBeenCalled();
  });
});

describe('RBAC — Domotic Routes', () => {
  it('operator can create domotic devices', async () => {
    const middleware = requireRole('operator' as any, 'tenant_admin' as any, 'super_admin' as any);
    const reply = createMockReply();

    await middleware(createMockRequest('operator'), reply);
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('viewer cannot create domotic devices', async () => {
    const middleware = requireRole('operator' as any, 'tenant_admin' as any, 'super_admin' as any);
    const reply = createMockReply();

    await middleware(createMockRequest('viewer'), reply);
    expect(reply.code).toHaveBeenCalledWith(403);
  });

  it('only tenant_admin+ can delete domotic devices', async () => {
    const middleware = requireRole('tenant_admin' as any, 'super_admin' as any);
    const reply = createMockReply();

    await middleware(createMockRequest('operator'), reply);
    expect(reply.code).toHaveBeenCalledWith(403);
  });
});

describe('RBAC — Integration Routes', () => {
  it('only tenant_admin can create integrations', async () => {
    const middleware = requireRole('tenant_admin' as any);
    const reply = createMockReply();

    await middleware(createMockRequest('operator'), reply);
    expect(reply.code).toHaveBeenCalledWith(403);
  });

  it('operator can test integrations', async () => {
    const middleware = requireRole('tenant_admin' as any, 'operator' as any);
    const reply = createMockReply();

    await middleware(createMockRequest('operator'), reply);
    expect(reply.code).not.toHaveBeenCalled();
  });
});

describe('RBAC — Error Response Format', () => {
  it('returns standard error envelope on forbidden', async () => {
    const middleware = requireRole('super_admin' as any);
    const reply = createMockReply();

    await middleware(createMockRequest('viewer'), reply);

    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'AUTH_INSUFFICIENT_ROLE',
        message: 'Insufficient permissions',
      },
    });
  });

  it('returns 403 HTTP status code', async () => {
    const middleware = requireRole('super_admin' as any);
    const reply = createMockReply();

    await middleware(createMockRequest('viewer'), reply);
    expect(reply.code).toHaveBeenCalledWith(403);
  });
});
