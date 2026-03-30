/**
 * Visitor Pre-registration Service
 *
 * Allows residents to pre-register visitors so they get automatic access
 * upon arrival (validated by name, document, or vehicle plate).
 *
 * Uses PostgreSQL table `visitor_preregistrations` with raw SQL via drizzle.
 */
import { createLogger } from '@aion/common-utils';
import { db } from '../db/client.js';
import { sql } from 'drizzle-orm';

const logger = createLogger({ name: 'visitor-preregistration' });

// ── Types ────────────────────────────────────────────────────────────────────

export type AccessType = 'one_time' | 'recurring' | 'permanent';
export type PreregistrationStatus = 'active' | 'used' | 'expired' | 'cancelled';

export interface VisitorPreregistration {
  id: string;
  site_id: string;
  resident_id: string;
  unit_number: string;
  visitor_name: string;
  visitor_document: string | null;
  visitor_plate: string | null;
  valid_from: string;
  valid_until: string | null;
  access_type: AccessType;
  status: PreregistrationStatus;
  created_at: string;
}

export interface CreatePreregistrationInput {
  site_id: string;
  resident_id: string;
  unit_number: string;
  visitor_name: string;
  visitor_document?: string | null;
  visitor_plate?: string | null;
  valid_from?: string;
  valid_until?: string | null;
  access_type?: AccessType;
}

export interface ValidationResult {
  valid: boolean;
  preregistration: VisitorPreregistration | null;
  message: string;
}

// ── Ensure table exists ──────────────────────────────────────────────────────

let tableEnsured = false;

