import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { siteService } from './service.js';
import { createSiteSchema, updateSiteSchema } from './schemas.js';
import type { CreateSiteInput, UpdateSiteInput } from './schemas.js';

export async function registerSiteRoutes(app: FastifyInstance) {
  // ── GET / — List sites for tenant ─────────────────────────
  app.get(
    '/',
    async (request, reply) => {
      const data = await siteService.list(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /:id — Get site by ID ────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const data = await siteService.getById(request.params.id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── POST / — Create site ─────────────────────────────────
  app.post<{ Body: CreateSiteInput }>(
    '/',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createSiteSchema.parse(request.body);
      const data = await siteService.create(body, request.tenantId);

      await request.audit('site.create', 'sites', data.id, { name: data.name });

      return reply.code(201).send({ success: true, data });
    },
  );

  // ── PATCH /:id — Update site ─────────────────────────────
  app.patch<{ Params: { id: string }; Body: UpdateSiteInput }>(
    '/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateSiteSchema.parse(request.body);
      const data = await siteService.update(request.params.id, body, request.tenantId);

      await request.audit('site.update', 'sites', data.id, body);

      return reply.send({ success: true, data });
    },
  );

  // ── DELETE /:id — Delete site (admin only) ────────────────
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await siteService.delete(request.params.id, request.tenantId);

      await request.audit('site.delete', 'sites', request.params.id);

      return reply.code(204).send();
    },
  );

  // ── GET /:id/devices — List devices for this site ────────
  app.get<{ Params: { id: string } }>(
    '/:id/devices',
    async (request, reply) => {
      const data = await siteService.listDevices(request.params.id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );
}
