import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { accessControlService } from './service.js';
import {
  createPersonSchema, updatePersonSchema, personFiltersSchema,
  createVehicleSchema, updateVehicleSchema, vehicleFiltersSchema,
  createAccessLogSchema, accessLogFiltersSchema,
} from './schemas.js';
import type { CreatePersonInput, UpdatePersonInput, PersonFilters, CreateVehicleInput, UpdateVehicleInput, VehicleFilters, CreateAccessLogInput, AccessLogFilters } from './schemas.js';

export async function registerAccessControlRoutes(app: FastifyInstance) {
  // ── People ──
  app.get<{ Querystring: PersonFilters }>(
    '/people', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = personFiltersSchema.parse(request.query);
      const data = await accessControlService.listPeople(request.tenantId, filters);
      return reply.send({ success: true, data });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/people/:id', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await accessControlService.getPersonById(request.params.id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: CreatePersonInput }>(
    '/people', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createPersonSchema.parse(request.body);
      const data = await accessControlService.createPerson(body, request.tenantId);
      await request.audit('access.person.create', 'access_people', data.id, { fullName: data.fullName });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdatePersonInput }>(
    '/people/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updatePersonSchema.parse(request.body);
      const data = await accessControlService.updatePerson(request.params.id, body, request.tenantId);
      await request.audit('access.person.update', 'access_people', data.id, body);
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/people/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await accessControlService.deletePerson(request.params.id, request.tenantId);
      await request.audit('access.person.delete', 'access_people', request.params.id);
      return reply.code(204).send();
    },
  );

  // ── Vehicles ──
  app.get<{ Querystring: VehicleFilters }>(
    '/vehicles', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = vehicleFiltersSchema.parse(request.query);
      const data = await accessControlService.listVehicles(request.tenantId, filters);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: CreateVehicleInput }>(
    '/vehicles', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createVehicleSchema.parse(request.body);
      const data = await accessControlService.createVehicle(body, request.tenantId);
      await request.audit('access.vehicle.create', 'access_vehicles', data.id, { plate: data.plate });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateVehicleInput }>(
    '/vehicles/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateVehicleSchema.parse(request.body);
      const data = await accessControlService.updateVehicle(request.params.id, body, request.tenantId);
      await request.audit('access.vehicle.update', 'access_vehicles', data.id, body);
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/vehicles/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await accessControlService.deleteVehicle(request.params.id, request.tenantId);
      await request.audit('access.vehicle.delete', 'access_vehicles', request.params.id);
      return reply.code(204).send();
    },
  );

  // ── Access Logs ──
  app.get<{ Querystring: AccessLogFilters }>(
    '/logs', { preHandler: [requireRole('auditor', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = accessLogFiltersSchema.parse(request.query);
      const data = await accessControlService.listLogs(request.tenantId, filters);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: CreateAccessLogInput }>(
    '/logs', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createAccessLogSchema.parse(request.body);
      const data = await accessControlService.createLog(body, request.userId, request.tenantId);
      await request.audit('access.log.create', 'access_logs', data.id, { direction: data.direction });
      return reply.code(201).send({ success: true, data });
    },
  );
}
