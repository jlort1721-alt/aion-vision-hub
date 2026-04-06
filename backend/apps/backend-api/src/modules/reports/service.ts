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
    let dataUri: string;

    if (report.format === 'pdf' && data.length > 0) {
      const pdfBuffer = await this.generatePDF(report.name, report.type, data);
      dataUri = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
    } else if (report.format === 'csv' && data.length > 0) {
      const headers = Object.keys(data[0]);
      const content =
        headers.join(',') +
        '\n' +
        data
          .map((row) =>
            headers.map((h) => JSON.stringify(row[h] ?? '')).join(','),
          )
          .join('\n');
      dataUri = `data:text/csv;base64,${Buffer.from(content).toString('base64')}`;
    } else {
      const content = JSON.stringify(data, null, 2);
      dataUri = `data:application/json;base64,${Buffer.from(content).toString('base64')}`;
    }

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

  /** Generate a PDF report using pdfkit */
  private async generatePDF(
    reportName: string,
    reportType: string,
    data: Record<string, unknown>[],
  ): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text('AION — Clave Seguridad', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(14).text(reportName, { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').text(
        `Tipo: ${reportType} | Generado: ${new Date().toLocaleString('es-CO')} | Registros: ${data.length}`,
        { align: 'center' },
      );
      doc.moveDown(1);

      // Divider
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#cccccc');
      doc.moveDown(0.5);

      if (data.length === 0) {
        doc.fontSize(11).text('Sin datos para mostrar.');
      } else {
        const headers = Object.keys(data[0]).slice(0, 6); // Max 6 columns for readability
        const colWidth = (515 / headers.length);

        // Table header
        doc.fontSize(8).font('Helvetica-Bold');
        let x = 40;
        for (const h of headers) {
          doc.text(h.replace(/_/g, ' ').toUpperCase(), x, doc.y, { width: colWidth, continued: false });
          x += colWidth;
        }
        doc.moveDown(0.3);
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#eeeeee');
        doc.moveDown(0.2);

        // Table rows
        doc.font('Helvetica').fontSize(7);
        const maxRows = Math.min(data.length, 200); // Cap at 200 rows
        for (let i = 0; i < maxRows; i++) {
          const row = data[i];
          const startY = doc.y;
          x = 40;
          for (const h of headers) {
            let val = row[h];
            if (val instanceof Date) val = val.toLocaleString('es-CO');
            else if (typeof val === 'object' && val !== null) val = JSON.stringify(val).slice(0, 30);
            doc.text(String(val ?? ''), x, startY, { width: colWidth - 4, lineBreak: false });
            x += colWidth;
          }
          doc.moveDown(0.4);

          // Page break check
          if (doc.y > 750) {
            doc.addPage();
            doc.fontSize(7).font('Helvetica');
          }
        }

        if (data.length > maxRows) {
          doc.moveDown(0.5);
          doc.fontSize(8).text(`... y ${data.length - maxRows} registros más.`);
        }
      }

      // Footer on each page
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).font('Helvetica').text(
          `Página ${i + 1} de ${pages.count} — AION Platform © ${new Date().getFullYear()}`,
          40, 780, { align: 'center', width: 515 },
        );
      }

      doc.end();
    });
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
