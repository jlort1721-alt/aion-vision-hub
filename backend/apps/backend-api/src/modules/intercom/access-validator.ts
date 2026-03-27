/**
 * Access Validator for Intercom Calls
 *
 * Validates whether a visitor/person is authorized to enter based on:
 *   1. access_people table (residents, staff, providers)
 *   2. access_vehicles table (plate match)
 *   3. visitors table (pre-registered visitors with active passes)
 *   4. Blacklist / whitelist check
 *
 * Used by the orchestration service when the AI agent collects visitor info
 * during an intercom call.
 */

import { eq, and, ilike, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accessPeople, accessVehicles, visitors, visitorPasses } from '../../db/schema/index.js';

// ── Result Types ─────────────────────────────────────────────

export interface AccessValidationResult {
  authorized: boolean;
  reason: string;
  person?: AccessPersonMatch;
  visitor?: VisitorMatch;
  vehicle?: VehicleMatch;
  accessRule?: string;
}

export interface AccessPersonMatch {
  id: string;
  fullName: string;
  type: string;
  unit?: string | null;
  status: string;
  documentId?: string | null;
  phone?: string | null;
}

export interface VisitorMatch {
  id: string;
  fullName: string;
  documentId?: string | null;
  hostName?: string | null;
  hostUnit?: string | null;
  visitReason: string;
  isBlacklisted: boolean;
  passId?: string;
  passStatus?: string;
}

export interface VehicleMatch {
  id: string;
  plate: string;
  brand?: string | null;
  model?: string | null;
  color?: string | null;
  personId?: string | null;
  status: string;
}

export interface VisitorInfo {
  name?: string;
  documentNumber?: string;
  apartment?: string;
  plate?: string;
}

// ── Validator ────────────────────────────────────────────────

/**
 * Validates whether a visitor is authorized to access the premises.
 *
 * Check order:
 *   1. Blacklist check — reject immediately if person/visitor is blocked
 *   2. Vehicle plate match — auto-authorize if plate belongs to active resident
 *   3. Document number match — match against access_people and visitors
 *   4. Name + apartment match — fuzzy match against access_people
 *   5. Pre-registered visitor pass — check active visitor passes
 *
 * Returns a result indicating authorization status and matched records.
 */
