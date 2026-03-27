import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { evidenceService } from './service.js';
import {
  listEvidenceSchema,
  createEvidenceSchema,
  captureSnapshotSchema,
  deleteEvidenceParamsSchema,
} from './schemas.js';
import type {
  ListEvidenceInput,
  CreateEvidenceInput,
  CaptureSnapshotInput,
  DeleteEvidenceParams,
} from './schemas.js';

export async function registerEvidenceRoutes(app: FastifyInstance) {
  // ── GET / — List evidence for an incident ────────────────
  app.get<{ Querystring: ListEvidenceInput }>(
    '/',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const query = listEvidenceSchema.parse(request.query);
      const data = await evidenceService.list(query.incident_id, request.tenantId);

      return reply.send({ success: true, data });
    },
  );

  // ── POST / — Create evidence record ──────────────────────
  app.post<{ Body: CreateEvidenceInput }>(
    '/',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createEvidenceSchema.parse(request.body);
      const data = await evidenceService.create(body, request.tenantId, request.userId);

      await request.audit('evidence.create', 'evidence', data.id, {
        incidentId: body.incident_id,
        type: body.type,
      });

      return reply.code(201).send({ success: true, data });
    },
  );

  // ── POST /capture — Capture snapshot from device ─────────
  app.post<{ Body: CaptureSnapshotInput }>(
    '/capture',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = captureSnapshotSchema.parse(request.body);
      const data = await evidenceService.captureSnapshot(body, request.tenantId, request.userId);

      await request.audit('evidence.capture', 'evidence', data.id, {
        incidentId: body.incident_id,
        deviceId: body.device_id,
      });

      return reply.code(201).send({ success: true, data });
    },
  );

  // ── DELETE /:id — Delete evidence record ─────────────────
  app.delete<{ Params: DeleteEvidenceParams }>(
    '/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { id } = deleteEvidenceParamsSchema.parse(request.params);
      const data = await evidenceService.delete(id, request.tenantId);

      await request.audit('evidence.delete', 'evidence', data.id, {
        incidentId: data.incidentId,
        type: data.type,
      });

      return reply.send({ success: true, data });
    },
  );
}
