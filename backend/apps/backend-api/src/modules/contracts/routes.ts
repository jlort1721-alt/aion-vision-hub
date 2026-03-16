import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { contractService } from './service.js';
import { CreateContractInput, UpdateContractInput, ContractFilters, CreateInvoiceInput, UpdateInvoiceInput, InvoiceFilters, MarkPaidInput } from './schemas.js';

export async function registerContractRoutes(app: FastifyInstance) {
  // ── Contract CRUD ───────────────────────────────────────

  app.get('/', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest) => {
    const filters = ContractFilters.parse(request.query);
    const result = await contractService.listContracts(request.tenantId, filters);
    return { success: true, data: result.items, meta: result.meta };
  });

  app.post('/', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateContractInput.parse(request.body);
    const result = await contractService.createContract(request.tenantId, request.userId, data);
    request.audit('create', 'contract', result.id, { contractNumber: data.contractNumber });
    return reply.code(201).send({ success: true, data: result });
  });

  app.get('/stats', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest) => {
    const stats = await contractService.getContractStats(request.tenantId);
    return { success: true, data: stats };
  });

  app.get('/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await contractService.getContract(request.tenantId, id);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Contract not found' } });
    return { success: true, data: result };
  });

  app.patch('/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = UpdateContractInput.parse(request.body);
    const result = await contractService.updateContract(request.tenantId, id, data);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Contract not found' } });
    request.audit('update', 'contract', result.id, data);
    return { success: true, data: result };
  });

  app.delete('/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await contractService.deleteContract(request.tenantId, id);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Contract not found' } });
    request.audit('delete', 'contract', result.id, {});
    return reply.code(204).send();
  });

  // ── Invoice CRUD ────────────────────────────────────────

  app.get('/invoices', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest) => {
    const filters = InvoiceFilters.parse(request.query);
    const result = await contractService.listInvoices(request.tenantId, filters);
    return { success: true, data: result.items, meta: result.meta };
  });

  app.post('/invoices', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateInvoiceInput.parse(request.body);
    const result = await contractService.createInvoice(request.tenantId, request.userId, data);
    request.audit('create', 'invoice', result.id, { invoiceNumber: data.invoiceNumber });
    return reply.code(201).send({ success: true, data: result });
  });

  app.get('/invoices/stats', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest) => {
    const stats = await contractService.getInvoiceStats(request.tenantId);
    return { success: true, data: stats };
  });

  app.get('/invoices/:id', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const result = await contractService.getInvoice(request.tenantId, id);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
    return { success: true, data: result };
  });

  app.patch('/invoices/:id', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = UpdateInvoiceInput.parse(request.body);
    const result = await contractService.updateInvoice(request.tenantId, id, data);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
    request.audit('update', 'invoice', result.id, data);
    return { success: true, data: result };
  });

  app.post('/invoices/:id/pay', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = MarkPaidInput.parse(request.body);
    const result = await contractService.markInvoicePaid(request.tenantId, id, data.paymentMethod, data.paymentReference, data.paidAmount);
    if (!result) return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
    request.audit('mark_paid', 'invoice', result.id, data);
    return { success: true, data: result };
  });
}
