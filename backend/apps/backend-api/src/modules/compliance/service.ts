import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { complianceTemplates, dataRetentionPolicies } from '../../db/schema/index.js';
import type { TemplateFilters, RetentionPolicyFilters } from './schemas.js';

export class ComplianceService {
  // ── Templates ───────────────────────────────────────────

  async createTemplate(tenantId: string, userId: string, data: Record<string, any>) {
    const [result] = await db.insert(complianceTemplates).values({ ...data, tenantId, createdBy: userId } as any).returning();
    return result;
  }

  async listTemplates(tenantId: string, filters: TemplateFilters) {
    const conditions: any[] = [eq(complianceTemplates.tenantId, tenantId)];
    if (filters.type) conditions.push(eq(complianceTemplates.type, filters.type));
    if (filters.isActive !== undefined) conditions.push(eq(complianceTemplates.isActive, filters.isActive));

    const whereClause = and(...conditions);
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(complianceTemplates).where(whereClause);
    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db.select().from(complianceTemplates).where(whereClause).orderBy(desc(complianceTemplates.createdAt)).limit(filters.perPage).offset(offset);

    return { items: rows, meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) } };
  }

  async getTemplate(tenantId: string, id: string) {
    const [result] = await db.select().from(complianceTemplates).where(and(eq(complianceTemplates.id, id), eq(complianceTemplates.tenantId, tenantId)));
    return result;
  }

  async updateTemplate(tenantId: string, id: string, data: Record<string, any>) {
    const current = await this.getTemplate(tenantId, id);
    const version = current ? (current.version || 1) + 1 : 1;
    const [result] = await db.update(complianceTemplates).set({ ...data, version, updatedAt: new Date() }).where(and(eq(complianceTemplates.id, id), eq(complianceTemplates.tenantId, tenantId))).returning();
    return result;
  }

  async approveTemplate(tenantId: string, id: string, approvedBy: string) {
    const [result] = await db.update(complianceTemplates).set({ approvedBy, approvedAt: new Date(), updatedAt: new Date() }).where(and(eq(complianceTemplates.id, id), eq(complianceTemplates.tenantId, tenantId))).returning();
    return result;
  }

  async deleteTemplate(tenantId: string, id: string) {
    const [result] = await db.delete(complianceTemplates).where(and(eq(complianceTemplates.id, id), eq(complianceTemplates.tenantId, tenantId))).returning();
    return result;
  }

  // ── Retention Policies ──────────────────────────────────

  async createRetentionPolicy(tenantId: string, userId: string, data: Record<string, any>) {
    const [result] = await db.insert(dataRetentionPolicies).values({ ...data, tenantId, createdBy: userId } as any).returning();
    return result;
  }

  async listRetentionPolicies(tenantId: string, filters: RetentionPolicyFilters) {
    const conditions: any[] = [eq(dataRetentionPolicies.tenantId, tenantId)];
    if (filters.dataType) conditions.push(eq(dataRetentionPolicies.dataType, filters.dataType));
    if (filters.isActive !== undefined) conditions.push(eq(dataRetentionPolicies.isActive, filters.isActive));

    const whereClause = and(...conditions);
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(dataRetentionPolicies).where(whereClause);
    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db.select().from(dataRetentionPolicies).where(whereClause).orderBy(desc(dataRetentionPolicies.createdAt)).limit(filters.perPage).offset(offset);

    return { items: rows, meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) } };
  }

  async getRetentionPolicy(tenantId: string, id: string) {
    const [result] = await db.select().from(dataRetentionPolicies).where(and(eq(dataRetentionPolicies.id, id), eq(dataRetentionPolicies.tenantId, tenantId)));
    return result;
  }

  async updateRetentionPolicy(tenantId: string, id: string, data: Record<string, any>) {
    const [result] = await db.update(dataRetentionPolicies).set({ ...data, updatedAt: new Date() }).where(and(eq(dataRetentionPolicies.id, id), eq(dataRetentionPolicies.tenantId, tenantId))).returning();
    return result;
  }

  async deleteRetentionPolicy(tenantId: string, id: string) {
    const [result] = await db.delete(dataRetentionPolicies).where(and(eq(dataRetentionPolicies.id, id), eq(dataRetentionPolicies.tenantId, tenantId))).returning();
    return result;
  }

  async getComplianceStats(tenantId: string) {
    const [templateStats] = await db.select({
      totalTemplates: sql<number>`count(*)::int`,
      activeTemplates: sql<number>`count(*) filter (where ${complianceTemplates.isActive} = true)::int`,
      approvedTemplates: sql<number>`count(*) filter (where ${complianceTemplates.approvedBy} is not null)::int`,
      pendingTemplates: sql<number>`count(*) filter (where ${complianceTemplates.approvedBy} is null and ${complianceTemplates.isActive} = true)::int`,
    }).from(complianceTemplates).where(eq(complianceTemplates.tenantId, tenantId));

    const [retentionStats] = await db.select({
      totalPolicies: sql<number>`count(*)::int`,
      activePolicies: sql<number>`count(*) filter (where ${dataRetentionPolicies.isActive} = true)::int`,
    }).from(dataRetentionPolicies).where(eq(dataRetentionPolicies.tenantId, tenantId));

    return { ...templateStats, ...retentionStats };
  }
}

export const complianceService = new ComplianceService();
