import { describe, it, expect, vi } from 'vitest';
import { requireRole } from '../plugins/auth.js';

/**
 * Critical security test: requireRole() MUST return after sending 403.
 * Before the fix, the handler continued executing after the 403 was sent,
 * allowing authenticated users to bypass role checks.
 */
describe('requireRole — return after 403 (auth bypass fix)', () => {
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

  it('returns a value when role does not match (prevents handler execution)', async () => {
    const middleware = requireRole('super_admin' as any);
    const request = createMockRequest('viewer');
    const reply = createMockReply();

    const result = await middleware(request, reply);

    // The middleware MUST return the reply so Fastify stops the chain
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(result).toBeDefined();
  });

  it('does NOT return a value when role matches (allows handler execution)', async () => {
    const middleware = requireRole('super_admin' as any);
    const request = createMockRequest('super_admin');
    const reply = createMockReply();

    const result = await middleware(request, reply);

    expect(reply.code).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('simulates full preHandler chain — handler must NOT execute on 403', async () => {
    const middleware = requireRole('super_admin' as any);
    const request = createMockRequest('viewer');
    const reply = createMockReply();

    let handlerExecuted = false;

    // Simulate Fastify preHandler behavior: if middleware returns, handler is skipped
    const middlewareResult = await middleware(request, reply);
    if (middlewareResult === undefined) {
      handlerExecuted = true;
    }

    expect(handlerExecuted).toBe(false);
    expect(reply.code).toHaveBeenCalledWith(403);
  });
});
