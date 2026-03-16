import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { contracts, invoices } from '../../db/schema/index.js';
import type { ContractFilters, InvoiceFilters } from './schemas.js';

export class ContractService {
  // ── Contracts ───────────────────────────────────────────

  async createContract(tenantId: string, userId: string, data: Record<string, any>) {
    const [result] = await db
      .insert(contracts)
      .values({ ...data, tenantId, createdBy: userId } as any)
      .returning();
    return result;
  }

  async listContracts(tenantId: string, filters: ContractFilters) {
    const conditions: any[] = [eq(contracts.tenantId, tenantId)];
    if (filters.status) conditions.push(eq(contracts.status, filters.status));
    if (filters.from) conditions.push(gte(contracts.startDate, filters.from));
    if (filters.to) conditions.push(lte(contracts.startDate, filters.to));

    const whereClause = and(...conditions);
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(contracts).where(whereClause);
    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db.select().from(contracts).where(whereClause).orderBy(desc(contracts.createdAt)).limit(filters.perPage).offset(offset);

    return { items: rows, meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) } };
  }

  async getContract(tenantId: string, id: string) {
    const [result] = await db.select().from(contracts).where(and(eq(contracts.id, id), eq(contracts.tenantId, tenantId)));
    return result;
  }

  async updateContract(tenantId: string, id: string, data: Record<string, any>) {
    const [result] = await db.update(contracts).set({ ...data, updatedAt: new Date() }).where(and(eq(contracts.id, id), eq(contracts.tenantId, tenantId))).returning();
    return result;
  }

  async deleteContract(tenantId: string, id: string) {
    const [result] = await db.delete(contracts).where(and(eq(contracts.id, id), eq(contracts.tenantId, tenantId))).returning();
    return result;
  }

  async getContractStats(tenantId: string) {
    const [result] = await db.select({
      total: sql<number>`count(*)::int`,
      draft: sql<number>`count(*) filter (where ${contracts.status} = 'draft')::int`,
      active: sql<number>`count(*) filter (where ${contracts.status} = 'active')::int`,
      suspended: sql<number>`count(*) filter (where ${contracts.status} = 'suspended')::int`,
      terminated: sql<number>`count(*) filter (where ${contracts.status} = 'terminated')::int`,
      expired: sql<number>`count(*) filter (where ${contracts.status} = 'expired')::int`,
      monthlyRevenue: sql<string>`coalesce(sum(${contracts.monthlyAmount}) filter (where ${contracts.status} = 'active'), 0)::text`,
    }).from(contracts).where(eq(contracts.tenantId, tenantId));
    return result;
  }

  // ── Invoices ────────────────────────────────────────────

  async createInvoice(tenantId: string, userId: string, data: Record<string, any>) {
    const subtotal = parseFloat(data.subtotal || '0');
    const taxRate = parseFloat(data.taxRate || '19');
    const taxAmount = subtotal * taxRate / 100;
    const totalAmount = subtotal + taxAmount;

    const [result] = await db.insert(invoices).values({
      ...data,
      tenantId,
      createdBy: userId,
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
    } as any).returning();
    return result;
  }

  async listInvoices(tenantId: string, filters: InvoiceFilters) {
    const conditions: any[] = [eq(invoices.tenantId, tenantId)];
    if (filters.status) conditions.push(eq(invoices.status, filters.status));
    if (filters.contractId) conditions.push(eq(invoices.contractId, filters.contractId));
    if (filters.from) conditions.push(gte(invoices.issueDate, filters.from));
    if (filters.to) conditions.push(lte(invoices.issueDate, filters.to));

    const whereClause = and(...conditions);
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(invoices).where(whereClause);
    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db.select().from(invoices).where(whereClause).orderBy(desc(invoices.createdAt)).limit(filters.perPage).offset(offset);

    return { items: rows, meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) } };
  }

  async getInvoice(tenantId: string, id: string) {
    const [result] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));
    return result;
  }

  async updateInvoice(tenantId: string, id: string, data: Record<string, any>) {
    const [result] = await db.update(invoices).set({ ...data, updatedAt: new Date() }).where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId))).returning();
    return result;
  }

  async markInvoicePaid(tenantId: string, id: string, paymentMethod: string, paymentReference: string | undefined, paidAmount: string) {
    const [result] = await db.update(invoices).set({
      status: 'paid',
      paidAt: new Date(),
      paidAmount,
      paymentMethod,
      paymentReference: paymentReference ?? null,
      updatedAt: new Date(),
    }).where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId))).returning();
    return result;
  }

  async getInvoiceStats(tenantId: string) {
    const [result] = await db.select({
      total: sql<number>`count(*)::int`,
      draft: sql<number>`count(*) filter (where ${invoices.status} = 'draft')::int`,
      sent: sql<number>`count(*) filter (where ${invoices.status} = 'sent')::int`,
      paid: sql<number>`count(*) filter (where ${invoices.status} = 'paid')::int`,
      overdue: sql<number>`count(*) filter (where ${invoices.status} = 'overdue')::int`,
      outstanding: sql<string>`coalesce(sum(${invoices.totalAmount}) filter (where ${invoices.status} in ('sent', 'overdue')), 0)::text`,
      collected: sql<string>`coalesce(sum(${invoices.paidAmount}) filter (where ${invoices.status} = 'paid'), 0)::text`,
    }).from(invoices).where(eq(invoices.tenantId, tenantId));
    return result;
  }
}

export const contractService = new ContractService();
