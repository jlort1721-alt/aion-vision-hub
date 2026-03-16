import { eq, and, sql, desc, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { trainingPrograms, certifications } from '../../db/schema/index.js';
import type { ProgramFilters, CertificationFilters } from './schemas.js';

export class TrainingService {
  // ── Programs ────────────────────────────────────────────

  async createProgram(tenantId: string, userId: string, data: Record<string, any>) {
    const [result] = await db.insert(trainingPrograms).values({ ...data, tenantId, createdBy: userId } as any).returning();
    return result;
  }

  async listPrograms(tenantId: string, filters: ProgramFilters) {
    const conditions: any[] = [eq(trainingPrograms.tenantId, tenantId)];
    if (filters.category) conditions.push(eq(trainingPrograms.category, filters.category));
    if (filters.isRequired !== undefined) conditions.push(eq(trainingPrograms.isRequired, filters.isRequired));
    if (filters.isActive !== undefined) conditions.push(eq(trainingPrograms.isActive, filters.isActive));

    const whereClause = and(...conditions);
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(trainingPrograms).where(whereClause);
    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db.select().from(trainingPrograms).where(whereClause).orderBy(desc(trainingPrograms.createdAt)).limit(filters.perPage).offset(offset);

    return { items: rows, meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) } };
  }

  async getProgram(tenantId: string, id: string) {
    const [result] = await db.select().from(trainingPrograms).where(and(eq(trainingPrograms.id, id), eq(trainingPrograms.tenantId, tenantId)));
    return result;
  }

  async updateProgram(tenantId: string, id: string, data: Record<string, any>) {
    const [result] = await db.update(trainingPrograms).set({ ...data, updatedAt: new Date() }).where(and(eq(trainingPrograms.id, id), eq(trainingPrograms.tenantId, tenantId))).returning();
    return result;
  }

  async deleteProgram(tenantId: string, id: string) {
    const [result] = await db.delete(trainingPrograms).where(and(eq(trainingPrograms.id, id), eq(trainingPrograms.tenantId, tenantId))).returning();
    return result;
  }

  // ── Certifications ──────────────────────────────────────

  async enrollUser(tenantId: string, data: Record<string, any>) {
    const [result] = await db.insert(certifications).values({ ...data, tenantId, status: 'enrolled' } as any).returning();
    return result;
  }

  async listCertifications(tenantId: string, filters: CertificationFilters) {
    const conditions: any[] = [eq(certifications.tenantId, tenantId)];
    if (filters.programId) conditions.push(eq(certifications.programId, filters.programId));
    if (filters.userId) conditions.push(eq(certifications.userId, filters.userId));
    if (filters.status) conditions.push(eq(certifications.status, filters.status));

    const whereClause = and(...conditions);
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(certifications).where(whereClause);
    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db.select().from(certifications).where(whereClause).orderBy(desc(certifications.createdAt)).limit(filters.perPage).offset(offset);

    return { items: rows, meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) } };
  }

  async getCertification(tenantId: string, id: string) {
    const [result] = await db.select().from(certifications).where(and(eq(certifications.id, id), eq(certifications.tenantId, tenantId)));
    return result;
  }

  async completeCertification(tenantId: string, id: string, issuedBy: string, data: { score: number; notes?: string }) {
    const cert = await this.getCertification(tenantId, id);
    if (!cert) return null;

    const program = await this.getProgram(tenantId, cert.programId);
    const passed = data.score >= (program?.passingScore ?? 70);
    const now = new Date();
    const expiresAt = program?.validityMonths
      ? new Date(now.getTime() + program.validityMonths * 30 * 24 * 60 * 60 * 1000)
      : null;

    const [result] = await db.update(certifications).set({
      status: passed ? 'completed' : 'failed',
      score: data.score,
      completedAt: now,
      expiresAt,
      issuedBy,
      notes: data.notes,
      updatedAt: now,
    }).where(and(eq(certifications.id, id), eq(certifications.tenantId, tenantId))).returning();

    return result;
  }

  async updateCertification(tenantId: string, id: string, data: Record<string, any>) {
    const [result] = await db.update(certifications).set({ ...data, updatedAt: new Date() }).where(and(eq(certifications.id, id), eq(certifications.tenantId, tenantId))).returning();
    return result;
  }

  async getExpiringCertifications(tenantId: string, days: number) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const rows = await db.select().from(certifications).where(and(
      eq(certifications.tenantId, tenantId),
      eq(certifications.status, 'completed'),
      lte(certifications.expiresAt, futureDate),
    )).orderBy(certifications.expiresAt);

    return rows;
  }

  async getTrainingStats(tenantId: string) {
    const [programStats] = await db.select({
      totalPrograms: sql<number>`count(*)::int`,
    }).from(trainingPrograms).where(eq(trainingPrograms.tenantId, tenantId));

    const [certStats] = await db.select({
      totalCertifications: sql<number>`count(*)::int`,
      enrolled: sql<number>`count(*) filter (where ${certifications.status} = 'enrolled')::int`,
      inProgress: sql<number>`count(*) filter (where ${certifications.status} = 'in_progress')::int`,
      completed: sql<number>`count(*) filter (where ${certifications.status} = 'completed')::int`,
      expired: sql<number>`count(*) filter (where ${certifications.status} = 'expired')::int`,
      failed: sql<number>`count(*) filter (where ${certifications.status} = 'failed')::int`,
    }).from(certifications).where(eq(certifications.tenantId, tenantId));

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const [expiringCount] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(certifications).where(and(
      eq(certifications.tenantId, tenantId),
      eq(certifications.status, 'completed'),
      lte(certifications.expiresAt, futureDate),
    ));

    const totalCerts = certStats?.totalCertifications ?? 0;
    const completedCerts = certStats?.completed ?? 0;
    const complianceRate = totalCerts > 0 ? Math.round((completedCerts / totalCerts) * 10000) / 100 : 100;

    return {
      ...programStats,
      ...certStats,
      expiringSoon: expiringCount?.count ?? 0,
      complianceRate,
    };
  }
}

export const trainingService = new TrainingService();
