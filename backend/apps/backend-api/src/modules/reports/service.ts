import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { reports } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type { CreateReportInput, ReportQueryInput } from './schemas.js';

export class ReportService {
  /**
   * List reports with optional filters and pagination.
   */
  async list(tenantId: string, query: ReportQueryInput) {
    const conditions = [eq(reports.tenantId, tenantId)];

    if (query.type) {
      conditions.push(eq(reports.type, query.type));
    }
    if (query.status) {
      conditions.push(eq(reports.status, query.status));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / query.perPage);
    const offset = (query.page - 1) * query.perPage;

    const rows = await db
      .select()
      .from(reports)
      .where(whereClause)
      .orderBy(desc(reports.createdAt))
      .limit(query.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: {
        page: query.page,
        perPage: query.perPage,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get a single report by ID, scoped to tenant.
   */
  async getById(id: string, tenantId: string) {
    const [report] = await db
      .select()
      .from(reports)
      .where(and(eq(reports.id, id), eq(reports.tenantId, tenantId)))
      .limit(1);

    if (!report) throw new NotFoundError('Report', id);
    return report;
  }

  /**
   * Create a new report request.
   */
  async create(tenantId: string, userId: string, input: CreateReportInput) {
    const [report] = await db
      .insert(reports)
      .values({
        tenantId,
        name: input.name,
        type: input.type,
        format: input.format,
        parameters: input.parameters,
        status: 'pending',
        generatedBy: userId,
      })
      .returning();

    return report;
  }

  /**
   * Get export data for a completed report.
   */
  async getExport(id: string, tenantId: string) {
    const report = await this.getById(id, tenantId);

    if (report.status !== 'completed' && report.status !== 'ready') {
      return {
        ready: false,
        status: report.status,
        errorMessage: report.errorMessage,
      };
    }

    return {
      ready: true,
      status: report.status,
      resultUrl: report.resultUrl,
      format: report.format,
      generatedAt: report.generatedAt,
    };
  }
}

export const reportService = new ReportService();
