import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { emergencyService } from './service.js';
import {
  createProtocolSchema,
  updateProtocolSchema,
  protocolFiltersSchema,
  createContactSchema,
  updateContactSchema,
  contactFiltersSchema,
  createActivationSchema,
  updateActivationSchema,
  activationFiltersSchema,
} from './schemas.js';
import type {
  CreateProtocolInput,
  UpdateProtocolInput,
  ProtocolFilters,
  CreateContactInput,
  UpdateContactInput,
  ContactFilters,
  CreateActivationInput,
  UpdateActivationInput,
  ActivationFilters,
} from './schemas.js';

export async function registerEmergencyRoutes(app: FastifyInstance) {
  // ══════════════════════════════════════════════════════════
  // PROTOCOLS
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: ProtocolFilters }>(
    '/protocols',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = protocolFiltersSchema.parse(request.query);
      const result = await emergencyService.listProtocols(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/protocols/:id',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await emergencyService.getProtocolById(request.params.id, request.tenantId);
      return reply.send({ success: true, data });
    },
  );

  app.post<{ Body: CreateProtocolInput }>(
    '/protocols',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createProtocolSchema.parse(request.body);
      const data = await emergencyService.createProtocol(body, request.tenantId);
      await request.audit('emergency_protocol.create', 'emergency_protocols', data.id, { name: data.name, type: data.type });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateProtocolInput }>(
    '/protocols/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateProtocolSchema.parse(request.body);
      const data = await emergencyService.updateProtocol(request.params.id, body, request.tenantId);
      await request.audit('emergency_protocol.update', 'emergency_protocols', data.id, { name: data.name });
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/protocols/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await emergencyService.deleteProtocol(request.params.id, request.tenantId);
      await request.audit('emergency_protocol.delete', 'emergency_protocols', request.params.id);
      return reply.code(204).send();
    },
  );

  // ══════════════════════════════════════════════════════════
  // CONTACTS
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: ContactFilters }>(
    '/contacts',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = contactFiltersSchema.parse(request.query);
      const result = await emergencyService.listContacts(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  app.post<{ Body: CreateContactInput }>(
    '/contacts',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createContactSchema.parse(request.body);
      const data = await emergencyService.createContact(body, request.tenantId);
      await request.audit('emergency_contact.create', 'emergency_contacts', data.id, { name: data.name, role: data.role });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateContactInput }>(
    '/contacts/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateContactSchema.parse(request.body);
      const data = await emergencyService.updateContact(request.params.id, body, request.tenantId);
      await request.audit('emergency_contact.update', 'emergency_contacts', data.id, { name: data.name });
      return reply.send({ success: true, data });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/contacts/:id',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      await emergencyService.deleteContact(request.params.id, request.tenantId);
      await request.audit('emergency_contact.delete', 'emergency_contacts', request.params.id);
      return reply.code(204).send();
    },
  );

  // ══════════════════════════════════════════════════════════
  // ACTIVATIONS
  // ══════════════════════════════════════════════════════════

  app.get<{ Querystring: ActivationFilters }>(
    '/activations',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const filters = activationFiltersSchema.parse(request.query);
      const result = await emergencyService.listActivations(request.tenantId, filters);
      return reply.send({ success: true, data: result.items, meta: result.meta });
    },
  );

  app.post<{ Body: CreateActivationInput }>(
    '/activations',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = createActivationSchema.parse(request.body);
      const data = await emergencyService.activateProtocol(body, request.tenantId, request.userId);
      await request.audit('emergency_activation.create', 'emergency_activations', data.id, { protocolId: data.protocolId, siteId: data.siteId });
      return reply.code(201).send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateActivationInput }>(
    '/activations/:id/resolve',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateActivationSchema.parse(request.body ?? {});
      const data = await emergencyService.resolveActivation(request.params.id, request.tenantId, request.userId, body.resolution);
      await request.audit('emergency_activation.resolve', 'emergency_activations', data.id);
      return reply.send({ success: true, data });
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateActivationInput }>(
    '/activations/:id/cancel',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const body = updateActivationSchema.parse(request.body ?? {});
      const data = await emergencyService.cancelActivation(request.params.id, request.tenantId, request.userId, body.resolution);
      await request.audit('emergency_activation.cancel', 'emergency_activations', data.id);
      return reply.send({ success: true, data });
    },
  );

  // ══════════════════════════════════════════════════════════
  // STATS
  // ══════════════════════════════════════════════════════════

  app.get(
    '/stats',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const data = await emergencyService.getActivationStats(request.tenantId);
      return reply.send({ success: true, data });
    },
  );
}
