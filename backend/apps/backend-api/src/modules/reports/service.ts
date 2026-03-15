import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { reports } from '../../db/schema/index.js';
import { NotFoundError, AppError, ErrorCodes } from '@aion/shared-contracts';
import type { CreateReportInput, ReportQueryInput } from './schemas.js';

export class ReportService {
  /**
   * List reports for a tenant with pagination and optional filters.
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

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(reports)
      .where(whereClause);

    // Get paginated results
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const offset = (page - 1) * perPage;

    const items = await db
      .select()
      .from(reports)
      .where(whereClause)
      .orderBy(desc(reports.createdAt))
      .limit(perPage)
      .offset(offset);

    return {
      items,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
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

    if (!report) {
      throw new NotFoundError('Report', id);
    }

    return report;
  }

  /**
   * Create a new report request.
   * The report starts in 'pending' status and would be picked up
   * by a background worker for generation.
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
        createdBy: userId,
      })
      .returning();

    return report;
  }

  /**
   * Get the export/download URL for a completed report.
   * Only reports with status 'ready' can be exported.
   */
  async getExport(id: string, tenantId: string) {
    const report = await this.getById(id, tenantId);

    if (report.status !== 'ready') {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        `Report is not ready for export (current status: ${report.status})`,
        400,
        { reportId: id, status: report.status },
      );
    }

    if (!report.outputUrl) {
      throw new AppError(
        ErrorCodes.INTERNAL_ERROR,
        'Report is marked as ready but has no output URL',
        500,
        { reportId: id },
      );
    }

    return {
      id: report.id,
      name: report.name,
      format: report.format,
      outputUrl: report.outputUrl,
      generatedAt: report.generatedAt,
    };
  }
}

export const reportService = new ReportService();
