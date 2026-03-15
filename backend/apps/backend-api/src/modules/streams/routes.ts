import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { streamService } from './service.js';
import { registerStreamSchema, streamUrlSchema } from './schemas.js';
import type { RegisterStreamInput, StreamUrlInput } from './schemas.js';

export async function registerStreamRoutes(app: FastifyInstance) {
  // ── GET / — List registered streams for tenant ────────────
  app.get(
    '/',
    async (request, reply) => {
      const data = streamService.list(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── POST /register — Register stream profiles from gateway ─
  app.post<{ Body: RegisterStreamInput }>(
    '/register',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = registerStreamSchema.parse(request.body);
      const data = streamService.register(body, request.tenantId);

      await request.audit('stream.register', 'streams', body.deviceId, {
        gatewayId: body.gatewayId,
        profiles: body.profiles.length,
      });

      return reply.code(201).send({ success: true, data });
    },
  );

  // ── GET /:id/url — Get signed/mediated stream URL ────────
  app.get<{ Params: { id: string }; Querystring: StreamUrlInput }>(
    '/:id/url',
    async (request, reply) => {
      const params = streamUrlSchema.parse(request.query);
      const data = streamService.getStreamUrl(
        request.params.id,
        params,
        request.tenantId,
      );

      return reply.send({ success: true, data });
    },
  );
}
