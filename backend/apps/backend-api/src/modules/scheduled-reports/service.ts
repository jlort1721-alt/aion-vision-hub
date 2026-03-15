import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { scheduledReports } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type {
  CreateScheduledReportInput,
  UpdateScheduledReportInput,
  ScheduledReportFilters,
} from './schemas.js';

export class ScheduledReportService {
  // ══════════════════════════════════════════════════════════
  // SCHEDULED REPORTS
  // ══════════════════════════════════════════════════════════

  async listReports(tenantId: string, filters: ScheduledReportFilters) {
    const conditions = [eq(scheduledReports.tenantId, tenantId)];

    if (filters.type) {
      conditions.push(eq(scheduledReports.type, filters.type));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(scheduledReports.isActive, filters.isActive));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scheduledReports)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(scheduledReports)
      .where(whereClause)
      .orderBy(desc(scheduledReports.createdAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: { page: filters.page, perPage: filters.perPage, total, totalPages: Math.ceil(total / filters.perPage) },
    };
  }

  async getReportById(id: string, tenantId: string) {
    const [report] = await db
      .select()
      .from(scheduledReports)
      .where(and(eq(scheduledReports.id, id), eq(scheduledReports.tenantId, tenantId)))
      .limit(1);
    if (!report) throw new NotFoundError('ScheduledReport', id);
    return report;
  }

  async createReport(data: CreateScheduledReportInput, tenantId: string, userId: string) {
    const [report] = await db
      .insert(scheduledReports)
      .values({
        tenantId,
        name: data.name,
        type: data.type,
        schedule: data.schedule,
        recipients: data.recipients,
        format: data.format,
        filters: data.filters ?? null,
        isActive: data.isActive,
        createdBy: userId,
      })
      .returning();
    return report;
  }

  async updateReport(id: string, data: UpdateScheduledReportInput, tenantId: string) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.schedule !== undefined) updateData.schedule = data.schedule;
    if (data.recipients !== undefined) updateData.recipients = data.recipients;
    if (data.format !== undefined) updateData.format = data.format;
    if (data.filters !== undefined) updateData.filters = data.filters;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [report] = await db
      .update(scheduledReports)
      .set(updateData)
      .where(and(eq(scheduledReports.id, id), eq(scheduledReports.tenantId, tenantId)))
      .returning();

    if (!report) throw new NotFoundError('ScheduledReport', id);
    return report;
  }

  async deleteReport(id: string, tenantId: string) {
    const [report] = await db
      .delete(scheduledReports)
      .where(and(eq(scheduledReports.id, id), eq(scheduledReports.tenantId, tenantId)))
      .returning();
    if (!report) throw new NotFoundError('ScheduledReport', id);
    return report;
  }
}

export const scheduledReportService = new ScheduledReportService();
