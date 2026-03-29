import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { reports, events, devices, incidents } from '../../db/schema/index.js';
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

  /**
   * Generate the actual report content (CSV/JSON), store it in the record,
   * and mark as completed.
   */
  async generate(id: string, tenantId: string) {
    const report = await this.getById(id, tenantId);

    // Query data based on report type
    let data: Record<string, unknown>[] = [];

    switch (report.type) {
      case 'events':
        data = await db
          .select()
          .from(events)
          .where(eq(events.tenantId, tenantId))
          .orderBy(desc(events.createdAt))
          .limit(500);
        break;
      case 'devices':
        data = await db
          .select()
          .from(devices)
          .where(eq(devices.tenantId, tenantId))
          .limit(500);
        break;
      case 'incidents':
        data = await db
          .select()
          .from(incidents)
          .where(eq(incidents.tenantId, tenantId))
          .limit(500);
        break;
      default:
        data = [];
    }

    // Generate content based on requested format
    let content = '';
    if (report.format === 'csv' && data.length > 0) {
      const headers = Object.keys(data[0]);
      content =
        headers.join(',') +
        '\n' +
        data
          .map((row) =>
            headers.map((h) => JSON.stringify(row[h] ?? '')).join(','),
          )
          .join('\n');
    } else {
      content = JSON.stringify(data, null, 2);
    }

    // Build a data-URI so the result can be retrieved without external storage
    const mime =
      report.format === 'csv' ? 'text/csv' : 'application/json';
    const dataUri = `data:${mime};base64,${Buffer.from(content).toString('base64')}`;

    // Persist result
    const [updated] = await db
      .update(reports)
      .set({
        status: 'completed',
        resultUrl: dataUri,
        generatedAt: new Date(),
      })
      .where(and(eq(reports.id, id), eq(reports.tenantId, tenantId)))
      .returning();

    return updated;
  }

  /** Delete a report by ID */
  async delete(id: string, tenantId: string) {
    const [deleted] = await db
      .delete(reports)
      .where(and(eq(reports.id, id), eq(reports.tenantId, tenantId)))
      .returning();
    if (!deleted) throw new NotFoundError('Report', id);
    return deleted;
  }
}

export const reportService = new ReportService();
