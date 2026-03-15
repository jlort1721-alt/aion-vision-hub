import type { FastifyInstance } from 'fastify';

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/verify', async (request) => {
    const { sub, email, tenant_id, role, exp } = await request.jwtVerify<any>();
    return {
      success: true,
      data: { valid: true, userId: sub, tenantId: tenant_id, role, email, expiresAt: exp },
    };
  });

  app.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };
    if (!refreshToken) {
      reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'refreshToken required' } });
      return;
    }
    // In production, verify refresh token against store and issue new tokens
    const token = app.jwt.sign({ sub: request.userId, email: request.userEmail, tenant_id: request.tenantId, role: request.userRole });
    return { success: true, data: { accessToken: token, expiresIn: 86400 } };
  });
}
