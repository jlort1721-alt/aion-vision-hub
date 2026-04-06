import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { profiles, userRoles, refreshTokens } from '../../db/schema/index.js';
import { loginSchema, registerSchema, refreshTokenSchema, resetPasswordRequestSchema, resetPasswordConfirmSchema, approveUserParamsSchema } from './schemas.js';

const scryptAsync = promisify(scrypt);

/** Hash a password using scrypt with a random 32-byte salt. Returns "salt:hash" hex string. */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32);
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return salt.toString('hex') + ':' + derived.toString('hex');
}

/** Verify a password against a stored "salt:hash" scrypt hash. */
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const storedKey = Buffer.from(hashHex, 'hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(storedKey, derived);
}

/**
 * Default tenant ID — used for new registrations when no tenant is specified.
 * In a multi-tenant deployment this should come from an onboarding flow;
 * here we fall back to the first tenant in the database.
 */
let _defaultTenantId: string | null = null;
async function getDefaultTenantId(): Promise<string> {
  if (_defaultTenantId) return _defaultTenantId;
  const { tenants } = await import('../../db/schema/index.js');
  const [first] = await db.select({ id: tenants.id }).from(tenants).limit(1);
  if (!first) throw new Error('No tenant found in database — seed at least one tenant before registering users');
  _defaultTenantId = first.id;
  return _defaultTenantId;
}

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
  // ─── POST /auth/register ──────────────────────────────────────
  // Registration is restricted to authenticated admins (invite-only).
  app.post('/register', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    // Require authenticated user with admin role
    const callerRole = request.userRole;
    if (callerRole !== 'tenant_admin' && callerRole !== 'super_admin') {
      return reply.code(403).send({
        success: false,
        error: 'Registration is restricted to administrators. Contact your admin for an invitation.',
      });
    }

    const { email, password, fullName } = registerSchema.parse(request.body);

    // Check if email already exists
    const existing = await db.select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);

    if (existing.length > 0) {
      return reply.code(409).send({ success: false, error: 'Email already registered' });
    }

    const passwordHash = await hashPassword(password);
    const userId = randomUUID();
    const tenantId = await getDefaultTenantId();

    // SECURITY: New users get pending_approval status and viewer role
    await db.insert(profiles).values({
      id: userId,
      userId,
      tenantId,
      email,
      fullName,
      passwordHash,
      status: 'pending_approval',
      isActive: true,
    });

    await db.insert(userRoles).values({
      userId,
      tenantId,
      role: 'viewer',
    });

    return reply.send({
      success: true,
      data: {
        message: 'Registro exitoso. Un administrador revisará tu solicitud.',
        status: 'pending_approval',
        user: { id: userId, email, fullName },
      },
    });
  });

  // ─── POST /auth/login ─────────────────────────────────────────
  app.post('/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);

    const [user] = await db.select()
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);

    if (!user || !user.passwordHash) {
      return reply.code(401).send({ success: false, error: 'Invalid credentials' });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ success: false, error: 'Invalid credentials' });
    }

    // SECURITY: Check account status before issuing tokens
    if (user.status === 'pending_approval') {
      return reply.code(403).send({ success: false, error: 'Tu cuenta está pendiente de aprobación por un administrador.' });
    }
    if (user.status === 'suspended' || user.status === 'disabled') {
      return reply.code(403).send({ success: false, error: 'Tu cuenta ha sido deshabilitada. Contacta al administrador.' });
    }

    // Get role
    const [roleRec] = await db.select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, user.userId))
      .limit(1);

    const role = roleRec?.role || 'operator';

    // Generate tokens
    const token = app.jwt.sign(
      { sub: user.userId, email, role, tenant_id: user.tenantId },
      { expiresIn: '24h' },
    );

    const refreshToken = await createRefreshToken(user.userId, user.tenantId);

    // Update last login
    await db.update(profiles)
      .set({ lastLoginAt: new Date() })
      .where(eq(profiles.id, user.id));

    return reply.send({
      success: true,
      data: {
        accessToken: token,
        refreshToken,
        expiresIn: 86400,
        user: { id: user.userId, email: user.email, fullName: user.fullName, role, tenantId: user.tenantId },
      },
    });
  });

  // ─── POST /auth/verify ────────────────────────────────────────
  app.post('/verify', async (request) => {
    const { sub, email, tenant_id, role, exp } = await request.jwtVerify<{
      sub: string; email: string; tenant_id: string; role: string; exp: number;
    }>();
    return {
      success: true,
      data: { valid: true, userId: sub, tenantId: tenant_id, role, email, expiresAt: exp },
    };
  });

  // ─── POST /auth/refresh ───────────────────────────────────────
  app.post('/refresh', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
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

    // Look up user profile and role for fresh claims
    const [user] = await db.select()
      .from(profiles)
      .where(eq(profiles.userId, stored.userId))
      .limit(1);

    const [roleRec] = await db.select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, stored.userId))
      .limit(1);

    // Issue new pair (same family for reuse detection chain)
    const accessToken = app.jwt.sign({
      sub: stored.userId,
      email: user?.email ?? '',
      tenant_id: stored.tenantId,
      role: roleRec?.role ?? 'operator',
    });
    const newRefreshToken = await createRefreshToken(stored.userId, stored.tenantId, stored.family);

    return {
      success: true,
      data: { accessToken, refreshToken: newRefreshToken, expiresIn: 86400 },
    };
  });

  // ─── POST /auth/reset-password ────────────────────────────────
  app.post('/reset-password', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { email } = resetPasswordRequestSchema.parse(request.body);

    const [user] = await db.select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);

    // Don't reveal if email exists
    if (!user) {
      return reply.send({ success: true });
    }

    const resetToken = randomBytes(32).toString('hex');
    await db.update(profiles)
      .set({
        resetToken,
        resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      })
      .where(eq(profiles.id, user.id));

    // Note: Email sending for password reset is handled by the email service if RESEND_API_KEY is configured.
    // In development, the reset token is returned in the response for testing.
    return reply.send({
      success: true,
      ...(process.env.NODE_ENV !== 'production' ? { resetToken } : {}),
    });
  });

  // ─── POST /auth/reset-password/confirm ────────────────────────
  app.post('/reset-password/confirm', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
  }, async (request, reply) => {
    const { token, newPassword } = resetPasswordConfirmSchema.parse(request.body);

    const [user] = await db.select({ id: profiles.id })
      .from(profiles)
      .where(
        and(
          eq(profiles.resetToken, token),
          gt(profiles.resetTokenExpires, new Date()),
        ),
      )
      .limit(1);

    if (!user) {
      return reply.code(400).send({ success: false, error: 'Invalid or expired reset token' });
    }

    const passwordHash = await hashPassword(newPassword);
    await db.update(profiles)
      .set({ passwordHash, resetToken: null, resetTokenExpires: null })
      .where(eq(profiles.id, user.id));

    return reply.send({ success: true });
  });

  // ─── GET /auth/me ─────────────────────────────────────────────
  app.get('/me', async (request, reply) => {
    const [user] = await db.select()
      .from(profiles)
      .where(eq(profiles.userId, request.userId))
      .limit(1);

    const [roleRec] = await db.select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, request.userId))
      .limit(1);

    if (!user) {
      return reply.code(404).send({ success: false, error: 'User not found' });
    }

    return reply.send({
      success: true,
      data: {
        id: user.userId,
        email: user.email,
        fullName: user.fullName,
        role: roleRec?.role,
        tenantId: user.tenantId,
      },
    });
  });

  // ─── GET /auth/pending-users ──────────────────────────────────
  // SECURITY: Admin-only endpoint to list users awaiting approval
  app.get('/pending-users', {
    preHandler: [requireRole('tenant_admin', 'super_admin')],
  }, async (request, reply) => {
    const callerRole = request.userRole;
    if (callerRole !== 'tenant_admin' && callerRole !== 'super_admin') {
      return reply.code(403).send({ success: false, error: 'Admin access required' });
    }

    const pending = await db.select({
      id: profiles.userId,
      email: profiles.email,
      fullName: profiles.fullName,
      createdAt: profiles.createdAt,
    })
      .from(profiles)
      .where(and(
        eq(profiles.status, 'pending_approval'),
        eq(profiles.tenantId, request.tenantId),
      ));

    return reply.send({ success: true, data: pending });
  });

  // ─── POST /auth/approve-user/:id ─────────────────────────────
  // SECURITY: Admin-only endpoint to approve pending users
  app.post('/approve-user/:id', async (request, reply) => {
    const callerRole = request.userRole;
    if (callerRole !== 'tenant_admin' && callerRole !== 'super_admin') {
      return reply.code(403).send({ success: false, error: 'Admin access required' });
    }

    const { id } = approveUserParamsSchema.parse(request.params);

    const [user] = await db.select()
      .from(profiles)
      .where(and(eq(profiles.userId, id), eq(profiles.tenantId, request.tenantId)))
      .limit(1);

    if (!user) {
      return reply.code(404).send({ success: false, error: 'User not found' });
    }
    if (user.status !== 'pending_approval') {
      return reply.code(400).send({ success: false, error: `User status is '${user.status}', not 'pending_approval'` });
    }

    await db.update(profiles)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(profiles.userId, id));

    return reply.send({ success: true, data: { message: 'User approved', userId: id } });
  });

  // ─── POST /auth/reject-user/:id ──────────────────────────────
  // SECURITY: Admin-only endpoint to reject pending users
  app.post('/reject-user/:id', async (request, reply) => {
    const callerRole = request.userRole;
    if (callerRole !== 'tenant_admin' && callerRole !== 'super_admin') {
      return reply.code(403).send({ success: false, error: 'Admin access required' });
    }

    const { id } = approveUserParamsSchema.parse(request.params);

    const [user] = await db.select()
      .from(profiles)
      .where(and(eq(profiles.userId, id), eq(profiles.tenantId, request.tenantId)))
      .limit(1);

    if (!user) {
      return reply.code(404).send({ success: false, error: 'User not found' });
    }

    await db.update(profiles)
      .set({ status: 'disabled', updatedAt: new Date() })
      .where(eq(profiles.userId, id));

    return reply.send({ success: true, data: { message: 'User rejected', userId: id } });
  });
}
