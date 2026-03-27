/**
 * Data Import Service
 *
 * Bulk import of residents, vehicles, visitors, and devices.
 * Handles deduplication, validation, and error reporting.
 */

import { eq, and, ilike, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accessPeople, accessVehicles, visitors } from '../../db/schema/index.js';
import { devices } from '../../db/schema/devices.js';
import type {
  ResidentImportRow,
  VehicleImportRow,
  VisitorImportRow,
  DeviceImportRow,
  ImportResult,
  ImportError,
} from './schemas.js';

// ── Residents Import ─────────────────────────────────────────

export async function importResidents(
  tenantId: string,
  records: ResidentImportRow[],
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 1;

    try {
      // Required field check
      if (!row.fullName?.trim()) {
        errors.push({ row: rowNum, reason: 'fullName is required', data: row as any });
        continue;
      }

      // Deduplication: check by documentId if provided
      if (row.documentId) {
        const existing = await db
          .select({ id: accessPeople.id })
          .from(accessPeople)
          .where(
            and(
              eq(accessPeople.tenantId, tenantId),
              ilike(accessPeople.documentId, row.documentId),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }
      }

      // Deduplication: check by fullName + unit if no documentId
      if (!row.documentId && row.unit) {
        const existing = await db
          .select({ id: accessPeople.id })
          .from(accessPeople)
          .where(
            and(
              eq(accessPeople.tenantId, tenantId),
              ilike(accessPeople.fullName, row.fullName.trim()),
              ilike(accessPeople.unit, row.unit),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }
      }

      await db.insert(accessPeople).values({
        tenantId,
        fullName: row.fullName.trim(),
        type: row.type || 'resident',
        documentId: row.documentId || null,
        phone: row.phone || null,
        email: row.email || null,
        unit: row.unit || null,
        notes: row.notes || null,
        sectionId: row.sectionId || null,
        status: row.status || 'active',
      });

      imported++;
    } catch (err) {
      errors.push({
        row: rowNum,
        reason: err instanceof Error ? err.message : 'Unknown error',
        data: row as any,
      });
    }
  }

  return { total: records.length, imported, skipped, errors };
}

// ── Vehicles Import ──────────────────────────────────────────

export async function importVehicles(
  tenantId: string,
  records: VehicleImportRow[],
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 1;

    try {
      if (!row.plate?.trim()) {
        errors.push({ row: rowNum, reason: 'plate is required', data: row as any });
        continue;
      }

      const normalizedPlate = row.plate.replace(/[\s\-]/g, '').toUpperCase();

      // Deduplication by plate
      const existing = await db
        .select({ id: accessVehicles.id })
        .from(accessVehicles)
        .where(
          and(
            eq(accessVehicles.tenantId, tenantId),
            sql`UPPER(REPLACE(REPLACE(${accessVehicles.plate}, '-', ''), ' ', '')) = ${normalizedPlate}`,
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Resolve personId from personDocumentId if provided
      let personId = row.personId || null;
      if (!personId && row.personDocumentId) {
        const [person] = await db
          .select({ id: accessPeople.id })
          .from(accessPeople)
          .where(
            and(
              eq(accessPeople.tenantId, tenantId),
              ilike(accessPeople.documentId, row.personDocumentId),
            ),
          )
          .limit(1);

        if (person) {
          personId = person.id;
        } else {
          errors.push({
            row: rowNum,
            reason: `Owner with document '${row.personDocumentId}' not found`,
            data: row as any,
          });
          continue;
        }
      }

      await db.insert(accessVehicles).values({
        tenantId,
        personId,
        plate: row.plate.trim().toUpperCase(),
        brand: row.brand || null,
        model: row.model || null,
        color: row.color || null,
        type: row.type || 'car',
        status: row.status || 'active',
      });

      imported++;
    } catch (err) {
      errors.push({
        row: rowNum,
        reason: err instanceof Error ? err.message : 'Unknown error',
        data: row as any,
      });
    }
  }

  return { total: records.length, imported, skipped, errors };
}

// ── Visitors Import ──────────────────────────────────────────

export async function importVisitors(
  tenantId: string,
  records: VisitorImportRow[],
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 1;

    try {
      if (!row.fullName?.trim()) {
        errors.push({ row: rowNum, reason: 'fullName is required', data: row as any });
        continue;
      }

      // Deduplication by documentId
      if (row.documentId) {
        const existing = await db
          .select({ id: visitors.id })
          .from(visitors)
          .where(
            and(
              eq(visitors.tenantId, tenantId),
              ilike(visitors.documentId, row.documentId),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }
      }

      await db.insert(visitors).values({
        tenantId,
        fullName: row.fullName.trim(),
        documentId: row.documentId || null,
        phone: row.phone || null,
        email: row.email || null,
        company: row.company || null,
        visitReason: row.visitReason || 'personal',
        hostName: row.hostName || null,
        hostUnit: row.hostUnit || null,
        hostPhone: row.hostPhone || null,
        notes: row.notes || null,
        isBlacklisted: false,
        visitCount: 0,
      });

      imported++;
    } catch (err) {
      errors.push({
        row: rowNum,
        reason: err instanceof Error ? err.message : 'Unknown error',
        data: row as any,
      });
    }
  }

  return { total: records.length, imported, skipped, errors };
}

// ── Devices Import ───────────────────────────────────────────

export async function importDevices(
  tenantId: string,
  records: DeviceImportRow[],
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 1;

    try {
      if (!row.name?.trim()) {
        errors.push({ row: rowNum, reason: 'name is required', data: row as any });
        continue;
      }
      if (!row.siteId) {
        errors.push({ row: rowNum, reason: 'siteId is required', data: row as any });
        continue;
      }

      // Deduplication by IP address within the same site
      if (row.ipAddress) {
        const existing = await db
          .select({ id: devices.id })
          .from(devices)
          .where(
            and(
              eq(devices.tenantId, tenantId),
              eq(devices.siteId, row.siteId),
              eq(devices.ipAddress, row.ipAddress),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }
      }

      // Deduplication by serial number
      if (row.serialNumber) {
        const existing = await db
          .select({ id: devices.id })
          .from(devices)
          .where(
            and(
              eq(devices.tenantId, tenantId),
              eq(devices.serialNumber, row.serialNumber),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }
      }

      await db.insert(devices).values({
        tenantId,
        siteId: row.siteId,
        name: row.name.trim(),
        type: row.type || 'camera',
        brand: row.brand || null,
        model: row.model || null,
        ipAddress: row.ipAddress || null,
        port: row.port || null,
        httpPort: row.httpPort || null,
        rtspPort: row.rtspPort || null,
        username: row.username || null,
        password: row.password || null,
        serialNumber: row.serialNumber || null,
        macAddress: row.macAddress || null,
        channels: row.channels || 1,
        notes: row.notes || null,
        status: 'unknown',
      });

      imported++;
    } catch (err) {
      errors.push({
        row: rowNum,
        reason: err instanceof Error ? err.message : 'Unknown error',
        data: row as any,
      });
    }
  }

  return { total: records.length, imported, skipped, errors };
}
