import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { eq } from 'drizzle-orm';
import type { UserRole } from '@aion/shared-contracts';
import { db } from '../db/client.js';
import { profiles, userRoles } from '../db/schema/index.js';
import { verifySupabaseToken } from '../lib/supabase.js';

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

const PUBLIC_ROUTES = ['/health', '/health/ready', '/health/metrics', '/webhooks/whatsapp', '/ws', '/push/vapid-public-key', '/auth/login'];

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

/**
 * Look up user profile and role from the database by auth user ID.
 */
async function getUserContext(authUserId: string): Promise<{ tenantId: string; role: UserRole } | null> {
  const [profile] = await db
    .select({ id: profiles.id, userId: profiles.userId, tenantId: profiles.tenantId })
    .from(profiles)
    .where(eq(profiles.userId, authUserId))
    .limit(1);

  if (!profile) return null;

  const [roleRecord] = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, authUserId))
    .limit(1);

  return {
    tenantId: profile.tenantId,
    role: (roleRecord?.role || 'viewer') as UserRole,
  };
}

async function authPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isPublicRoute(request.url)) return;
    if (request.method === 'OPTIONS') return;

    // Try backend JWT first
    try {
      const payload = await request.jwtVerify<JWTPayload>();
      request.userId = payload.sub;
      request.userEmail = payload.email;
      request.tenantId = payload.tenant_id;
      request.userRole = payload.role;
      return;
    } catch {
      // Fall through to Supabase token verification
    }

    // Try Supabase token
    const authHeader = request.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return reply.code(401).send({ success: false, error: { code: 'AUTH_TOKEN_INVALID', message: 'Unauthorized' } });
    }

    const supabaseUser = await verifySupabaseToken(token);
    if (!supabaseUser) {
      return reply.code(401).send({ success: false, error: { code: 'AUTH_TOKEN_INVALID', message: 'Unauthorized' } });
    }

    const ctx = await getUserContext(supabaseUser.id);
    if (!ctx) {
      return reply.code(401).send({ success: false, error: { code: 'AUTH_USER_NOT_FOUND', message: 'User profile not found' } });
    }

    request.userId = supabaseUser.id;
    request.userEmail = supabaseUser.email;
    request.tenantId = ctx.tenantId;
    request.userRole = ctx.role;
  });
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(request.userRole)) {
      return reply.code(403).send({
        success: false,
        error: { code: 'AUTH_INSUFFICIENT_ROLE', message: 'Insufficient permissions' },
      });
    }
  };
}

export default fp(authPlugin, { name: 'auth' });
