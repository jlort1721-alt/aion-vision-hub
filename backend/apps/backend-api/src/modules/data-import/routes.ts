/**
 * Data Import — Fastify Routes
 *
 * Endpoints for bulk importing residents, vehicles, visitors, and devices.
 * All endpoints require tenant_admin role, accept CSV or JSON body,
 * validate with Zod, and return an import summary.
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import {
  residentImportRowSchema,
  vehicleImportRowSchema,
  visitorImportRowSchema,
  deviceImportRowSchema,
} from './schemas.js';
import type {
  ResidentImportRow,
  VehicleImportRow,
  VisitorImportRow,
  DeviceImportRow,
} from './schemas.js';
import {
  importResidents,
  importVehicles,
  importVisitors,
  importDevices,
} from './service.js';

// ── CSV Parser ───────────────────────────────────────────────

/**
 * Parse a CSV string into an array of objects.
 * Assumes the first line is the header row.
 */
function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields with commas inside
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim());

    const obj: Record<string, string> = {};
    for (let k = 0; k < headers.length; k++) {
      const val = values[k] ?? '';
      obj[headers[k]] = val;
    }
    rows.push(obj);
  }

  return rows;
}

/**
 * Detect whether the body is CSV or JSON and normalize to an array of records.
 */
function extractRecords(body: unknown): Record<string, unknown>[] {
  // If body is already an object with a `records` array, use it directly
  if (typeof body === 'object' && body !== null && Array.isArray((body as any).records)) {
    return (body as any).records;
  }

  // If body is an array, use it directly
  if (Array.isArray(body)) {
    return body;
  }

  // If body is a string (CSV), parse it
  if (typeof body === 'string') {
    return parseCSV(body);
  }

  throw new Error('Request body must be a JSON array, a JSON object with a "records" array, or a CSV string');
}

// ── Routes ───────────────────────────────────────────────────

export async function registerDataImportRoutes(app: FastifyInstance) {

  // ── Import Residents ──────────────────────────────────────
  app.post(
    '/residents',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const records = extractRecords(request.body);

      // Validate each record with Zod
      const validRecords: ResidentImportRow[] = [];
      const validationErrors: { row: number; reason: string }[] = [];

      for (let i = 0; i < records.length; i++) {
        const result = residentImportRowSchema.safeParse(records[i]);
        if (result.success) {
          validRecords.push(result.data);
        } else {
          validationErrors.push({
            row: i + 1,
            reason: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          });
        }
      }

      if (validRecords.length === 0 && validationErrors.length > 0) {
        return reply.code(422).send({
          success: false,
          error: 'All records failed validation',
          details: { total: records.length, errors: validationErrors.slice(0, 50) },
        });
      }

      const result = await importResidents(request.tenantId, validRecords);
      result.errors.push(...validationErrors.map((e) => ({ ...e, data: undefined })));

      await request.audit('data_import.residents', 'access_people', undefined, {
        total: result.total + validationErrors.length,
        imported: result.imported,
        skipped: result.skipped,
        errorCount: result.errors.length,
      });

      return reply.send({ success: true, data: result });
    },
  );

  // ── Import Vehicles ───────────────────────────────────────
  app.post(
    '/vehicles',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const records = extractRecords(request.body);

      const validRecords: VehicleImportRow[] = [];
      const validationErrors: { row: number; reason: string }[] = [];

      for (let i = 0; i < records.length; i++) {
        const result = vehicleImportRowSchema.safeParse(records[i]);
        if (result.success) {
          validRecords.push(result.data);
        } else {
          validationErrors.push({
            row: i + 1,
            reason: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          });
        }
      }

      if (validRecords.length === 0 && validationErrors.length > 0) {
        return reply.code(422).send({
          success: false,
          error: 'All records failed validation',
          details: { total: records.length, errors: validationErrors.slice(0, 50) },
        });
      }

      const result = await importVehicles(request.tenantId, validRecords);
      result.errors.push(...validationErrors.map((e) => ({ ...e, data: undefined })));

      await request.audit('data_import.vehicles', 'access_vehicles', undefined, {
        total: result.total + validationErrors.length,
        imported: result.imported,
        skipped: result.skipped,
        errorCount: result.errors.length,
      });

      return reply.send({ success: true, data: result });
    },
  );

  // ── Import Visitors ───────────────────────────────────────
  app.post(
    '/visitors',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const records = extractRecords(request.body);

      const validRecords: VisitorImportRow[] = [];
      const validationErrors: { row: number; reason: string }[] = [];

      for (let i = 0; i < records.length; i++) {
        const result = visitorImportRowSchema.safeParse(records[i]);
        if (result.success) {
          validRecords.push(result.data);
        } else {
          validationErrors.push({
            row: i + 1,
            reason: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          });
        }
      }

      if (validRecords.length === 0 && validationErrors.length > 0) {
        return reply.code(422).send({
          success: false,
          error: 'All records failed validation',
          details: { total: records.length, errors: validationErrors.slice(0, 50) },
        });
      }

      const result = await importVisitors(request.tenantId, validRecords);
      result.errors.push(...validationErrors.map((e) => ({ ...e, data: undefined })));

      await request.audit('data_import.visitors', 'visitors', undefined, {
        total: result.total + validationErrors.length,
        imported: result.imported,
        skipped: result.skipped,
        errorCount: result.errors.length,
      });

      return reply.send({ success: true, data: result });
    },
  );

  // ── Import Devices ────────────────────────────────────────
  app.post(
    '/devices',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const records = extractRecords(request.body);

      const validRecords: DeviceImportRow[] = [];
      const validationErrors: { row: number; reason: string }[] = [];

      for (let i = 0; i < records.length; i++) {
        const result = deviceImportRowSchema.safeParse(records[i]);
        if (result.success) {
          validRecords.push(result.data);
        } else {
          validationErrors.push({
            row: i + 1,
            reason: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          });
        }
      }

      if (validRecords.length === 0 && validationErrors.length > 0) {
        return reply.code(422).send({
          success: false,
          error: 'All records failed validation',
          details: { total: records.length, errors: validationErrors.slice(0, 50) },
        });
      }

      const result = await importDevices(request.tenantId, validRecords);
      result.errors.push(...validationErrors.map((e) => ({ ...e, data: undefined })));

      await request.audit('data_import.devices', 'devices', undefined, {
        total: result.total + validationErrors.length,
        imported: result.imported,
        skipped: result.skipped,
        errorCount: result.errors.length,
      });

      return reply.send({ success: true, data: result });
    },
  );
}
