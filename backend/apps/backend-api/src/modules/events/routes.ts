import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { eventService } from './service.js';
import {
  createEventSchema,
  assignEventSchema,
  updateEventStatusSchema,
  eventFiltersSchema,
} from './schemas.js';
import type {
  CreateEventInput,
  AssignEventInput,
  UpdateEventStatusInput,
  EventFilters,
} from './schemas.js';

export async function registerEventRoutes(app: FastifyInstance) {
  // ── GET / — List events with filters + pagination ─────────
  app.get<{ Querystring: EventFilters }>(
    '/',
    async (request, reply) => {
      const filters = eventFiltersSchema.parse(request.query);
      const result = await eventService.list(request.tenantId, filters);

      return reply.send({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    },
  );

  // ── GET /stats — Event statistics by severity & status ────
  // NOTE: Defined before /:id to avoid route collision.
  app.get(
    '/stats',
    async (request, reply) => {
      const data = await eventService.getStats(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── POST / — Create event (usually from gateway) ─────────
  app.post<{ Body: CreateEventInput }>(
    '/',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createEventSchema.parse(request.body);
      const data = await eventService.create(body, request.tenantId);

      await request.audit('event.create', 'events', data.id, {
        type: data.type,
        severity: data.severity,
        deviceId: data.deviceId,
      });

      return reply.code(201).send({ success: true, data });
    },
  );

  // ── PATCH /:id/assign — Assign event to user ─────────────
  app.patch<{ Params: { id: string }; Body: AssignEventInput }>(
    '/:id/assign',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = assignEventSchema.parse(request.body);
      const data = await eventService.assign(request.params.id, body, request.tenantId);

      await request.audit('event.assign', 'events', data.id, {
        assignedTo: body.assignedTo,
      });

      return reply.send({ success: true, data });
    },
  );

  // ── PATCH /:id/status — Change event status ──────────────
  app.patch<{ Params: { id: string }; Body: UpdateEventStatusInput }>(
    '/:id/status',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateEventStatusSchema.parse(request.body);
      const data = await eventService.updateStatus(
        request.params.id,
        body,
        request.tenantId,
      );

      await request.audit('event.status', 'events', data.id, {
        status: body.status,
      });

      return reply.send({ success: true, data });
    },
  );
}