export async function validateAccess(
  tenantId: string,
  visitorInfo: VisitorInfo,
): Promise<AccessValidationResult> {
  const { name, documentNumber, apartment, plate } = visitorInfo;

  // ── 1. Vehicle plate check ──────────────────────────────────
  if (plate) {
    const normalizedPlate = plate.replace(/[\s\-]/g, '').toUpperCase();

    const vehicleRows = await db
      .select()
      .from(accessVehicles)
      .where(
        and(
          eq(accessVehicles.tenantId, tenantId),
          sql`UPPER(REPLACE(REPLACE(${accessVehicles.plate}, '-', ''), ' ', '')) = ${normalizedPlate}`,
        ),
      )
      .limit(1);

    if (vehicleRows.length > 0) {
      const vehicle = vehicleRows[0];

      // Check if vehicle is active
      if (vehicle.status !== 'active') {
        return {
          authorized: false,
          reason: `Vehicle ${plate} is registered but status is '${vehicle.status}'`,
          vehicle: mapVehicle(vehicle),
          accessRule: 'vehicle_inactive',
        };
      }

      // If vehicle has an owner, verify the owner is active
      if (vehicle.personId) {
        const [owner] = await db
          .select()
          .from(accessPeople)
          .where(
            and(
              eq(accessPeople.id, vehicle.personId),
              eq(accessPeople.tenantId, tenantId),
            ),
          )
          .limit(1);

        if (owner) {
          if (owner.status === 'blocked') {
            return {
              authorized: false,
              reason: `Vehicle owner '${owner.fullName}' is blocked`,
              person: mapPerson(owner),
              vehicle: mapVehicle(vehicle),
              accessRule: 'person_blocked',
            };
          }

          if (owner.status === 'active') {
            return {
              authorized: true,
              reason: `Vehicle ${plate} belongs to ${owner.type} '${owner.fullName}'`,
              person: mapPerson(owner),
              vehicle: mapVehicle(vehicle),
              accessRule: 'vehicle_whitelist',
            };
          }
        }
      }

      // Vehicle exists and is active but no owner — still authorize
      return {
        authorized: true,
        reason: `Vehicle ${plate} is registered and active`,
        vehicle: mapVehicle(vehicle),
        accessRule: 'vehicle_registered',
      };
    }
  }

  // ── 2. Document number check ────────────────────────────────
  if (documentNumber) {
    // Check access_people by document
    const personRows = await db
      .select()
      .from(accessPeople)
      .where(
        and(
          eq(accessPeople.tenantId, tenantId),
          ilike(accessPeople.documentId, documentNumber),
        ),
      )
      .limit(1);

    if (personRows.length > 0) {
      const person = personRows[0];

      if (person.status === 'blocked') {
        return {
          authorized: false,
          reason: `Person '${person.fullName}' is blocked`,
          person: mapPerson(person),
          accessRule: 'person_blocked',
        };
      }

      if (person.status === 'active') {
        return {
          authorized: true,
          reason: `Document matches ${person.type} '${person.fullName}'`,
          person: mapPerson(person),
          accessRule: 'document_whitelist',
        };
      }

      return {
        authorized: false,
        reason: `Person '${person.fullName}' has status '${person.status}'`,
        person: mapPerson(person),
        accessRule: 'person_inactive',
      };
    }

    // Check visitors by document
    const visitorRows = await db
      .select()
      .from(visitors)
      .where(
        and(
          eq(visitors.tenantId, tenantId),
          ilike(visitors.documentId, documentNumber),
        ),
      )
      .limit(1);

    if (visitorRows.length > 0) {
      const visitor = visitorRows[0];

      if (visitor.isBlacklisted) {
        return {
          authorized: false,
          reason: `Visitor '${visitor.fullName}' is blacklisted`,
          visitor: mapVisitor(visitor),
          accessRule: 'visitor_blacklisted',
        };
      }

      // Check for active pass
      const passResult = await checkActivePass(tenantId, visitor.id);
      if (passResult) {
        return {
          authorized: true,
          reason: `Pre-registered visitor '${visitor.fullName}' with active pass`,
          visitor: { ...mapVisitor(visitor), passId: passResult.id, passStatus: passResult.status },
          accessRule: 'visitor_pass_active',
        };
      }

      return {
        authorized: false,
        reason: `Visitor '${visitor.fullName}' found but no active pass`,
        visitor: mapVisitor(visitor),
        accessRule: 'visitor_no_pass',
      };
    }
  }

  // ── 3. Name + apartment match ───────────────────────────────
  if (name) {
    const nameConditions = [
      eq(accessPeople.tenantId, tenantId),
      ilike(accessPeople.fullName, `%${name}%`),
    ];
    if (apartment) {
      nameConditions.push(ilike(accessPeople.unit, `%${apartment}%`));
    }

    const personRows = await db
      .select()
      .from(accessPeople)
      .where(and(...nameConditions))
      .limit(5);

    if (personRows.length > 0) {
      const person = personRows[0];

      if (person.status === 'blocked') {
        return {
          authorized: false,
          reason: `Person '${person.fullName}' is blocked`,
          person: mapPerson(person),
          accessRule: 'person_blocked',
        };
      }

      if (person.status === 'active') {
        return {
          authorized: true,
          reason: `Name matches ${person.type} '${person.fullName}'${apartment ? ` in unit ${person.unit}` : ''}`,
          person: mapPerson(person),
          accessRule: 'name_match',
        };
      }

      return {
        authorized: false,
        reason: `Person '${person.fullName}' has status '${person.status}'`,
        person: mapPerson(person),
        accessRule: 'person_inactive',
      };
    }

    // Check visitors by name
    const visitorNameConditions = [
      eq(visitors.tenantId, tenantId),
      ilike(visitors.fullName, `%${name}%`),
    ];
    if (apartment) {
      visitorNameConditions.push(ilike(visitors.hostUnit, `%${apartment}%`));
    }

    const visitorRows = await db
      .select()
      .from(visitors)
      .where(and(...visitorNameConditions))
      .limit(5);

    if (visitorRows.length > 0) {
      const visitor = visitorRows[0];

      if (visitor.isBlacklisted) {
        return {
          authorized: false,
          reason: `Visitor '${visitor.fullName}' is blacklisted`,
          visitor: mapVisitor(visitor),
          accessRule: 'visitor_blacklisted',
        };
      }

      const passResult = await checkActivePass(tenantId, visitor.id);
      if (passResult) {
        return {
          authorized: true,
          reason: `Pre-registered visitor '${visitor.fullName}' with active pass`,
          visitor: { ...mapVisitor(visitor), passId: passResult.id, passStatus: passResult.status },
          accessRule: 'visitor_pass_active',
        };
      }

      return {
        authorized: false,
        reason: `Visitor '${visitor.fullName}' found but no active pass — requires operator confirmation`,
        visitor: mapVisitor(visitor),
        accessRule: 'visitor_no_pass',
      };
    }
  }

  // ── 4. No match found ───────────────────────────────────────
  return {
    authorized: false,
    reason: 'No matching resident, authorized person, or pre-registered visitor found',
    accessRule: 'no_match',
  };
}

// ── Helpers ──────────────────────────────────────────────────

async function checkActivePass(tenantId: string, visitorId: string) {
  const now = new Date();
  const [pass] = await db
    .select()
    .from(visitorPasses)
    .where(
      and(
        eq(visitorPasses.tenantId, tenantId),
        eq(visitorPasses.visitorId, visitorId),
        eq(visitorPasses.status, 'active'),
        sql`${visitorPasses.validFrom} <= ${now}`,
        sql`${visitorPasses.validUntil} >= ${now}`,
      ),
    )
    .limit(1);

  return pass || null;
}

function mapPerson(row: any): AccessPersonMatch {
  return {
    id: row.id,
    fullName: row.fullName,
    type: row.type,
    unit: row.unit,
    status: row.status,
    documentId: row.documentId,
    phone: row.phone,
  };
}

function mapVisitor(row: any): VisitorMatch {
  return {
    id: row.id,
    fullName: row.fullName,
    documentId: row.documentId,
    hostName: row.hostName,
    hostUnit: row.hostUnit,
    visitReason: row.visitReason,
    isBlacklisted: row.isBlacklisted,
  };
}

function mapVehicle(row: any): VehicleMatch {
  return {
    id: row.id,
    plate: row.plate,
    brand: row.brand,
    model: row.model,
    color: row.color,
    personId: row.personId,
    status: row.status,
  };
}
