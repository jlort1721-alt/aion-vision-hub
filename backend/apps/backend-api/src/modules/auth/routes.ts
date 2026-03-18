import type { FastifyInstance } from 'fastify';
import { createHash, randomUUID } from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { profiles, userRoles, refreshTokens } from '../../db/schema/index.js';
import { verifySupabaseToken } from '../../lib/supabase.js';
import { loginSchema, refreshTokenSchema } from './schemas.js';

/** SHA-256 hash a token for safe storage. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Generate a refresh token, persist the hash, and return the raw token. */
async function createRefreshToken(userId: string, tenantId: string, family?: string): Promise<string> {
  const raw = randomUUID();
  const tokenHash = hashToken(raw);
  const familyId = family ?? randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(refreshTokens).values({
    userId,
    tenantId,
    tokenHash,
    family: familyId,
    expiresAt,
  });

  return raw;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  // Exchange a Supabase access token for a backend JWT + refresh token
  app.post('/login', async (request, reply) => {
    const { supabaseToken } = loginSchema.parse(request.body);

    const supaUser = await verifySupabaseToken(supabaseToken);
    if (!supaUser) {
      return reply.code(401).send({ success: false, error: { code: 'AUTH_TOKEN_INVALID', message: 'Invalid Supabase token' } });
    }

    // Look up profile and role
    const [profile] = await db.select({ id: profiles.id, userId: profiles.userId, tenantId: profiles.tenantId })
      .from(profiles).where(eq(profiles.userId, supaUser.id)).limit(1);

    if (!profile) {
      return reply.code(404).send({ success: false, error: { code: 'AUTH_USER_NOT_FOUND', message: 'User profile not found' } });
    }

    const [roleRec] = await db.select({ role: userRoles.role })
      .from(userRoles).where(eq(userRoles.userId, supaUser.id)).limit(1);

    const role = roleRec?.role || 'viewer';
    const accessToken = app.jwt.sign({ sub: supaUser.id, email: supaUser.email, tenant_id: profile.tenantId, role });
    const refreshToken = await createRefreshToken(supaUser.id, profile.tenantId);

    return {
      success: true,
      data: { accessToken, refreshToken, expiresIn: 86400, role, tenantId: profile.tenantId },
    };
  });

  app.post('/verify', async (request) => {
    const { sub, email, tenant_id, role, exp } = await request.jwtVerify<{ sub: string; email: string; tenant_id: string; role: string; exp: number }>();
    return {
      success: true,
      data: { valid: true, userId: sub, tenantId: tenant_id, role, email, expiresAt: exp },
    };
  });

  // Refresh token rotation: validate old token, revoke it, issue new pair
  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = refreshTokenSchema.parse(request.body);
    const tokenHash = hashToken(refreshToken);

    // Find the refresh token in DB
    const [stored] = await db.select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    if (!stored) {
      return reply.code(401).send({ success: false, error: { code: 'AUTH_REFRESH_INVALID', message: 'Invalid refresh token' } });
    }

    // Reuse detection: if this token was already revoked, the family is compromised
    if (stored.revokedAt) {
      // Revoke ALL tokens in this family (breach detected)
      await db.update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.family, stored.family), isNull(refreshTokens.revokedAt)));
      return reply.code(401).send({ success: false, error: { code: 'AUTH_REFRESH_REUSED', message: 'Refresh token reuse detected — all sessions revoked' } });
    }

    // Check expiration
    if (stored.expiresAt < new Date()) {
      return reply.code(401).send({ success: false, error: { code: 'AUTH_REFRESH_EXPIRED', message: 'Refresh token expired' } });
    }

    // Revoke the current token
    await db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, stored.id));

    // Issue new pair (same family for reuse detection chain)
    const accessToken = app.jwt.sign({
      sub: stored.userId,
      email: request.userEmail,
      tenant_id: stored.tenantId,
      role: request.userRole,
    });
    const newRefreshToken = await createRefreshToken(stored.userId, stored.tenantId, stored.family);

    return {
      success: true,
      data: { accessToken, refreshToken: newRefreshToken, expiresIn: 86400 },
    };
  });
}
