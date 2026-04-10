import { db } from '../../db/client.js';
import { sql, type SQL } from 'drizzle-orm';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'operational-data-service' });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface ListFilters extends PaginationParams {
  site_id?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface DateRangeFilters extends ListFilters {
  date_from?: string;
  date_to?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcOffset(page: number, limit: number): number {
  return (Math.max(1, page) - 1) * limit;
}

function sanitizeSort(column: string, allowed: string[]): string {
  return allowed.includes(column) ? column : allowed[0];
}

function sanitizeOrder(order?: string): string {
  return order === 'desc' ? 'DESC' : 'ASC';
}

/** Join an array of parameterized SQL conditions with AND */
function sqlAnd(conditions: SQL[]): SQL {
  if (conditions.length === 0) return sql`TRUE`;
  let result = conditions[0];
  for (let i = 1; i < conditions.length; i++) {
    result = sql`${result} AND ${conditions[i]}`;
  }
  return result;
}

/** Build a parameterized SET clause from key-value pairs. Keys must be from an allowlist. */
function sqlSetClauses(entries: Array<{ key: string; value: unknown; isBoolean?: boolean; isNumber?: boolean }>): SQL | null {
  if (entries.length === 0) return null;
  const parts: SQL[] = entries.map(({ key, value, isBoolean, isNumber }) => {
    if (value === null) return sql`${sql.raw(key)} = NULL`;
    if (isBoolean) return sql`${sql.raw(key)} = ${value === true}`;
    if (isNumber) return sql`${sql.raw(key)} = ${Number(value)}`;
    return sql`${sql.raw(key)} = ${String(value)}`;
  });
  parts.push(sql`updated_at = NOW()`);
  let result = parts[0];
  for (let i = 1; i < parts.length; i++) {
    result = sql`${result}, ${parts[i]}`;
  }
  return result;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class OperationalDataService {

  // ═══════════════════════════════════════════════════════════════════════════
  //  RESIDENTS
  // ═══════════════════════════════════════════════════════════════════════════

  async residentsList(tenantId: string, filters: ListFilters) {
    const { page = 1, limit = 50, site_id, search, sort_by, sort_order } = filters;
    const offset = calcOffset(page, limit);
    const col = sanitizeSort(sort_by ?? 'full_name', ['full_name', 'unit_number', 'created_at', 'updated_at', 'site_id']);
    const ord = sanitizeOrder(sort_order);

    const conditions: SQL[] = [sql`tenant_id = ${tenantId}`, sql`deleted_at IS NULL`];
    if (site_id) conditions.push(sql`site_id = ${site_id}`);
    if (search) conditions.push(sql`(full_name ILIKE ${'%' + search + '%'} OR unit_number ILIKE ${'%' + search + '%'})`);
    const where = sqlAnd(conditions);

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS total FROM residents WHERE ${where}`),
      db.execute(sql`SELECT * FROM residents WHERE ${where} ORDER BY ${sql.raw(col)} ${sql.raw(ord)} LIMIT ${limit} OFFSET ${offset}`),
    ]);

    const total = (countResult as unknown as Record<string, unknown>[])[0]?.total as number ?? 0;
    const data = dataResult as unknown as Record<string, unknown>[];
    logger.debug(`residents.list tenant=${tenantId} total=${total}`);
    return { data, total, page, limit };
  }

  async residentsGetById(id: string, tenantId: string) {
    const result = await db.execute(
      sql`SELECT * FROM residents WHERE id = ${id} AND tenant_id = ${tenantId} AND deleted_at IS NULL LIMIT 1`
    );
    const rows = result as unknown as Record<string, unknown>[];
    if (rows.length === 0) return null;
    return rows[0];
  }

  async residentsCreate(tenantId: string, data: Record<string, unknown>) {
    const result = await db.execute(sql`
      INSERT INTO residents (tenant_id, site_id, full_name, unit_number, phone, email, id_number, vehicle_plate, notes, status)
      VALUES (
        ${tenantId},
        ${data.site_id as string},
        ${data.full_name as string},
        ${data.unit_number as string ?? null},
        ${data.phone as string ?? null},
        ${data.email as string ?? null},
        ${data.id_number as string ?? null},
        ${data.vehicle_plate as string ?? null},
        ${data.notes as string ?? null},
        ${(data.status as string) ?? 'active'}
      )
      RETURNING *
    `);
    const rows = result as unknown as Record<string, unknown>[];
    logger.info(`residents.create tenant=${tenantId} id=${rows[0]?.id}`);
    return rows[0];
  }

  async residentsUpdate(id: string, tenantId: string, data: Record<string, unknown>) {
    const allowed = ['full_name', 'unit_number', 'phone', 'email', 'id_number', 'vehicle_plate', 'notes', 'status', 'site_id'];
    const entries: Array<{ key: string; value: unknown }> = [];
    for (const key of allowed) {
      if (data[key] !== undefined) entries.push({ key, value: data[key] === null ? null : String(data[key]) });
    }
    if (entries.length === 0) return this.residentsGetById(id, tenantId);
    const setCl = sqlSetClauses(entries)!;

    const result = await db.execute(
      sql`UPDATE residents SET ${setCl} WHERE id = ${id} AND tenant_id = ${tenantId} AND deleted_at IS NULL RETURNING *`
    );
    const rows = result as unknown as Record<string, unknown>[];
    if (rows.length === 0) return null;
    logger.info(`residents.update tenant=${tenantId} id=${id}`);
    return rows[0];
  }

  async residentsDelete(id: string, tenantId: string) {
    const result = await db.execute(sql`
      UPDATE residents SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId} AND deleted_at IS NULL
      RETURNING id
    `);
    const rows = result as unknown as Record<string, unknown>[];
    if (rows.length === 0) return false;
    logger.info(`residents.softDelete tenant=${tenantId} id=${id}`);
    return true;
  }

  async residentsStats(tenantId: string) {
    const result = await db.execute(sql`
      SELECT
        site_id,
        count(*)::int AS total,
        count(*) FILTER (WHERE status = 'active')::int AS active,
        count(*) FILTER (WHERE status = 'inactive')::int AS inactive
      FROM residents
      WHERE tenant_id = ${tenantId} AND deleted_at IS NULL
      GROUP BY site_id
    `);
    const rows = result as unknown as Record<string, unknown>[];

    const totalsResult = await db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status = 'active')::int AS active,
        count(*) FILTER (WHERE status = 'inactive')::int AS inactive
      FROM residents
      WHERE tenant_id = ${tenantId} AND deleted_at IS NULL
    `);
    const totals = (totalsResult as unknown as Record<string, unknown>[])[0] ?? { total: 0, active: 0, inactive: 0 };

    return { totals, by_site: rows };
  }

  async residentsSearch(tenantId: string, search: string) {
    const result = await db.execute(sql`
      SELECT * FROM residents
      WHERE tenant_id = ${tenantId}
        AND deleted_at IS NULL
        AND (full_name ILIKE ${'%' + search + '%'} OR unit_number ILIKE ${'%' + search + '%'})
      ORDER BY full_name ASC
      LIMIT 50
    `);
    return result as unknown as Record<string, unknown>[];
  }

  async residentsGroupedByModule(tenantId: string) {
    const rows = await db.execute(sql`
      SELECT r.*, s.name as site_name
      FROM residents r
      LEFT JOIN sites s ON s.id = r.site_id
      WHERE r.tenant_id = ${tenantId} AND r.deleted_at IS NULL
      ORDER BY s.name ASC, r.unit_number ASC
    `);

    const grouped: Record<string, Record<string, Record<string, unknown[]>>> = {};
    for (const row of rows.rows) {
      const siteName = (row as Record<string, unknown>).site_name as string ?? 'Sin sitio';
      const unitNumber = (row as Record<string, unknown>).unit_number as string ?? '';
      const parts = unitNumber.match(/^(.*?)(?:\s*-\s*(.*))?$/);
      const module = parts?.[1]?.trim() || 'General';
      const apartment = parts?.[2]?.trim() || unitNumber || 'Sin unidad';

      if (!grouped[siteName]) grouped[siteName] = {};
      if (!grouped[siteName][module]) grouped[siteName][module] = {};
      if (!grouped[siteName][module][apartment]) grouped[siteName][module][apartment] = [];
      grouped[siteName][module][apartment].push(row);
    }
    return grouped;
  }

  async residentsBulkImport(tenantId: string, records: Array<Record<string, unknown>>) {
    let imported = 0;
    let skipped = 0;
    const errors: Array<{ row: number; reason: string }> = [];

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const fullName = rec.full_name as string;
      const unitNumber = rec.unit_number as string;
      if (!fullName || !unitNumber) {
        errors.push({ row: i + 1, reason: 'full_name y unit_number son obligatorios' });
        skipped++;
        continue;
      }
      try {
        await db.execute(sql`
          INSERT INTO residents (tenant_id, site_id, full_name, unit_number, phone, email, id_number, vehicle_plate, notes, status)
          VALUES (${tenantId}, ${rec.site_id as string ?? null}, ${fullName}, ${unitNumber},
                  ${rec.phone as string ?? null}, ${rec.email as string ?? null},
                  ${rec.id_number as string ?? null}, ${rec.vehicle_plate as string ?? null},
                  ${rec.notes as string ?? null}, ${rec.status as string ?? 'active'})
        `);
        imported++;
      } catch (err) {
        errors.push({ row: i + 1, reason: (err as Error).message });
        skipped++;
      }
    }
    return { imported, skipped, errors };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  VEHICLES
  // ═══════════════════════════════════════════════════════════════════════════

  async vehiclesList(tenantId: string, filters: ListFilters) {
    const { page = 1, limit = 50, site_id, search, sort_by, sort_order } = filters;
    const offset = calcOffset(page, limit);
    const col = sanitizeSort(sort_by ?? 'plate', ['plate', 'brand', 'model', 'color', 'created_at', 'resident_id']);
    const ord = sanitizeOrder(sort_order);

    const conditions: SQL[] = [sql`tenant_id = ${tenantId}`, sql`deleted_at IS NULL`];
    if (site_id) conditions.push(sql`site_id = ${site_id}`);
    if (search) conditions.push(sql`(plate ILIKE ${'%' + search + '%'} OR brand ILIKE ${'%' + search + '%'} OR model ILIKE ${'%' + search + '%'})`);
    const where = sqlAnd(conditions);

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS total FROM vehicles WHERE ${where}`),
      db.execute(sql`SELECT * FROM vehicles WHERE ${where} ORDER BY ${sql.raw(col)} ${sql.raw(ord)} LIMIT ${limit} OFFSET ${offset}`),
    ]);

    const total = (countResult as unknown as Record<string, unknown>[])[0]?.total as number ?? 0;
    const data = dataResult as unknown as Record<string, unknown>[];
    return { data, total, page, limit };
  }

  async vehiclesGetById(id: string, tenantId: string) {
    const result = await db.execute(
      sql`SELECT * FROM vehicles WHERE id = ${id} AND tenant_id = ${tenantId} AND deleted_at IS NULL LIMIT 1`
    );
    const rows = result as unknown as Record<string, unknown>[];
    return rows.length > 0 ? rows[0] : null;
  }

  async vehiclesSearchByPlate(tenantId: string, plate: string) {
    const result = await db.execute(sql`
      SELECT v.*, r.full_name AS resident_name, r.unit_number AS resident_unit
      FROM vehicles v
      LEFT JOIN residents r ON r.id = v.resident_id AND r.deleted_at IS NULL
      WHERE v.tenant_id = ${tenantId}
        AND v.deleted_at IS NULL
        AND v.plate = ${plate.toUpperCase().trim()}
      LIMIT 5
    `);
    return result as unknown as Record<string, unknown>[];
  }

  async vehiclesCreate(tenantId: string, data: Record<string, unknown>) {
    const result = await db.execute(sql`
      INSERT INTO vehicles (tenant_id, site_id, resident_id, plate, brand, model, color, vehicle_type, notes, status)
      VALUES (
        ${tenantId},
        ${data.site_id as string},
        ${data.resident_id as string ?? null},
        ${(data.plate as string).toUpperCase().trim()},
        ${data.brand as string ?? null},
        ${data.model as string ?? null},
        ${data.color as string ?? null},
        ${data.vehicle_type as string ?? 'car'},
        ${data.notes as string ?? null},
        ${(data.status as string) ?? 'active'}
      )
      RETURNING *
    `);
    const rows = result as unknown as Record<string, unknown>[];
    logger.info(`vehicles.create tenant=${tenantId} plate=${data.plate}`);
    return rows[0];
  }

  async vehiclesUpdate(id: string, tenantId: string, data: Record<string, unknown>) {
    const allowed = ['plate', 'brand', 'model', 'color', 'vehicle_type', 'notes', 'status', 'site_id', 'resident_id'];
    const entries: Array<{ key: string; value: unknown }> = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        if (key === 'plate') {
          entries.push({ key, value: data[key] === null ? null : String(data[key]).toUpperCase().trim() });
        } else {
          entries.push({ key, value: data[key] === null ? null : String(data[key]) });
        }
      }
    }
    if (entries.length === 0) return this.vehiclesGetById(id, tenantId);
    const setCl = sqlSetClauses(entries)!;

    const result = await db.execute(
      sql`UPDATE vehicles SET ${setCl} WHERE id = ${id} AND tenant_id = ${tenantId} AND deleted_at IS NULL RETURNING *`
    );
    const rows = result as unknown as Record<string, unknown>[];
    if (rows.length === 0) return null;
    logger.info(`vehicles.update tenant=${tenantId} id=${id}`);
    return rows[0];
  }

  async vehiclesDelete(id: string, tenantId: string) {
    const result = await db.execute(sql`
      UPDATE vehicles SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId} AND deleted_at IS NULL
      RETURNING id
    `);
    const rows = result as unknown as Record<string, unknown>[];
    if (rows.length === 0) return false;
    logger.info(`vehicles.softDelete tenant=${tenantId} id=${id}`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  BIOMETRIC RECORDS
  // ═══════════════════════════════════════════════════════════════════════════

  async biometricRecordsList(tenantId: string, filters: ListFilters) {
    const { page = 1, limit = 50, site_id, search, sort_by, sort_order } = filters;
    const offset = calcOffset(page, limit);
    const col = sanitizeSort(sort_by ?? 'created_at', ['created_at', 'resident_name', 'biometric_type', 'site_id']);
    const ord = sanitizeOrder(sort_order);

    const conditions: SQL[] = [sql`tenant_id = ${tenantId}`];
    if (site_id) conditions.push(sql`site_id = ${site_id}`);
    if (search) conditions.push(sql`(resident_name ILIKE ${'%' + search + '%'})`);
    const where = sqlAnd(conditions);

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS total FROM biometric_records WHERE ${where}`),
      db.execute(sql`SELECT * FROM biometric_records WHERE ${where} ORDER BY ${sql.raw(col)} ${sql.raw(ord)} LIMIT ${limit} OFFSET ${offset}`),
    ]);

    const total = (countResult as unknown as Record<string, unknown>[])[0]?.total as number ?? 0;
    const data = dataResult as unknown as Record<string, unknown>[];
    return { data, total, page, limit };
  }

  async biometricRecordsCreate(tenantId: string, data: Record<string, unknown>) {
    const result = await db.execute(sql`
      INSERT INTO biometric_records (tenant_id, site_id, resident_id, resident_name, biometric_type, device_id, status, notes)
      VALUES (
        ${tenantId},
        ${data.site_id as string},
        ${data.resident_id as string ?? null},
        ${data.resident_name as string},
        ${data.biometric_type as string},
        ${data.device_id as string ?? null},
        ${(data.status as string) ?? 'enrolled'},
        ${data.notes as string ?? null}
      )
      RETURNING *
    `);
    const rows = result as unknown as Record<string, unknown>[];
    logger.info(`biometric_records.create tenant=${tenantId} id=${rows[0]?.id}`);
    return rows[0];
  }

  async biometricRecordsUpdate(id: string, tenantId: string, data: Record<string, unknown>) {
    const allowed = ['status', 'notes', 'biometric_type', 'device_id'];
    const entries: Array<{ key: string; value: unknown }> = [];
    for (const key of allowed) {
      if (data[key] !== undefined) entries.push({ key, value: data[key] === null ? null : String(data[key]) });
    }
    if (entries.length === 0) return null;
    const setCl = sqlSetClauses(entries)!;

    const result = await db.execute(
      sql`UPDATE biometric_records SET ${setCl} WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *`
    );
    const rows = result as unknown as Record<string, unknown>[];
    return rows.length > 0 ? rows[0] : null;
  }

  async biometricRecordsStats(tenantId: string) {
    const result = await db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE biometric_type = 'fingerprint')::int AS fingerprint,
        count(*) FILTER (WHERE biometric_type = 'face')::int AS face,
        count(*) FILTER (WHERE biometric_type = 'card')::int AS card,
        count(*) FILTER (WHERE status = 'enrolled')::int AS enrolled,
        count(*) FILTER (WHERE status = 'pending')::int AS pending,
        count(*) FILTER (WHERE status = 'failed')::int AS failed,
        count(DISTINCT site_id)::int AS sites_with_biometrics
      FROM biometric_records
      WHERE tenant_id = ${tenantId}
    `);
    const rows = result as unknown as Record<string, unknown>[];
    return rows[0] ?? { total: 0, fingerprint: 0, face: 0, card: 0, enrolled: 0, pending: 0, failed: 0, sites_with_biometrics: 0 };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CONSIGNAS
  // ═══════════════════════════════════════════════════════════════════════════

  async consignasList(tenantId: string, filters: ListFilters & { unit_number?: string }) {
    const { page = 1, limit = 50, site_id, search, sort_by, sort_order, unit_number } = filters;
    const offset = calcOffset(page, limit);
    const col = sanitizeSort(sort_by ?? 'created_at', ['created_at', 'unit_number', 'priority', 'status', 'site_id']);
    const ord = sanitizeOrder(sort_order);

    const conditions: SQL[] = [sql`tenant_id = ${tenantId}`, sql`deleted_at IS NULL`];
    if (site_id) conditions.push(sql`site_id = ${site_id}`);
    if (unit_number) conditions.push(sql`unit_number = ${unit_number}`);
    if (search) conditions.push(sql`(description ILIKE ${'%' + search + '%'} OR unit_number ILIKE ${'%' + search + '%'})`);
    const where = sqlAnd(conditions);

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS total FROM consignas WHERE ${where}`),
      db.execute(sql`SELECT * FROM consignas WHERE ${where} ORDER BY ${sql.raw(col)} ${sql.raw(ord)} LIMIT ${limit} OFFSET ${offset}`),
    ]);

    const total = (countResult as unknown as Record<string, unknown>[])[0]?.total as number ?? 0;
    const data = dataResult as unknown as Record<string, unknown>[];
    return { data, total, page, limit };
  }

  async consignasCreate(tenantId: string, data: Record<string, unknown>) {
    const result = await db.execute(sql`
      INSERT INTO consignas (tenant_id, site_id, unit_number, description, priority, status, created_by, valid_from, valid_until)
      VALUES (
        ${tenantId},
        ${data.site_id as string},
        ${data.unit_number as string ?? null},
        ${data.description as string},
        ${(data.priority as string) ?? 'normal'},
        ${(data.status as string) ?? 'active'},
        ${data.created_by as string ?? null},
        ${data.valid_from as string ?? null},
        ${data.valid_until as string ?? null}
      )
      RETURNING *
    `);
    const rows = result as unknown as Record<string, unknown>[];
    logger.info(`consignas.create tenant=${tenantId} id=${rows[0]?.id}`);
    return rows[0];
  }

  async consignasUpdate(id: string, tenantId: string, data: Record<string, unknown>) {
    const allowed = ['unit_number', 'description', 'priority', 'status', 'site_id', 'valid_from', 'valid_until'];
    const entries: Array<{ key: string; value: unknown }> = [];
    for (const key of allowed) {
      if (data[key] !== undefined) entries.push({ key, value: data[key] === null ? null : String(data[key]) });
    }
    if (entries.length === 0) return null;
    const setCl = sqlSetClauses(entries)!;

    const result = await db.execute(
      sql`UPDATE consignas SET ${setCl} WHERE id = ${id} AND tenant_id = ${tenantId} AND deleted_at IS NULL RETURNING *`
    );
    const rows = result as unknown as Record<string, unknown>[];
    return rows.length > 0 ? rows[0] : null;
  }

  async consignasDelete(id: string, tenantId: string) {
    const result = await db.execute(sql`
      UPDATE consignas SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId} AND deleted_at IS NULL
      RETURNING id
    `);
    const rows = result as unknown as Record<string, unknown>[];
    if (rows.length === 0) return false;
    logger.info(`consignas.softDelete tenant=${tenantId} id=${id}`);
    return true;
  }

  async consignasGetByUnit(tenantId: string, unitNumber: string, siteId?: string) {
    const conditions = [
      sql`tenant_id = ${tenantId}`,
      sql`deleted_at IS NULL`,
      sql`status = 'active'`,
      sql`unit_number = ${unitNumber}`,
    ];
    if (siteId) conditions.push(sql`site_id = ${siteId}`);

    const result = await db.execute(sql`
      SELECT * FROM consignas
      WHERE tenant_id = ${tenantId}
        AND deleted_at IS NULL
        AND status = 'active'
        AND unit_number = ${unitNumber}
      ORDER BY priority DESC, created_at DESC
    `);
    return result as unknown as Record<string, unknown>[];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SITE ADMINISTRATORS
  // ═══════════════════════════════════════════════════════════════════════════

  async siteAdministratorsList(tenantId: string, filters: ListFilters) {
    const { page = 1, limit = 50, site_id, search, sort_by, sort_order } = filters;
    const offset = calcOffset(page, limit);
    const col = sanitizeSort(sort_by ?? 'full_name', ['full_name', 'role', 'created_at', 'site_id']);
    const ord = sanitizeOrder(sort_order);

    const conditions: SQL[] = [sql`tenant_id = ${tenantId}`];
    if (site_id) conditions.push(sql`site_id = ${site_id}`);
    if (search) conditions.push(sql`(full_name ILIKE ${'%' + search + '%'} OR email ILIKE ${'%' + search + '%'})`);
    const where = sqlAnd(conditions);

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS total FROM site_administrators WHERE ${where}`),
      db.execute(sql`SELECT * FROM site_administrators WHERE ${where} ORDER BY ${sql.raw(col)} ${sql.raw(ord)} LIMIT ${limit} OFFSET ${offset}`),
    ]);

    const total = (countResult as unknown as Record<string, unknown>[])[0]?.total as number ?? 0;
    const data = dataResult as unknown as Record<string, unknown>[];
    return { data, total, page, limit };
  }

  async siteAdministratorsCreate(tenantId: string, data: Record<string, unknown>) {
    const result = await db.execute(sql`
      INSERT INTO site_administrators (tenant_id, site_id, full_name, phone, email, role, id_number, notes, status)
      VALUES (
        ${tenantId},
        ${data.site_id as string},
        ${data.full_name as string},
        ${data.phone as string ?? null},
        ${data.email as string ?? null},
        ${(data.role as string) ?? 'administrator'},
        ${data.id_number as string ?? null},
        ${data.notes as string ?? null},
        ${(data.status as string) ?? 'active'}
      )
      RETURNING *
    `);
    const rows = result as unknown as Record<string, unknown>[];
    logger.info(`site_administrators.create tenant=${tenantId} id=${rows[0]?.id}`);
    return rows[0];
  }

  async siteAdministratorsUpdate(id: string, tenantId: string, data: Record<string, unknown>) {
    const allowed = ['full_name', 'phone', 'email', 'role', 'id_number', 'notes', 'status', 'site_id'];
    const entries: Array<{ key: string; value: unknown }> = [];
    for (const key of allowed) {
      if (data[key] !== undefined) entries.push({ key, value: data[key] === null ? null : String(data[key]) });
    }
    if (entries.length === 0) return null;
    const setCl = sqlSetClauses(entries)!;

    const result = await db.execute(
      sql`UPDATE site_administrators SET ${setCl} WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *`
    );
    const rows = result as unknown as Record<string, unknown>[];
    return rows.length > 0 ? rows[0] : null;
  }

  async siteAdministratorsDelete(id: string, tenantId: string) {
    const result = await db.execute(sql`
      DELETE FROM site_administrators WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id
    `);
    const rows = result as unknown as Record<string, unknown>[];
    if (rows.length === 0) return false;
    logger.info(`site_administrators.delete tenant=${tenantId} id=${id}`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SIREN TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  async sirenTestsList(tenantId: string, filters: DateRangeFilters & { result?: string }) {
    const { page = 1, limit = 50, site_id, sort_by, sort_order, date_from, date_to, result: testResult } = filters;
    const offset = calcOffset(page, limit);
    const col = sanitizeSort(sort_by ?? 'tested_at', ['tested_at', 'site_id', 'result', 'created_at']);
    const ord = sanitizeOrder(sort_order);

    const conditions: SQL[] = [sql`tenant_id = ${tenantId}`];
    if (site_id) conditions.push(sql`site_id = ${site_id}`);
    if (testResult) conditions.push(sql`result = ${testResult}`);
    if (date_from) conditions.push(sql`tested_at >= ${date_from}`);
    if (date_to) conditions.push(sql`tested_at <= ${date_to}`);
    const where = sqlAnd(conditions);

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS total FROM siren_tests WHERE ${where}`),
      db.execute(sql`SELECT * FROM siren_tests WHERE ${where} ORDER BY ${sql.raw(col)} ${sql.raw(ord)} LIMIT ${limit} OFFSET ${offset}`),
    ]);

    const total = (countResult as unknown as Record<string, unknown>[])[0]?.total as number ?? 0;
    const data = dataResult as unknown as Record<string, unknown>[];
    return { data, total, page, limit };
  }

  async sirenTestsCreate(tenantId: string, data: Record<string, unknown>) {
    const result = await db.execute(sql`
      INSERT INTO siren_tests (tenant_id, site_id, tested_at, tested_by, result, siren_location, notes)
      VALUES (
        ${tenantId},
        ${data.site_id as string},
        ${(data.tested_at as string) ?? new Date().toISOString()},
        ${data.tested_by as string ?? null},
        ${(data.result as string) ?? 'ok'},
        ${data.siren_location as string ?? null},
        ${data.notes as string ?? null}
      )
      RETURNING *
    `);
    const rows = result as unknown as Record<string, unknown>[];
    logger.info(`siren_tests.create tenant=${tenantId} id=${rows[0]?.id}`);
    return rows[0];
  }

  async sirenTestsStats(tenantId: string) {
    const result = await db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE result = 'ok')::int AS ok_count,
        count(*) FILTER (WHERE result = 'fail')::int AS fail_count,
        count(*) FILTER (WHERE result NOT IN ('ok', 'fail'))::int AS other_count,
        count(DISTINCT site_id)::int AS sites_tested,
        max(tested_at) AS last_test_at
      FROM siren_tests
      WHERE tenant_id = ${tenantId}
    `);
    const rows = result as unknown as Record<string, unknown>[];
    return rows[0] ?? { total: 0, ok_count: 0, fail_count: 0, other_count: 0, sites_tested: 0, last_test_at: null };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  EQUIPMENT RESTARTS
  // ═══════════════════════════════════════════════════════════════════════════

  async equipmentRestartsList(tenantId: string, filters: DateRangeFilters) {
    const { page = 1, limit = 50, site_id, sort_by, sort_order, date_from, date_to } = filters;
    const offset = calcOffset(page, limit);
    const col = sanitizeSort(sort_by ?? 'restarted_at', ['restarted_at', 'site_id', 'equipment_name', 'created_at']);
    const ord = sanitizeOrder(sort_order);

    const conditions: SQL[] = [sql`tenant_id = ${tenantId}`];
    if (site_id) conditions.push(sql`site_id = ${site_id}`);
    if (date_from) conditions.push(sql`restarted_at >= ${date_from}`);
    if (date_to) conditions.push(sql`restarted_at <= ${date_to}`);
    const where = sqlAnd(conditions);

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS total FROM equipment_restarts WHERE ${where}`),
      db.execute(sql`SELECT * FROM equipment_restarts WHERE ${where} ORDER BY ${sql.raw(col)} ${sql.raw(ord)} LIMIT ${limit} OFFSET ${offset}`),
    ]);

    const total = (countResult as unknown as Record<string, unknown>[])[0]?.total as number ?? 0;
    const data = dataResult as unknown as Record<string, unknown>[];
    return { data, total, page, limit };
  }

  async equipmentRestartsCreate(tenantId: string, data: Record<string, unknown>) {
    const result = await db.execute(sql`
      INSERT INTO equipment_restarts (tenant_id, site_id, equipment_name, equipment_type, restarted_at, restarted_by, reason, notes)
      VALUES (
        ${tenantId},
        ${data.site_id as string},
        ${data.equipment_name as string},
        ${data.equipment_type as string ?? null},
        ${(data.restarted_at as string) ?? new Date().toISOString()},
        ${data.restarted_by as string ?? null},
        ${data.reason as string ?? null},
        ${data.notes as string ?? null}
      )
      RETURNING *
    `);
    const rows = result as unknown as Record<string, unknown>[];
    logger.info(`equipment_restarts.create tenant=${tenantId} id=${rows[0]?.id}`);
    return rows[0];
  }

  async equipmentRestartsStats(tenantId: string) {
    const result = await db.execute(sql`
      SELECT
        count(*)::int AS total,
        count(DISTINCT site_id)::int AS sites_with_restarts,
        count(DISTINCT equipment_name)::int AS unique_equipment,
        count(*) FILTER (WHERE restarted_at >= NOW() - INTERVAL '7 days')::int AS last_7_days,
        count(*) FILTER (WHERE restarted_at >= NOW() - INTERVAL '30 days')::int AS last_30_days
      FROM equipment_restarts
      WHERE tenant_id = ${tenantId}
    `);
    const rows = result as unknown as Record<string, unknown>[];
    return rows[0] ?? { total: 0, sites_with_restarts: 0, unique_equipment: 0, last_7_days: 0, last_30_days: 0 };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SITE DOOR INVENTORY
  // ═══════════════════════════════════════════════════════════════════════════

  async siteDoorInventoryList(tenantId: string, filters: ListFilters) {
    const { page = 1, limit = 50, site_id, search, sort_by, sort_order } = filters;
    const offset = calcOffset(page, limit);
    const col = sanitizeSort(sort_by ?? 'door_name', ['door_name', 'door_type', 'floor', 'created_at', 'site_id']);
    const ord = sanitizeOrder(sort_order);

    const conditions: SQL[] = [sql`tenant_id = ${tenantId}`];
    if (site_id) conditions.push(sql`site_id = ${site_id}`);
    if (search) conditions.push(sql`(door_name ILIKE ${'%' + search + '%'} OR location_description ILIKE ${'%' + search + '%'})`);
    const where = sqlAnd(conditions);

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS total FROM site_door_inventory WHERE ${where}`),
      db.execute(sql`SELECT * FROM site_door_inventory WHERE ${where} ORDER BY ${sql.raw(col)} ${sql.raw(ord)} LIMIT ${limit} OFFSET ${offset}`),
    ]);

    const total = (countResult as unknown as Record<string, unknown>[])[0]?.total as number ?? 0;
    const data = dataResult as unknown as Record<string, unknown>[];
    return { data, total, page, limit };
  }

  async siteDoorInventoryCreate(tenantId: string, data: Record<string, unknown>) {
    const result = await db.execute(sql`
      INSERT INTO site_door_inventory (tenant_id, site_id, door_name, door_type, floor, location_description, access_control_type, has_camera, notes, status)
      VALUES (
        ${tenantId},
        ${data.site_id as string},
        ${data.door_name as string},
        ${data.door_type as string ?? null},
        ${data.floor as string ?? null},
        ${data.location_description as string ?? null},
        ${data.access_control_type as string ?? null},
        ${(data.has_camera as boolean) ?? false},
        ${data.notes as string ?? null},
        ${(data.status as string) ?? 'active'}
      )
      RETURNING *
    `);
    const rows = result as unknown as Record<string, unknown>[];
    logger.info(`site_door_inventory.create tenant=${tenantId} id=${rows[0]?.id}`);
    return rows[0];
  }

  async siteDoorInventoryUpdate(id: string, tenantId: string, data: Record<string, unknown>) {
    const allowed = ['door_name', 'door_type', 'floor', 'location_description', 'access_control_type', 'has_camera', 'notes', 'status', 'site_id'];
    const entries: Array<{ key: string; value: unknown; isBoolean?: boolean }> = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        if (key === 'has_camera') {
          entries.push({ key, value: data[key] === true, isBoolean: true });
        } else {
          entries.push({ key, value: data[key] === null ? null : String(data[key]) });
        }
      }
    }
    if (entries.length === 0) return null;
    const setCl = sqlSetClauses(entries)!;

    const result = await db.execute(
      sql`UPDATE site_door_inventory SET ${setCl} WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *`
    );
    const rows = result as unknown as Record<string, unknown>[];
    return rows.length > 0 ? rows[0] : null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ELEVATOR INFO
  // ═══════════════════════════════════════════════════════════════════════════

  async elevatorInfoList(tenantId: string, filters: ListFilters) {
    const { page = 1, limit = 50, site_id, search, sort_by, sort_order } = filters;
    const offset = calcOffset(page, limit);
    const col = sanitizeSort(sort_by ?? 'elevator_name', ['elevator_name', 'brand', 'last_maintenance', 'created_at', 'site_id']);
    const ord = sanitizeOrder(sort_order);

    const conditions: SQL[] = [sql`tenant_id = ${tenantId}`];
    if (site_id) conditions.push(sql`site_id = ${site_id}`);
    if (search) conditions.push(sql`(elevator_name ILIKE ${'%' + search + '%'} OR brand ILIKE ${'%' + search + '%'})`);
    const where = sqlAnd(conditions);

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS total FROM elevator_info WHERE ${where}`),
      db.execute(sql`SELECT * FROM elevator_info WHERE ${where} ORDER BY ${sql.raw(col)} ${sql.raw(ord)} LIMIT ${limit} OFFSET ${offset}`),
    ]);

    const total = (countResult as unknown as Record<string, unknown>[])[0]?.total as number ?? 0;
    const data = dataResult as unknown as Record<string, unknown>[];
    return { data, total, page, limit };
  }

  async elevatorInfoCreate(tenantId: string, data: Record<string, unknown>) {
    const result = await db.execute(sql`
      INSERT INTO elevator_info (tenant_id, site_id, elevator_name, brand, model, capacity, floors_served, last_maintenance, next_maintenance, maintenance_company, emergency_phone, notes, status)
      VALUES (
        ${tenantId},
        ${data.site_id as string},
        ${data.elevator_name as string},
        ${data.brand as string ?? null},
        ${data.model as string ?? null},
        ${data.capacity as string ?? null},
        ${data.floors_served as string ?? null},
        ${data.last_maintenance as string ?? null},
        ${data.next_maintenance as string ?? null},
        ${data.maintenance_company as string ?? null},
        ${data.emergency_phone as string ?? null},
        ${data.notes as string ?? null},
        ${(data.status as string) ?? 'active'}
      )
      RETURNING *
    `);
    const rows = result as unknown as Record<string, unknown>[];
    logger.info(`elevator_info.create tenant=${tenantId} id=${rows[0]?.id}`);
    return rows[0];
  }

  async elevatorInfoUpdate(id: string, tenantId: string, data: Record<string, unknown>) {
    const allowed = ['elevator_name', 'brand', 'model', 'capacity', 'floors_served', 'last_maintenance', 'next_maintenance', 'maintenance_company', 'emergency_phone', 'notes', 'status', 'site_id'];
    const entries: Array<{ key: string; value: unknown }> = [];
    for (const key of allowed) {
      if (data[key] !== undefined) entries.push({ key, value: data[key] === null ? null : String(data[key]) });
    }
    if (entries.length === 0) return null;
    const setCl = sqlSetClauses(entries)!;

    const result = await db.execute(
      sql`UPDATE elevator_info SET ${setCl} WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *`
    );
    const rows = result as unknown as Record<string, unknown>[];
    return rows.length > 0 ? rows[0] : null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  GUARD SCHEDULES
  // ═══════════════════════════════════════════════════════════════════════════

  async guardSchedulesList(tenantId: string, filters: ListFilters) {
    const { page = 1, limit = 50, site_id, search, sort_by, sort_order } = filters;
    const offset = calcOffset(page, limit);
    const col = sanitizeSort(sort_by ?? 'guard_name', ['guard_name', 'shift_start', 'shift_end', 'day_of_week', 'created_at', 'site_id']);
    const ord = sanitizeOrder(sort_order);

    const conditions: SQL[] = [sql`tenant_id = ${tenantId}`];
    if (site_id) conditions.push(sql`site_id = ${site_id}`);
    if (search) conditions.push(sql`(guard_name ILIKE ${'%' + search + '%'})`);
    const where = sqlAnd(conditions);

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS total FROM guard_schedules WHERE ${where}`),
      db.execute(sql`SELECT * FROM guard_schedules WHERE ${where} ORDER BY ${sql.raw(col)} ${sql.raw(ord)} LIMIT ${limit} OFFSET ${offset}`),
    ]);

    const total = (countResult as unknown as Record<string, unknown>[])[0]?.total as number ?? 0;
    const data = dataResult as unknown as Record<string, unknown>[];
    return { data, total, page, limit };
  }

  async guardSchedulesCreate(tenantId: string, data: Record<string, unknown>) {
    const result = await db.execute(sql`
      INSERT INTO guard_schedules (tenant_id, site_id, guard_name, guard_id_number, shift_start, shift_end, day_of_week, post_location, phone, company, notes)
      VALUES (
        ${tenantId},
        ${data.site_id as string},
        ${data.guard_name as string},
        ${data.guard_id_number as string ?? null},
        ${data.shift_start as string},
        ${data.shift_end as string},
        ${data.day_of_week as string ?? null},
        ${data.post_location as string ?? null},
        ${data.phone as string ?? null},
        ${data.company as string ?? null},
        ${data.notes as string ?? null}
      )
      RETURNING *
    `);
    const rows = result as unknown as Record<string, unknown>[];
    logger.info(`guard_schedules.create tenant=${tenantId} id=${rows[0]?.id}`);
    return rows[0];
  }

  async guardSchedulesUpdate(id: string, tenantId: string, data: Record<string, unknown>) {
    const allowed = ['guard_name', 'guard_id_number', 'shift_start', 'shift_end', 'day_of_week', 'post_location', 'phone', 'company', 'notes', 'site_id'];
    const entries: Array<{ key: string; value: unknown }> = [];
    for (const key of allowed) {
      if (data[key] !== undefined) entries.push({ key, value: data[key] === null ? null : String(data[key]) });
    }
    if (entries.length === 0) return null;
    const setCl = sqlSetClauses(entries)!;

    const result = await db.execute(
      sql`UPDATE guard_schedules SET ${setCl} WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *`
    );
    const rows = result as unknown as Record<string, unknown>[];
    return rows.length > 0 ? rows[0] : null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  MONITORING CREDENTIALS
  // ═══════════════════════════════════════════════════════════════════════════

  async monitoringCredentialsList(tenantId: string, filters: ListFilters) {
    const { page = 1, limit = 50, site_id, search, sort_by, sort_order } = filters;
    const offset = calcOffset(page, limit);
    const col = sanitizeSort(sort_by ?? 'service_name', ['service_name', 'platform', 'created_at', 'site_id']);
    const ord = sanitizeOrder(sort_order);

    const conditions: SQL[] = [sql`tenant_id = ${tenantId}`];
    if (site_id) conditions.push(sql`site_id = ${site_id}`);
    if (search) conditions.push(sql`(service_name ILIKE ${'%' + search + '%'} OR platform ILIKE ${'%' + search + '%'})`);
    const where = sqlAnd(conditions);

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS total FROM monitoring_credentials WHERE ${where}`),
      db.execute(sql`SELECT id, tenant_id, site_id, service_name, platform, username, url, port, notes, status, created_at, updated_at FROM monitoring_credentials WHERE ${where} ORDER BY ${sql.raw(col)} ${sql.raw(ord)} LIMIT ${limit} OFFSET ${offset}`),
    ]);

    const total = (countResult as unknown as Record<string, unknown>[])[0]?.total as number ?? 0;
    const data = dataResult as unknown as Record<string, unknown>[];
    return { data, total, page, limit };
  }

  async monitoringCredentialsCreate(tenantId: string, data: Record<string, unknown>) {
    const result = await db.execute(sql`
      INSERT INTO monitoring_credentials (tenant_id, site_id, service_name, platform, username, password, url, port, notes, status)
      VALUES (
        ${tenantId},
        ${data.site_id as string},
        ${data.service_name as string},
        ${data.platform as string ?? null},
        ${data.username as string ?? null},
        ${data.password as string ?? null},
        ${data.url as string ?? null},
        ${data.port as string ?? null},
        ${data.notes as string ?? null},
        ${(data.status as string) ?? 'active'}
      )
      RETURNING id, tenant_id, site_id, service_name, platform, username, url, port, notes, status, created_at, updated_at
    `);
    const rows = result as unknown as Record<string, unknown>[];
    logger.info(`monitoring_credentials.create tenant=${tenantId} id=${rows[0]?.id}`);
    return rows[0];
  }

  async monitoringCredentialsUpdate(id: string, tenantId: string, data: Record<string, unknown>) {
    const allowed = ['service_name', 'platform', 'username', 'password', 'url', 'port', 'notes', 'status', 'site_id'];
    const entries: Array<{ key: string; value: unknown }> = [];
    for (const key of allowed) {
      if (data[key] !== undefined) entries.push({ key, value: data[key] === null ? null : String(data[key]) });
    }
    if (entries.length === 0) return null;
    const setCl = sqlSetClauses(entries)!;

    const result = await db.execute(
      sql`UPDATE monitoring_credentials SET ${setCl} WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING id, tenant_id, site_id, service_name, platform, username, url, port, notes, status, created_at, updated_at`
    );
    const rows = result as unknown as Record<string, unknown>[];
    return rows.length > 0 ? rows[0] : null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  OPERATOR TRAININGS
  // ═══════════════════════════════════════════════════════════════════════════

  async operatorTrainingsList(tenantId: string, filters: ListFilters) {
    const { page = 1, limit = 50, site_id, search, sort_by, sort_order } = filters;
    const offset = calcOffset(page, limit);
    const col = sanitizeSort(sort_by ?? 'training_date', ['training_date', 'operator_name', 'topic', 'created_at', 'site_id']);
    const ord = sanitizeOrder(sort_order);

    const conditions: SQL[] = [sql`tenant_id = ${tenantId}`];
    if (site_id) conditions.push(sql`site_id = ${site_id}`);
    if (search) conditions.push(sql`(operator_name ILIKE ${'%' + search + '%'} OR topic ILIKE ${'%' + search + '%'})`);
    const where = sqlAnd(conditions);

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS total FROM operator_trainings WHERE ${where}`),
      db.execute(sql`SELECT * FROM operator_trainings WHERE ${where} ORDER BY ${sql.raw(col)} ${sql.raw(ord)} LIMIT ${limit} OFFSET ${offset}`),
    ]);

    const total = (countResult as unknown as Record<string, unknown>[])[0]?.total as number ?? 0;
    const data = dataResult as unknown as Record<string, unknown>[];
    return { data, total, page, limit };
  }

  async operatorTrainingsCreate(tenantId: string, data: Record<string, unknown>) {
    const result = await db.execute(sql`
      INSERT INTO operator_trainings (tenant_id, site_id, operator_name, operator_id, topic, training_date, duration_minutes, trainer, score, passed, notes)
      VALUES (
        ${tenantId},
        ${data.site_id as string ?? null},
        ${data.operator_name as string},
        ${data.operator_id as string ?? null},
        ${data.topic as string},
        ${(data.training_date as string) ?? new Date().toISOString()},
        ${data.duration_minutes as number ?? null},
        ${data.trainer as string ?? null},
        ${data.score as number ?? null},
        ${(data.passed as boolean) ?? true},
        ${data.notes as string ?? null}
      )
      RETURNING *
    `);
    const rows = result as unknown as Record<string, unknown>[];
    logger.info(`operator_trainings.create tenant=${tenantId} id=${rows[0]?.id}`);
    return rows[0];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SITE CCTV DESCRIPTION
  // ═══════════════════════════════════════════════════════════════════════════

  async siteCctvDescriptionList(tenantId: string, filters: ListFilters) {
    const { page = 1, limit = 50, site_id, search, sort_by, sort_order } = filters;
    const offset = calcOffset(page, limit);
    const col = sanitizeSort(sort_by ?? 'camera_name', ['camera_name', 'location', 'camera_type', 'created_at', 'site_id']);
    const ord = sanitizeOrder(sort_order);

    const conditions: SQL[] = [sql`tenant_id = ${tenantId}`];
    if (site_id) conditions.push(sql`site_id = ${site_id}`);
    if (search) conditions.push(sql`(camera_name ILIKE ${'%' + search + '%'} OR location ILIKE ${'%' + search + '%'})`);
    const where = sqlAnd(conditions);

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS total FROM site_cctv_description WHERE ${where}`),
      db.execute(sql`SELECT * FROM site_cctv_description WHERE ${where} ORDER BY ${sql.raw(col)} ${sql.raw(ord)} LIMIT ${limit} OFFSET ${offset}`),
    ]);

    const total = (countResult as unknown as Record<string, unknown>[])[0]?.total as number ?? 0;
    const data = dataResult as unknown as Record<string, unknown>[];
    return { data, total, page, limit };
  }

  async siteCctvDescriptionCreate(tenantId: string, data: Record<string, unknown>) {
    const result = await db.execute(sql`
      INSERT INTO site_cctv_description (tenant_id, site_id, camera_name, location, camera_type, brand, model, resolution, has_night_vision, has_audio, recording_mode, storage_days, notes, status)
      VALUES (
        ${tenantId},
        ${data.site_id as string},
        ${data.camera_name as string},
        ${data.location as string ?? null},
        ${data.camera_type as string ?? null},
        ${data.brand as string ?? null},
        ${data.model as string ?? null},
        ${data.resolution as string ?? null},
        ${(data.has_night_vision as boolean) ?? false},
        ${(data.has_audio as boolean) ?? false},
        ${data.recording_mode as string ?? null},
        ${data.storage_days as number ?? null},
        ${data.notes as string ?? null},
        ${(data.status as string) ?? 'active'}
      )
      RETURNING *
    `);
    const rows = result as unknown as Record<string, unknown>[];
    logger.info(`site_cctv_description.create tenant=${tenantId} id=${rows[0]?.id}`);
    return rows[0];
  }

  async siteCctvDescriptionUpdate(id: string, tenantId: string, data: Record<string, unknown>) {
    const allowed = ['camera_name', 'location', 'camera_type', 'brand', 'model', 'resolution', 'has_night_vision', 'has_audio', 'recording_mode', 'storage_days', 'notes', 'status', 'site_id'];
    const entries: Array<{ key: string; value: unknown; isBoolean?: boolean; isNumber?: boolean }> = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        if (key === 'has_night_vision' || key === 'has_audio') {
          entries.push({ key, value: data[key] === true, isBoolean: true });
        } else if (key === 'storage_days') {
          entries.push({ key, value: data[key] === null ? null : data[key], isNumber: true });
        } else {
          entries.push({ key, value: data[key] === null ? null : String(data[key]) });
        }
      }
    }
    if (entries.length === 0) return null;
    const setCl = sqlSetClauses(entries)!;

    const result = await db.execute(
      sql`UPDATE site_cctv_description SET ${setCl} WHERE id = ${id} AND tenant_id = ${tenantId} RETURNING *`
    );
    const rows = result as unknown as Record<string, unknown>[];
    return rows.length > 0 ? rows[0] : null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  OVERALL STATS
  // ═══════════════════════════════════════════════════════════════════════════

  async overallStats(tenantId: string) {
    const result = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM residents WHERE tenant_id = ${tenantId} AND deleted_at IS NULL) AS residents_count,
        (SELECT count(*)::int FROM vehicles WHERE tenant_id = ${tenantId} AND deleted_at IS NULL) AS vehicles_count,
        (SELECT count(*)::int FROM biometric_records WHERE tenant_id = ${tenantId}) AS biometric_records_count,
        (SELECT count(*)::int FROM consignas WHERE tenant_id = ${tenantId} AND deleted_at IS NULL) AS consignas_count,
        (SELECT count(*)::int FROM site_administrators WHERE tenant_id = ${tenantId}) AS site_administrators_count,
        (SELECT count(*)::int FROM siren_tests WHERE tenant_id = ${tenantId}) AS siren_tests_count,
        (SELECT count(*)::int FROM equipment_restarts WHERE tenant_id = ${tenantId}) AS equipment_restarts_count,
        (SELECT count(*)::int FROM site_door_inventory WHERE tenant_id = ${tenantId}) AS door_inventory_count,
        (SELECT count(*)::int FROM elevator_info WHERE tenant_id = ${tenantId}) AS elevator_info_count,
        (SELECT count(*)::int FROM guard_schedules WHERE tenant_id = ${tenantId}) AS guard_schedules_count,
        (SELECT count(*)::int FROM monitoring_credentials WHERE tenant_id = ${tenantId}) AS monitoring_credentials_count,
        (SELECT count(*)::int FROM operator_trainings WHERE tenant_id = ${tenantId}) AS operator_trainings_count,
        (SELECT count(*)::int FROM site_cctv_description WHERE tenant_id = ${tenantId}) AS cctv_descriptions_count
    `);
    const rows = result as unknown as Record<string, unknown>[];
    return rows[0] ?? {};
  }
}

export const operationalDataService = new OperationalDataService();
