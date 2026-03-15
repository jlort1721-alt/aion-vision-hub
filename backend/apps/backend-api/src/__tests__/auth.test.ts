import { describe, it, expect, vi } from 'vitest';
import { requireRole } from '../plugins/auth.js';

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

describe('requireRole', () => {
  it('allows request when user has the required role', async () => {
    const middleware = requireRole('super_admin' as any);
    const request = createMockRequest('super_admin');
    const reply = createMockReply();

    await middleware(request, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('rejects request when user lacks the required role', async () => {
    const middleware = requireRole('super_admin' as any);
    const request = createMockRequest('viewer');
    const reply = createMockReply();

    await middleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'AUTH_INSUFFICIENT_ROLE',
        message: 'Insufficient permissions',
      },
    });
  });

  it('allows request when user has one of multiple allowed roles', async () => {
    const middleware = requireRole('operator' as any, 'super_admin' as any);
    const request = createMockRequest('operator');
    const reply = createMockReply();

    await middleware(request, reply);

    expect(reply.code).not.toHaveBeenCalled();
  });

  it('rejects when user role does not match any allowed role', async () => {
    const middleware = requireRole('super_admin' as any, 'tenant_admin' as any);
    const request = createMockRequest('viewer');
    const reply = createMockReply();

    await middleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
  });

  it('rejects auditor when only operator is required', async () => {
    const middleware = requireRole('operator' as any);
    const request = createMockRequest('auditor');
    const reply = createMockReply();

    await middleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
  });
});
