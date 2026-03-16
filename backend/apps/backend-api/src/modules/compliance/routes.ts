import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { complianceService } from './service.js';
import { CreateTemplateInput, UpdateTemplateInput, TemplateFilters, CreateRetentionPolicyInput, UpdateRetentionPolicyInput, RetentionPolicyFilters } from './schemas.js';

export async function registerComplianceRoutes(app: FastifyInstance) {
  // ── Templates ───────────────────────────────────────────

  app.get('/templates', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest) => {
    const filters = TemplateFilters.parse(request.query);
    const result = await complianceService.listTemplates(request.tenantId, filters);
    return { success: true, data: result.items, meta: result.meta };
  });

  app.post('/templates', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateTemplateInput.parse(request.body);
    const result = await complianceService.createTemplate(request.tenantId, request.userId, data);
    request.audit('create', 'compliance_template', result.id, { name: data.name, type: data.type });
    return reply.code(201).send({ success: true, data: result });
  });

  app.get('/templates/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await complianceService.getTemplate(request.tenantId, id);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    return { success: true, data: result };
  });

  app.patch('/templates/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = UpdateTemplateInput.parse(request.body);
    const result = await complianceService.updateTemplate(request.tenantId, id, data);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    request.audit('update', 'compliance_template', result.id, data);
    return { success: true, data: result };
  });

  app.post('/templates/:id/approve', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await complianceService.approveTemplate(request.tenantId, id, request.userId);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    request.audit('approve', 'compliance_template', result.id, {});
    return { success: true, data: result };
  });

  app.delete('/templates/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await complianceService.deleteTemplate(request.tenantId, id);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Template not found' } });
    request.audit('delete', 'compliance_template', result.id, {});
    return reply.code(204).send();
  });

  // ── Retention Policies ──────────────────────────────────

  app.get('/retention', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest) => {
    const filters = RetentionPolicyFilters.parse(request.query);
    const result = await complianceService.listRetentionPolicies(request.tenantId, filters);
    return { success: true, data: result.items, meta: result.meta };
  });

  app.post('/retention', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateRetentionPolicyInput.parse(request.body);
    const result = await complianceService.createRetentionPolicy(request.tenantId, request.userId, data);
    request.audit('create', 'retention_policy', result.id, { name: data.name, dataType: data.dataType });
    return reply.code(201).send({ success: true, data: result });
  });

  app.get('/retention/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await complianceService.getRetentionPolicy(request.tenantId, id);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Retention policy not found' } });
    return { success: true, data: result };
  });

  app.patch('/retention/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = UpdateRetentionPolicyInput.parse(request.body);
    const result = await complianceService.updateRetentionPolicy(request.tenantId, id, data);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Retention policy not found' } });
    request.audit('update', 'retention_policy', result.id, data);
    return { success: true, data: result };
  });

  app.delete('/retention/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await complianceService.deleteRetentionPolicy(request.tenantId, id);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Retention policy not found' } });
    request.audit('delete', 'retention_policy', result.id, {});
    return reply.code(204).send();
  });

  // ── Stats ───────────────────────────────────────────────

  app.get('/stats', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest) => {
    const stats = await complianceService.getComplianceStats(request.tenantId);
    return { success: true, data: stats };
  });
}
