import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { shiftService } from './service.js';
import {
  createShiftSchema,
  updateShiftSchema,
  shiftFiltersSchema,
  createShiftAssignmentSchema,
  updateShiftAssignmentSchema,
  shiftAssignmentFiltersSchema,
} from './schemas.js';
import type {
  CreateShiftInput,
  UpdateShiftInput,
  ShiftFilters,
  CreateShiftAssignmentInput,
  UpdateShiftAssignmentInput,
  ShiftAssignmentFilters,
} from './schemas.js';

export async function registerShiftRoutes(app: FastifyInstance) {
  // ══════════════════════════════════════════════════════════
  // SHIFTS
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: ShiftFilters }>(
    '/',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = shiftFiltersSchema.parse(request.query);
      const result = await shiftService.listShifts(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  app.post<{ Params: { id: string } }>(
    '/:id/report',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { id } = request.params;
      const report = await shiftService.generateShiftReport(request.tenantId, id);
      if (!report) return reply.code(404).send({ success: false, error: 'Turno no encontrado' });
      return { success: true, data: report };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await shiftService.getShiftById(request.params.id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: CreateShiftInput }>(
    '/',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createShiftSchema.parse(request.body);
      const data = await shiftService.createShift(body, request.tenantId);
      await request.audit('shift.create', 'shifts', data.id, { name: data.name });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateShiftInput }>(
    '/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateShiftSchema.parse(request.body);
      const data = await shiftService.updateShift(request.params.id, body, request.tenantId);
      await request.audit('shift.update', 'shifts', data.id, { name: data.name });
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await shiftService.deleteShift(request.params.id, request.tenantId);
      await request.audit('shift.delete', 'shifts', request.params.id);
      return reply.code(204).send();
    },
  );

  // ══════════════════════════════════════════════════════════
  // SHIFT ASSIGNMENTS
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: ShiftAssignmentFilters }>(
    '/assignments',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = shiftAssignmentFiltersSchema.parse(request.query);
      const result = await shiftService.listAssignments(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  app.get(
    '/assignments/stats',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await shiftService.getAssignmentStats(request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: CreateShiftAssignmentInput }>(
    '/assignments',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createShiftAssignmentSchema.parse(request.body);
      const data = await shiftService.createAssignment(body, request.tenantId);
      await request.audit('shift_assignment.create', 'shift_assignments', data.id, { shiftId: data.shiftId, userId: data.userId });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateShiftAssignmentInput }>(
    '/assignments/:id',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateShiftAssignmentSchema.parse(request.body);
      const data = await shiftService.updateAssignment(request.params.id, body, request.tenantId);
      await request.audit('shift_assignment.update', 'shift_assignments', data.id, { status: data.status });
      return reply.send({ success: true, data });
    },
  );
}
