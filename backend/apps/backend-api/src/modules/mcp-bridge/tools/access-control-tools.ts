/**
 * MCP Server Tool — Access Control
 *
 * Provides tools for searching residents/people, vehicles, and
 * getting access control statistics. All queries are tenant-scoped.
 */

import { eq, and, sql, ilike, or } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { accessPeople, accessVehicles } from '../../../db/schema/index.js';
import type { MCPServerTool } from './index.js';

// ── search_people ──────────────────────────────────────────────

export const searchPeople: MCPServerTool = {
  name: 'search_people',
  description:
    'Search residents/people by name, phone, document ID, or unit number. Returns matching records with basic info.',
  parameters: {
    search: {
      type: 'string',
      description: 'Search term to match against name, phone, document ID, or unit',
      required: true,
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results (default: 10, max: 50)',
      required: false,
    },
  },
  execute: async (params, context) => {
    const search = params.search as string;
    const limit = Math.min(Number(params.limit) || 10, 50);
    const pattern = `%${search}%`;

    const results = await db
      .select({
        id: accessPeople.id,
        fullName: accessPeople.fullName,
        phone: accessPeople.phone,
        unit: accessPeople.unit,
        type: accessPeople.type,
        status: accessPeople.status,
        documentId: accessPeople.documentId,
      })
      .from(accessPeople)
      .where(
        and(
          eq(accessPeople.tenantId, context.tenantId),
          or(
            ilike(accessPeople.fullName, pattern),
            ilike(accessPeople.phone, pattern),
            ilike(accessPeople.documentId, pattern),
            ilike(accessPeople.unit, pattern),
          ),
        ),
      )
      .limit(limit);

    return {
      results,
      total: results.length,
      search_term: search,
    };
  },
};

// ── search_vehicles ────────────────────────────────────────────

export const searchVehicles: MCPServerTool = {
  name: 'search_vehicles',
  description:
    'Search vehicles by plate number. Returns matching vehicles with owner info.',
  parameters: {
    plate: {
      type: 'string',
      description: 'Full or partial plate number to search',
      required: true,
    },
  },
  execute: async (params, context) => {
    const plate = params.plate as string;
    const pattern = `%${plate}%`;

    const results = await db
      .select({
        id: accessVehicles.id,
        plate: accessVehicles.plate,
        type: accessVehicles.type,
        brand: accessVehicles.brand,
        model: accessVehicles.model,
        color: accessVehicles.color,
        status: accessVehicles.status,
        personId: accessVehicles.personId,
      })
      .from(accessVehicles)
      .where(
        and(
          eq(accessVehicles.tenantId, context.tenantId),
          ilike(accessVehicles.plate, pattern),
        ),
      )
      .limit(10);

    // Fetch owner names for matched vehicles
    const enriched = [];
    for (const v of results) {
      let ownerName: string | null = null;
      if (v.personId) {
        const [owner] = await db
          .select({ fullName: accessPeople.fullName })
          .from(accessPeople)
          .where(eq(accessPeople.id, v.personId))
          .limit(1);
        ownerName = owner?.fullName ?? null;
      }
      enriched.push({ ...v, ownerName });
    }

    return {
      vehicles: enriched,
      total: enriched.length,
      search_plate: plate,
    };
  },
};

// ── get_access_stats ───────────────────────────────────────────

export const getAccessStats: MCPServerTool = {
  name: 'get_access_stats',
  description:
    'Get access control statistics: total residents, total vehicles, and counts by status.',
  parameters: {},
  execute: async (_params, context) => {
    const [peopleStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${accessPeople.status} = 'active')::int`,
      })
      .from(accessPeople)
      .where(eq(accessPeople.tenantId, context.tenantId));

    const [vehicleStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${accessVehicles.status} = 'active')::int`,
      })
      .from(accessVehicles)
      .where(eq(accessVehicles.tenantId, context.tenantId));

    return {
      residents: {
        total: peopleStats?.total ?? 0,
        active: peopleStats?.active ?? 0,
      },
      vehicles: {
        total: vehicleStats?.total ?? 0,
        active: vehicleStats?.active ?? 0,
      },
    };
  },
};

/** All access control tools */
export const accessControlTools: MCPServerTool[] = [
  searchPeople,
  searchVehicles,
  getAccessStats,
];
