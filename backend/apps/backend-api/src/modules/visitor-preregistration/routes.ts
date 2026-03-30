/**
 * Visitor Pre-registration Routes
 *
 * Endpoints for managing visitor pre-registrations:
 * residents pre-register visitors so they get automatic access on arrival.
 */
import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { visitorPreregistrationService } from '../../services/visitor-preregistration.js';
import type { CreatePreregistrationInput, AccessType } from '../../services/visitor-preregistration.js';

// ── Route param/query types ──────────────────────────────────────────────────

interface ListQuery {
  site_id?: string;
  unit?: string;
  status?: string;
}

interface IdParams {
  id: string;
}

interface ValidateBody {
  visitor_name: string;
  visitor_document: string;
  site_id: string;
}

interface ValidatePlateBody {
  plate: string;
  site_id: string;
}

interface UpdateBody {
  visitor_name?: string;
  visitor_document?: string | null;
  visitor_plate?: string | null;
  valid_from?: string;
  valid_until?: string | null;
  access_type?: AccessType;
}

// ── Route registration ───────────────────────────────────────────────────────

export async function registerVisitorPreregistrationRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════
  // ── GET /pre-registrations — List pre-registrations ────────
  // ═══════════════════════════════════════════════════════════

  app.get<{ Querystring: ListQuery }>(
    '/',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { site_id, unit, status } = request.query;

      // If status filter is provided and is not 'active', we still list
      // active ones by default (the service only returns active).
      // For broader queries, caller can extend later.
      const data = await visitorPreregistrationService.list(site_id, unit);

      // Client-side status filter (service returns active by default)
      const filtered = status
        ? data.filter((r) => r.status === status)
        : data;

      return reply.send({ success: true, data: filtered });
    },
  );

  // ═══════════════════════════════════════════════════════════
  // ── POST /pre-registrations — Create pre-registration ──────
  // ═══════════════════════════════════════════════════════════

  app.post<{ Body: CreatePreregistrationInput }>(
    '/',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = request.body;

      if (!body.site_id || !body.resident_id || !body.unit_number || !body.visitor_name) {
        return reply.code(400).send({
          success: false,
          error: 'site_id, resident_id, unit_number, and visitor_name are required',
        });
      }

      const data = await visitorPreregistrationService.create(body);

      await request.audit('preregistration.create', 'visitor_preregistrations', data.id, {
        visitor_name: data.visitor_name,
        unit_number: data.unit_number,
        access_type: data.access_type,
      });

      return reply.code(201).send({ success: true, data });
    },
  );

  // ═══════════════════════════════════════════════════════════
  // ── GET /pre-registrations/:id — Get by ID ─────────────────
  // ═══════════════════════════════════════════════════════════

  app.get<{ Params: IdParams }>(
    '/:id',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await visitorPreregistrationService.getById(request.params.id);

      if (!data) {
        return reply.code(404).send({
          success: false,
          error: 'Pre-registration not found',
        });
      }

      return reply.send({ success: true, data });
    },
  );

  // ═══════════════════════════════════════════════════════════
  // ── PATCH /pre-registrations/:id — Update pre-registration ─
  // ═══════════════════════════════════════════════════════════

  app.patch<{ Params: IdParams; Body: UpdateBody }>(
    '/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await visitorPreregistrationService.update(request.params.id, request.body);

      await request.audit('preregistration.update', 'visitor_preregistrations', data.id, {
        ...request.body,
      });

      return reply.send({ success: true, data });
    },
  );

  // ═══════════════════════════════════════════════════════════
  // ── DELETE /pre-registrations/:id — Cancel pre-registration ─
  // ═══════════════════════════════════════════════════════════

  app.delete<{ Params: IdParams }>(
    '/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await visitorPreregistrationService.cancel(request.params.id);

      await request.audit('preregistration.cancel', 'visitor_preregistrations', data.id, {
        visitor_name: data.visitor_name,
      });

      return reply.send({ success: true, data });
    },
  );

  // ═══════════════════════════════════════════════════════════
  // ── POST /pre-registrations/validate — Validate visitor ────
  // ═══════════════════════════════════════════════════════════

  app.post<{ Body: ValidateBody }>(
    '/validate',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { visitor_name, visitor_document, site_id } = request.body;

      if (!visitor_name || !visitor_document || !site_id) {
        return reply.code(400).send({
          success: false,
          error: 'visitor_name, visitor_document, and site_id are required',
        });
      }

      const result = await visitorPreregistrationService.validate(
        visitor_name,
        visitor_document,
        site_id,
      );

      // If valid and one_time, mark as used
      if (result.valid && result.preregistration?.access_type === 'one_time') {
        await visitorPreregistrationService.markUsed(result.preregistration.id);
      }

      await request.audit('preregistration.validate', 'visitor_preregistrations', result.preregistration?.id, {
        visitor_name,
        visitor_document,
        valid: result.valid,
      });

      return reply.send({ success: true, data: result });
    },
  );

  // ═══════════════════════════════════════════════════════════
  // ── POST /pre-registrations/validate-plate — Validate plate ─
  // ═══════════════════════════════════════════════════════════

  app.post<{ Body: ValidatePlateBody }>(
    '/validate-plate',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { plate, site_id } = request.body;

      if (!plate || !site_id) {
        return reply.code(400).send({
          success: false,
          error: 'plate and site_id are required',
        });
      }

      const result = await visitorPreregistrationService.validatePlate(plate, site_id);

      // If valid and one_time, mark as used
      if (result.valid && result.preregistration?.access_type === 'one_time') {
        await visitorPreregistrationService.markUsed(result.preregistration.id);
      }

      await request.audit('preregistration.validate_plate', 'visitor_preregistrations', result.preregistration?.id, {
        plate,
        valid: result.valid,
      });

      return reply.send({ success: true, data: result });
    },
  );
}
