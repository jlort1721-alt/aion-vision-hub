import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { trainingService } from './service.js';
import { CreateProgramInput, UpdateProgramInput, ProgramFilters, CreateCertificationInput, CompleteCertificationInput, UpdateCertificationInput, CertificationFilters } from './schemas.js';

export async function registerTrainingRoutes(app: FastifyInstance) {
  // ── Programs ────────────────────────────────────────────

  app.get('/programs', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest) => {
    const filters = ProgramFilters.parse(request.query);
    const result = await trainingService.listPrograms(request.tenantId, filters);
    return { success: true, data: result.items, meta: result.meta };
  });

  app.post('/programs', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateProgramInput.parse(request.body);
    const result = await trainingService.createProgram(request.tenantId, request.userId, data);
    request.audit('create', 'training_program', result.id, { name: data.name });
    return reply.code(201).send({ success: true, data: result });
  });

  app.get('/programs/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await trainingService.getProgram(request.tenantId, id);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Program not found' } });
    return { success: true, data: result };
  });

  app.patch('/programs/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = UpdateProgramInput.parse(request.body);
    const result = await trainingService.updateProgram(request.tenantId, id, data);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Program not found' } });
    request.audit('update', 'training_program', result.id, data);
    return { success: true, data: result };
  });

  app.delete('/programs/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await trainingService.deleteProgram(request.tenantId, id);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Program not found' } });
    request.audit('delete', 'training_program', result.id, {});
    return reply.code(204).send();
  });

  // ── Certifications ──────────────────────────────────────

  app.get('/certifications', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest) => {
    const filters = CertificationFilters.parse(request.query);
    const result = await trainingService.listCertifications(request.tenantId, filters);
    return { success: true, data: result.items, meta: result.meta };
  });

  app.post('/certifications', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateCertificationInput.parse(request.body);
    const result = await trainingService.enrollUser(request.tenantId, data);
    request.audit('enroll', 'certification', result.id, { userName: data.userName, programId: data.programId });
    return reply.code(201).send({ success: true, data: result });
  });

  app.get('/certifications/expiring', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest) => {
    const { days } = request.query as { days?: string };
    const result = await trainingService.getExpiringCertifications(request.tenantId, parseInt(days || '30', 10));
    return { success: true, data: result };
  });

  app.get('/certifications/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await trainingService.getCertification(request.tenantId, id);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Certification not found' } });
    return { success: true, data: result };
  });

  app.patch('/certifications/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = UpdateCertificationInput.parse(request.body);
    const result = await trainingService.updateCertification(request.tenantId, id, data);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Certification not found' } });
    request.audit('update', 'certification', result.id, data);
    return { success: true, data: result };
  });

  app.post('/certifications/:id/complete', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = CompleteCertificationInput.parse(request.body);
    const result = await trainingService.completeCertification(request.tenantId, id, request.userId, data);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Certification not found' } });
    request.audit('complete', 'certification', result.id, { score: data.score, status: result.status });
    return { success: true, data: result };
  });

  // ── Stats ───────────────────────────────────────────────

  app.get('/stats', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest) => {
    const stats = await trainingService.getTrainingStats(request.tenantId);
    return { success: true, data: stats };
  });
}
