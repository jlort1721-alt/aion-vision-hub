import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { UserRole } from '@aion/shared-contracts';

export interface JWTPayload {
  sub: string;
  email: string;
  tenant_id: string;
  role: UserRole;
  iat: number;
  exp: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
    tenantId: string;
    userRole: UserRole;
  }
}

const PUBLIC_ROUTES = ['/health', '/health/ready', '/health/metrics', '/webhooks/whatsapp', '/ws'];

/**
 * Check if a request URL matches a public route.
 * Uses exact match or prefix + separator to prevent path-prefix bypass
 * (e.g. '/health-admin' must NOT match '/health').
 */
function isPublicRoute(url: string): boolean {
  // Strip query string for matching
  const path = url.split('?')[0];
  return PUBLIC_ROUTES.some((r) => path === r || path.startsWith(r + '/'));
}

async function authPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isPublicRoute(request.url)) return;
    if (request.method === 'OPTIONS') return;

    try {
      const payload = await request.jwtVerify<JWTPayload>();
      request.userId = payload.sub;
      request.userEmail = payload.email;
      request.tenantId = payload.tenant_id;
      request.userRole = payload.role;
    } catch {
      return reply.code(401).send({ success: false, error: { code: 'AUTH_TOKEN_INVALID', message: 'Unauthorized' } });
    }
  });
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(request.userRole)) {
      reply.code(403).send({
        success: false,
        error: { code: 'AUTH_INSUFFICIENT_ROLE', message: 'Insufficient permissions' },
      });
    }
  };
}

export default fp(authPlugin, { name: 'auth' });
