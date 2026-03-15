import type { FastifyRequest, FastifyReply } from 'fastify';

const windowMs = 60_000; // 1 minute
const maxRequests = 120;
const store = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple in-memory rate limiter.
 * Production should use Redis or a distributed store.
 */
export async function rateLimitHook(request: FastifyRequest, reply: FastifyReply) {
  const key = request.ip;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    reply.code(429).send({
      error: 'Too many requests',
      retryAfterMs: entry.resetAt - now,
    });
  }
}

// Periodic cleanup to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000);