async function ensureTable(): Promise<void> {
  if (tableEnsured) return;

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS visitor_preregistrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        site_id UUID NOT NULL,
        resident_id UUID NOT NULL,
        unit_number VARCHAR(50) NOT NULL,
        visitor_name VARCHAR(255) NOT NULL,
        visitor_document VARCHAR(100),
        visitor_plate VARCHAR(20),
        valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        valid_until TIMESTAMPTZ,
        access_type VARCHAR(20) NOT NULL DEFAULT 'one_time',
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT chk_access_type CHECK (access_type IN ('one_time', 'recurring', 'permanent')),
        CONSTRAINT chk_status CHECK (status IN ('active', 'used', 'expired', 'cancelled'))
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_visitor_prereg_site
        ON visitor_preregistrations(site_id, status)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_visitor_prereg_unit
        ON visitor_preregistrations(site_id, unit_number, status)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_visitor_prereg_document
        ON visitor_preregistrations(visitor_document, site_id) WHERE visitor_document IS NOT NULL
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_visitor_prereg_plate
        ON visitor_preregistrations(visitor_plate, site_id) WHERE visitor_plate IS NOT NULL
    `);

    tableEnsured = true;
    logger.info('visitor_preregistrations table ensured');
  } catch (err) {
    logger.error({ err }, 'Failed to ensure visitor_preregistrations table');
    throw err;
  }
}

// ── Service class ────────────────────────────────────────────────────────────

class VisitorPreregistrationService {
  /**
   * Create a new visitor pre-registration.
   */
  async create(data: CreatePreregistrationInput): Promise<VisitorPreregistration> {
    await ensureTable();

    const validFrom = data.valid_from ?? new Date().toISOString();
    const accessType = data.access_type ?? 'one_time';
    const visitorDocument = data.visitor_document ?? null;
    const visitorPlate = data.visitor_plate?.toUpperCase() ?? null;
    const validUntil = data.valid_until ?? null;

    const result = await db.execute(sql`
      INSERT INTO visitor_preregistrations
        (site_id, resident_id, unit_number, visitor_name, visitor_document, visitor_plate, valid_from, valid_until, access_type, status)
      VALUES
        (${data.site_id}, ${data.resident_id}, ${data.unit_number}, ${data.visitor_name}, ${visitorDocument}, ${visitorPlate}, ${validFrom}::timestamptz, ${validUntil}::timestamptz, ${accessType}, 'active')
      RETURNING *
    `);

    const row = (result as any).rows?.[0] ?? (result as any)[0];
    logger.info({ id: row.id, visitor: data.visitor_name, unit: data.unit_number }, 'Pre-registration created');
    return this.mapRow(row);
  }

  /**
   * List pre-registrations, optionally filtered by site and/or unit.
   */
  async list(siteId?: string, unitNumber?: string): Promise<VisitorPreregistration[]> {
    await ensureTable();

    let result: any;

    if (siteId && unitNumber) {
      result = await db.execute(sql`
        SELECT * FROM visitor_preregistrations
        WHERE site_id = ${siteId}
          AND unit_number = ${unitNumber}
          AND status = 'active'
        ORDER BY created_at DESC
      `);
    } else if (siteId) {
      result = await db.execute(sql`
        SELECT * FROM visitor_preregistrations
        WHERE site_id = ${siteId}
          AND status = 'active'
        ORDER BY created_at DESC
      `);
    } else {
      result = await db.execute(sql`
        SELECT * FROM visitor_preregistrations
        WHERE status = 'active'
        ORDER BY created_at DESC
      `);
    }

    const rows = (result as any).rows ?? result;
    return (rows as any[]).map((r) => this.mapRow(r));
  }

  /**
   * Validate whether a visitor is pre-registered (by name + document).
   * Returns the matching pre-registration if found and still valid.
   */
  async validate(
    visitorName: string,
    visitorDocument: string,
    siteId: string,
  ): Promise<ValidationResult> {
    await ensureTable();

    const result = await db.execute(sql`
      SELECT * FROM visitor_preregistrations
      WHERE site_id = ${siteId}
        AND status = 'active'
        AND (
          (visitor_document IS NOT NULL AND LOWER(visitor_document) = LOWER(${visitorDocument}))
          OR LOWER(visitor_name) = LOWER(${visitorName})
        )
        AND (valid_until IS NULL OR valid_until > NOW())
        AND valid_from <= NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const rows = (result as any).rows ?? result;
    const row = (rows as any[])[0];

    if (!row) {
      return {
        valid: false,
        preregistration: null,
        message: 'No active pre-registration found for this visitor',
      };
    }

    const prereg = this.mapRow(row);

    return {
      valid: true,
      preregistration: prereg,
      message: `Visitor pre-registered by unit ${prereg.unit_number}`,
    };
  }

  /**
   * Validate whether a vehicle plate is pre-registered.
   */
  async validatePlate(plate: string, siteId: string): Promise<ValidationResult> {
    await ensureTable();

    const normalizedPlate = plate.toUpperCase().replace(/[\s-]/g, '');

    const result = await db.execute(sql`
      SELECT * FROM visitor_preregistrations
      WHERE site_id = ${siteId}
        AND status = 'active'
        AND visitor_plate IS NOT NULL
        AND UPPER(REPLACE(REPLACE(visitor_plate, ' ', ''), '-', '')) = ${normalizedPlate}
        AND (valid_until IS NULL OR valid_until > NOW())
        AND valid_from <= NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const rows = (result as any).rows ?? result;
    const row = (rows as any[])[0];

    if (!row) {
      return {
        valid: false,
        preregistration: null,
        message: 'No active pre-registration found for this plate',
      };
    }

    const prereg = this.mapRow(row);

    return {
      valid: true,
      preregistration: prereg,
      message: `Vehicle pre-registered by unit ${prereg.unit_number}`,
    };
  }

  /**
   * Mark a pre-registration as used (for one_time access).
   */
  async markUsed(id: string): Promise<VisitorPreregistration> {
    await ensureTable();

    const result = await db.execute(sql`
      UPDATE visitor_preregistrations
      SET status = 'used'
      WHERE id = ${id}
        AND status = 'active'
      RETURNING *
    `);

    const rows = (result as any).rows ?? result;
    const row = (rows as any[])[0];

    if (!row) {
      throw new Error(`Pre-registration ${id} not found or not active`);
    }

    logger.info({ id }, 'Pre-registration marked as used');
    return this.mapRow(row);
  }

  /**
   * Cancel a pre-registration.
   */
  async cancel(id: string): Promise<VisitorPreregistration> {
    await ensureTable();

    const result = await db.execute(sql`
      UPDATE visitor_preregistrations
      SET status = 'cancelled'
      WHERE id = ${id}
        AND status IN ('active')
      RETURNING *
    `);

    const rows = (result as any).rows ?? result;
    const row = (rows as any[])[0];

    if (!row) {
      throw new Error(`Pre-registration ${id} not found or not active`);
    }

    logger.info({ id }, 'Pre-registration cancelled');
    return this.mapRow(row);
  }

  /**
   * Expire old pre-registrations where valid_until has passed.
   * Intended to be called periodically (e.g., via cron or scheduler).
   */
  async expireOld(): Promise<number> {
    await ensureTable();

    const result = await db.execute(sql`
      UPDATE visitor_preregistrations
      SET status = 'expired'
      WHERE status = 'active'
        AND valid_until IS NOT NULL
        AND valid_until < NOW()
    `);

    const count = (result as any).rowCount ?? (result as any).count ?? 0;
    if (count > 0) {
      logger.info({ expired: count }, 'Expired old pre-registrations');
    }
    return count;
  }

  /**
   * Get a single pre-registration by ID.
   */
  async getById(id: string): Promise<VisitorPreregistration | null> {
    await ensureTable();

    const result = await db.execute(sql`
      SELECT * FROM visitor_preregistrations
      WHERE id = ${id}
    `);

    const rows = (result as any).rows ?? result;
    const row = (rows as any[])[0];
    return row ? this.mapRow(row) : null;
  }

  /**
   * Update a pre-registration (partial update).
   */
  async update(
    id: string,
    data: Partial<Pick<CreatePreregistrationInput, 'visitor_name' | 'visitor_document' | 'visitor_plate' | 'valid_from' | 'valid_until' | 'access_type'>>,
  ): Promise<VisitorPreregistration> {
    await ensureTable();

    // Build SET clauses dynamically (inline values, matching codebase pattern)
    const setClauses: string[] = [];

    const esc = (v: string | null): string => {
      if (v === null) return 'NULL';
      return `'${v.replace(/'/g, "''")}'`;
    };

    if (data.visitor_name !== undefined) {
      setClauses.push(`visitor_name = ${esc(data.visitor_name)}`);
    }
    if (data.visitor_document !== undefined) {
      setClauses.push(`visitor_document = ${esc(data.visitor_document ?? null)}`);
    }
    if (data.visitor_plate !== undefined) {
      setClauses.push(`visitor_plate = ${esc(data.visitor_plate?.toUpperCase() ?? null)}`);
    }
    if (data.valid_from !== undefined) {
      setClauses.push(`valid_from = ${esc(data.valid_from)}::timestamptz`);
    }
    if (data.valid_until !== undefined) {
      setClauses.push(`valid_until = ${esc(data.valid_until ?? null)}::timestamptz`);
    }
    if (data.access_type !== undefined) {
      setClauses.push(`access_type = ${esc(data.access_type)}`);
    }

    if (setClauses.length === 0) {
      const existing = await this.getById(id);
      if (!existing) throw new Error(`Pre-registration ${id} not found`);
      return existing;
    }

    const result = await db.execute(sql.raw(
      `UPDATE visitor_preregistrations SET ${setClauses.join(', ')} WHERE id = '${id}' RETURNING *`,
    ));

    const rows = (result as any).rows ?? result;
    const row = (rows as any[])[0];

    if (!row) {
      throw new Error(`Pre-registration ${id} not found`);
    }

    logger.info({ id, updated: Object.keys(data) }, 'Pre-registration updated');
    return this.mapRow(row);
  }

  // ── Row mapper ─────────────────────────────────────────────────────────────

  private mapRow(row: any): VisitorPreregistration {
    return {
      id: row.id,
      site_id: row.site_id,
      resident_id: row.resident_id,
      unit_number: row.unit_number,
      visitor_name: row.visitor_name,
      visitor_document: row.visitor_document ?? null,
      visitor_plate: row.visitor_plate ?? null,
      valid_from: row.valid_from instanceof Date ? row.valid_from.toISOString() : String(row.valid_from),
      valid_until: row.valid_until
        ? (row.valid_until instanceof Date ? row.valid_until.toISOString() : String(row.valid_until))
        : null,
      access_type: row.access_type,
      status: row.status,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }
}

export const visitorPreregistrationService = new VisitorPreregistrationService();
