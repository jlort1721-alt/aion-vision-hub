import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { noteService } from './service.js';
import { createNoteSchema, updateNoteSchema, noteFiltersSchema } from './schemas.js';
import type { ApiResponse } from '@aion/shared-contracts';

export async function registerNoteRoutes(app: FastifyInstance) {
  // GET / — List notes
  app.get(
    '/',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const filters = noteFiltersSchema.parse(request.query);
      const { items, meta } = await noteService.list(request.tenantId, filters);
      return { success: true, data: items, meta } satisfies ApiResponse;
    },
  );

  // GET /:id — Get single note
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const note = await noteService.getById(request.params.id, request.tenantId);
      return { success: true, data: note } satisfies ApiResponse;
    },
  );

  // POST / — Create note
  app.post(
    '/',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const input = createNoteSchema.parse(request.body);
      const note = await noteService.create(
        input,
        request.tenantId,
        request.userId,
        request.userEmail || 'Operador',
      );
      return reply.code(201).send({ success: true, data: note } satisfies ApiResponse);
    },
  );

  // PATCH /:id — Update note
  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const input = updateNoteSchema.parse(request.body);
      const note = await noteService.update(request.params.id, input, request.tenantId);
      return { success: true, data: note } satisfies ApiResponse;
    },
  );

  // DELETE /:id — Delete note
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await noteService.delete(request.params.id, request.tenantId);
      return reply.code(204).send();
    },
  );
}
