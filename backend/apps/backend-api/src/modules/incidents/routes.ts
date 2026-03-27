import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { incidentService } from './service.js';
import { broadcast } from '../../plugins/websocket.js';
import {
  createIncidentSchema,
  updateIncidentSchema,
  addEvidenceSchema,
  addCommentSchema,
  incidentFiltersSchema,
} from './schemas.js';
import type {
  CreateIncidentInput,
  UpdateIncidentInput,
  AddEvidenceInput,
  AddCommentInput,
  IncidentFilters,
} from './schemas.js';

export async function registerIncidentRoutes(app: FastifyInstance) {
  // ── GET / — List incidents with filters + pagination ──────
  app.get<{ Querystring: IncidentFilters }>(
    '/',
    async (request, reply) => {
      const filters = incidentFiltersSchema.parse(request.query);
      const result = await incidentService.list(request.tenantId, filters);

      return reply.send({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    },
  );

  // ── GET /:id — Get incident by ID ────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const data = await incidentService.getById(request.params.id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── POST / — Create incident ─────────────────────────────
  app.post<{ Body: CreateIncidentInput }>(
    '/',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createIncidentSchema.parse(request.body);
      const data = await incidentService.create(body, request.tenantId, request.userId);

      broadcast(request.tenantId, 'incidents', { type: 'incident.created', incident: data });

      await request.audit('incident.create', 'incidents', data.id, {
        title: data.title,
        priority: data.priority,
      });

      return reply.code(201).send({ success: true, data });
    },
  );

  // ── PATCH /:id — Update incident ─────────────────────────
  app.patch<{ Params: { id: string }; Body: UpdateIncidentInput }>(
    '/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateIncidentSchema.parse(request.body);
      const data = await incidentService.update(request.params.id, body, request.tenantId);

      broadcast(request.tenantId, 'incidents', { type: 'incident.updated', incident: data });

      await request.audit('incident.update', 'incidents', data.id, body);

      return reply.send({ success: true, data });
    },
  );

  // ── POST /:id/evidence — Add evidence to incident ────────
  app.post<{ Params: { id: string }; Body: AddEvidenceInput }>(
    '/:id/evidence',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = addEvidenceSchema.parse(request.body);
      const data = await incidentService.addEvidence(
        request.params.id,
        body,
        request.userId,
        request.tenantId,
      );

      broadcast(request.tenantId, 'incidents', {
        type: 'incident.evidence_added',
        incidentId: request.params.id,
        evidence: data,
      });

      await request.audit('incident.addEvidence', 'incidents', data.id, {
        evidenceType: body.type,
      });

      return reply.code(201).send({ success: true, data });
    },
  );

  // ── POST /:id/comments — Add comment to incident ─────────
  app.post<{ Params: { id: string }; Body: AddCommentInput }>(
    '/:id/comments',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = addCommentSchema.parse(request.body);
      const data = await incidentService.addComment(
        request.params.id,
        body,
        request.userId,
        request.userEmail,
        request.tenantId,
      );

      broadcast(request.tenantId, 'incidents', {
        type: 'incident.comment_added',
        incidentId: request.params.id,
        comment: data,
      });

      await request.audit('incident.addComment', 'incidents', data.id);

      return reply.code(201).send({ success: true, data });
    },
  );
}
