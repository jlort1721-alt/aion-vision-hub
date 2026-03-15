import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { visitorService } from './service.js';
import {
  createVisitorSchema,
  updateVisitorSchema,
  visitorFiltersSchema,
  createVisitorPassSchema,
  visitorPassFiltersSchema,
  validateQRSchema,
} from './schemas.js';
import type {
  CreateVisitorInput,
  UpdateVisitorInput,
  VisitorFilters,
  CreateVisitorPassInput,
  VisitorPassFilters,
  ValidateQRInput,
} from './schemas.js';

export async function registerVisitorRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════════════════
  // VISITORS
  // ═══════════════════════════════════════════════════════════

  // ── GET / — List visitors with filters + pagination ───────
  app.get<{ Querystring: VisitorFilters }>(
    '/',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = visitorFiltersSchema.parse(request.query);
      const result = await visitorService.list(request.tenantId, filters);

      return reply.send({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    },
  );

  // ── GET /:id — Get visitor by ID ──────────────────────────
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await visitorService.getById(request.params.id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  // ── POST / — Create visitor ───────────────────────────────
  app.post<{ Body: CreateVisitorInput }>(
    '/',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createVisitorSchema.parse(request.body);
      const data = await visitorService.create(body, request.tenantId);

      await request.audit('visitor.create', 'visitors', data.id, {
        fullName: data.fullName,
        company: data.company,
      });

      return reply.code(201).send({ success: true, data });
    },
  );

  // ── PATCH /:id — Update visitor ───────────────────────────
  app.patch<{ Params: { id: string }; Body: UpdateVisitorInput }>(
    '/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateVisitorSchema.parse(request.body);
      const data = await visitorService.update(request.params.id, body, request.tenantId);

      await request.audit('visitor.update', 'visitors', data.id, body);

      return reply.send({ success: true, data });
    },
  );

  // ── DELETE /:id — Delete visitor ──────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await visitorService.delete(request.params.id, request.tenantId);

      await request.audit('visitor.delete', 'visitors', data.id, {
        fullName: data.fullName,
      });

      return reply.send({ success: true, data });
    },
  );

  // ═══════════════════════════════════════════════════════════
  // VISITOR PASSES
  // ═══════════════════════════════════════════════════════════

  // ── GET /passes — List visitor passes ─────────────────────
  app.get<{ Querystring: VisitorPassFilters }>(
    '/passes',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = visitorPassFiltersSchema.parse(request.query);
      const result = await visitorService.listPasses(request.tenantId, filters);

      return reply.send({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    },
  );

  // ── POST /passes — Create visitor pass ────────────────────
  app.post<{ Body: CreateVisitorPassInput }>(
    '/passes',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createVisitorPassSchema.parse(request.body);
      const data = await visitorService.createPass(body, request.tenantId, request.userId);

      await request.audit('visitor.pass.create', 'visitor_passes', data.id, {
        visitorId: data.visitorId,
        passType: data.passType,
      });

      return reply.code(201).send({ success: true, data });
    },
  );

  // ── PATCH /passes/:id/revoke — Revoke visitor pass ────────
  app.patch<{ Params: { id: string } }>(
    '/passes/:id/revoke',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await visitorService.revokePass(request.params.id, request.tenantId);

      await request.audit('visitor.pass.revoke', 'visitor_passes', data.id, {
        visitorId: data.visitorId,
      });

      return reply.send({ success: true, data });
    },
  );

  // ═══════════════════════════════════════════════════════════
  // QR VALIDATION
  // ═══════════════════════════════════════════════════════════

  // ── POST /validate-qr — Validate a QR token ──────────────
  app.post<{ Body: ValidateQRInput }>(
    '/validate-qr',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = validateQRSchema.parse(request.body);
      const data = await visitorService.validateQR(body.qrToken, request.tenantId);

      return reply.send({ success: true, data });
    },
  );

  // ═══════════════════════════════════════════════════════════
  // CHECK-IN / CHECK-OUT
  // ═══════════════════════════════════════════════════════════

  // ── PATCH /passes/:id/check-in — Check in visitor ─────────
  app.patch<{ Params: { id: string } }>(
    '/passes/:id/check-in',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await visitorService.checkInVisitor(
        request.params.id,
        request.tenantId,
        request.userId,
      );

      await request.audit('visitor.checkIn', 'visitor_passes', data.id, {
        visitorId: data.visitorId,
      });

      return reply.send({ success: true, data });
    },
  );

  // ── PATCH /passes/:id/check-out — Check out visitor ───────
  app.patch<{ Params: { id: string } }>(
    '/passes/:id/check-out',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await visitorService.checkOutVisitor(
        request.params.id,
        request.tenantId,
      );

      await request.audit('visitor.checkOut', 'visitor_passes', data.id, {
        visitorId: data.visitorId,
      });

      return reply.send({ success: true, data });
    },
  );

  // ═══════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════

  // ── GET /stats — Visitor statistics ───────────────────────
  app.get(
    '/stats',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await visitorService.getVisitorStats(request.tenantId);
      return reply.send({ success: true, data });
    },
  );
}
