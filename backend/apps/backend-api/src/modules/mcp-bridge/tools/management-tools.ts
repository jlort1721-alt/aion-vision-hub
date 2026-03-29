/**
 * MCP Server Tool — Contract & Key Management
 *
 * Provides tools for querying contracts, tracking expirations,
 * managing key inventory (assign/return), and revenue summaries.
 * All operations are tenant-scoped.
 */

import { eq, and, sql, desc, lte, gte } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { contracts, keyInventory, keyLogs } from '../../../db/schema/index.js';
import type { MCPServerTool } from './index.js';

// ── query_contracts ──────────────────────────────────────────

export const queryContracts: MCPServerTool = {
  name: 'query_contracts',
  description:
    'List contracts with optional status filter. Returns contract details including client info, dates, and amounts.',
  parameters: {
    status: {
      type: 'string',
      description: 'Filter by contract status',
      required: false,
      enum: ['draft', 'active', 'suspended', 'terminated', 'expired'],
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results (default: 50, max: 200)',
      required: false,
    },
  },
  execute: async (params, context) => {
    try {
      const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);

      const conditions = [eq(contracts.tenantId, context.tenantId)];
      if (params.status) {
        conditions.push(eq(contracts.status, params.status as string));
      }

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(contracts)
        .where(and(...conditions));

      const rows = await db
        .select({
          id: contracts.id,
          contractNumber: contracts.contractNumber,
          clientName: contracts.clientName,
          clientEmail: contracts.clientEmail,
          type: contracts.type,
          status: contracts.status,
          startDate: contracts.startDate,
          endDate: contracts.endDate,
          monthlyAmount: contracts.monthlyAmount,
          currency: contracts.currency,
          autoRenew: contracts.autoRenew,
          createdAt: contracts.createdAt,
        })
        .from(contracts)
        .where(and(...conditions))
        .orderBy(desc(contracts.createdAt))
        .limit(limit);

      return {
        contracts: rows,
        total: countResult?.count ?? 0,
        returned: rows.length,
        limit,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to query contracts' };
    }
  },
};

// ── get_expiring_contracts ───────────────────────────────────

export const getExpiringContracts: MCPServerTool = {
  name: 'get_expiring_contracts',
  description:
    'Get contracts expiring within a specified number of days. Useful for proactive renewal management.',
  parameters: {
    days: {
      type: 'number',
      description: 'Number of days to look ahead for expiring contracts (default: 30)',
      required: false,
    },
  },
  execute: async (params, context) => {
    try {
      const days = Math.max(Number(params.days) || 30, 1);
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const nowStr = now.toISOString().split('T')[0];
      const futureStr = futureDate.toISOString().split('T')[0];

      const rows = await db
        .select({
          id: contracts.id,
          contractNumber: contracts.contractNumber,
          clientName: contracts.clientName,
          clientEmail: contracts.clientEmail,
          clientPhone: contracts.clientPhone,
          status: contracts.status,
          endDate: contracts.endDate,
          monthlyAmount: contracts.monthlyAmount,
          currency: contracts.currency,
          autoRenew: contracts.autoRenew,
        })
        .from(contracts)
        .where(
          and(
            eq(contracts.tenantId, context.tenantId),
            eq(contracts.status, 'active'),
            gte(contracts.endDate, nowStr),
            lte(contracts.endDate, futureStr),
          ),
        )
        .orderBy(contracts.endDate);

      return {
        expiring_contracts: rows,
        count: rows.length,
        window_days: days,
        from_date: nowStr,
        to_date: futureStr,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get expiring contracts' };
    }
  },
};

// ── query_keys ───────────────────────────────────────────────

export const queryKeys: MCPServerTool = {
  name: 'query_keys',
  description:
    'Query key inventory with optional status filter. Returns key details including holder information.',
  parameters: {
    status: {
      type: 'string',
      description: 'Filter by key status',
      required: false,
      enum: ['available', 'assigned', 'lost', 'retired'],
    },
    site_id: {
      type: 'string',
      description: 'Filter by site UUID',
      required: false,
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results (default: 50, max: 200)',
      required: false,
    },
  },
  execute: async (params, context) => {
    try {
      const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);

      const conditions = [eq(keyInventory.tenantId, context.tenantId)];
      if (params.status) {
        conditions.push(eq(keyInventory.status, params.status as string));
      }
      if (params.site_id) {
        conditions.push(eq(keyInventory.siteId, params.site_id as string));
      }

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(keyInventory)
        .where(and(...conditions));

      const rows = await db
        .select({
          id: keyInventory.id,
          keyCode: keyInventory.keyCode,
          label: keyInventory.label,
          description: keyInventory.description,
          keyType: keyInventory.keyType,
          status: keyInventory.status,
          currentHolder: keyInventory.currentHolder,
          location: keyInventory.location,
          copies: keyInventory.copies,
          siteId: keyInventory.siteId,
          createdAt: keyInventory.createdAt,
        })
        .from(keyInventory)
        .where(and(...conditions))
        .orderBy(keyInventory.label)
        .limit(limit);

      return {
        keys: rows,
        total: countResult?.count ?? 0,
        returned: rows.length,
        limit,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to query keys' };
    }
  },
};

// ── assign_key ───────────────────────────────────────────────

export const assignKey: MCPServerTool = {
  name: 'assign_key',
  description:
    'Assign a key to a person. The key must be available. Records the assignment in the key log.',
  parameters: {
    key_id: {
      type: 'string',
      description: 'Key UUID to assign (required)',
      required: true,
    },
    holder_name: {
      type: 'string',
      description: 'Name of the person receiving the key (required)',
      required: true,
    },
    notes: {
      type: 'string',
      description: 'Notes about the assignment',
      required: false,
    },
  },
  execute: async (params, context) => {
    try {
      const keyId = params.key_id as string;
      const holderName = params.holder_name as string;

      if (!keyId || !holderName) {
        return { error: 'key_id and holder_name are required' };
      }

      // Verify key belongs to tenant and is available
      const [key] = await db
        .select()
        .from(keyInventory)
        .where(
          and(
            eq(keyInventory.id, keyId),
            eq(keyInventory.tenantId, context.tenantId),
          ),
        )
        .limit(1);

      if (!key) {
        return { error: `Key '${keyId}' not found or does not belong to this tenant` };
      }

      if (key.status !== 'available') {
        return {
          error: `Key '${key.label}' is currently '${key.status}' and cannot be assigned. Current holder: ${key.currentHolder ?? 'N/A'}`,
        };
      }

      // Update key status
      const [updated] = await db
        .update(keyInventory)
        .set({
          status: 'assigned',
          currentHolder: holderName,
          updatedAt: new Date(),
        })
        .where(eq(keyInventory.id, keyId))
        .returning();

      // Record in key log
      await db.insert(keyLogs).values({
        tenantId: context.tenantId,
        keyId,
        action: 'assigned',
        toHolder: holderName,
        performedBy: context.userId,
        notes: (params.notes as string) || null,
      });

      return {
        message: `Key '${updated.label}' assigned to '${holderName}'`,
        key: {
          id: updated.id,
          keyCode: updated.keyCode,
          label: updated.label,
          status: updated.status,
          currentHolder: updated.currentHolder,
        },
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to assign key' };
    }
  },
};

// ── return_key ───────────────────────────────────────────────

export const returnKey: MCPServerTool = {
  name: 'return_key',
  description:
    'Return an assigned key. Updates the key status to available and records the return in the key log.',
  parameters: {
    key_id: {
      type: 'string',
      description: 'Key UUID to return (required)',
      required: true,
    },
    notes: {
      type: 'string',
      description: 'Notes about the return',
      required: false,
    },
  },
  execute: async (params, context) => {
    try {
      const keyId = params.key_id as string;

      if (!keyId) {
        return { error: 'key_id is required' };
      }

      // Verify key belongs to tenant and is assigned
      const [key] = await db
        .select()
        .from(keyInventory)
        .where(
          and(
            eq(keyInventory.id, keyId),
            eq(keyInventory.tenantId, context.tenantId),
          ),
        )
        .limit(1);

      if (!key) {
        return { error: `Key '${keyId}' not found or does not belong to this tenant` };
      }

      if (key.status !== 'assigned') {
        return {
          error: `Key '${key.label}' is currently '${key.status}' and cannot be returned`,
        };
      }

      const previousHolder = key.currentHolder;

      // Update key status
      const [updated] = await db
        .update(keyInventory)
        .set({
          status: 'available',
          currentHolder: null,
          currentHolderId: null,
          updatedAt: new Date(),
        })
        .where(eq(keyInventory.id, keyId))
        .returning();

      // Record in key log
      await db.insert(keyLogs).values({
        tenantId: context.tenantId,
        keyId,
        action: 'returned',
        fromHolder: previousHolder,
        performedBy: context.userId,
        notes: (params.notes as string) || null,
      });

      return {
        message: `Key '${updated.label}' returned by '${previousHolder}'`,
        key: {
          id: updated.id,
          keyCode: updated.keyCode,
          label: updated.label,
          status: updated.status,
          previousHolder,
        },
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to return key' };
    }
  },
};

// ── get_contract_stats ───────────────────────────────────────

export const getContractStats: MCPServerTool = {
  name: 'get_contract_stats',
  description:
    'Get contract statistics including total count, active count, and monthly revenue summary.',
  parameters: {},
  execute: async (_params, context) => {
    try {
      const [stats] = await db
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where ${contracts.status} = 'active')::int`,
          draft: sql<number>`count(*) filter (where ${contracts.status} = 'draft')::int`,
          suspended: sql<number>`count(*) filter (where ${contracts.status} = 'suspended')::int`,
          terminated: sql<number>`count(*) filter (where ${contracts.status} = 'terminated')::int`,
          expired: sql<number>`count(*) filter (where ${contracts.status} = 'expired')::int`,
          total_monthly_revenue: sql<string>`coalesce(sum(${contracts.monthlyAmount}) filter (where ${contracts.status} = 'active'), 0)::text`,
        })
        .from(contracts)
        .where(eq(contracts.tenantId, context.tenantId));

      // Contracts expiring in the next 30 days
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const nowStr = new Date().toISOString().split('T')[0];
      const futureStr = futureDate.toISOString().split('T')[0];

      const [expiringCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(contracts)
        .where(
          and(
            eq(contracts.tenantId, context.tenantId),
            eq(contracts.status, 'active'),
            gte(contracts.endDate, nowStr),
            lte(contracts.endDate, futureStr),
          ),
        );

      return {
        total: stats?.total ?? 0,
        by_status: {
          active: stats?.active ?? 0,
          draft: stats?.draft ?? 0,
          suspended: stats?.suspended ?? 0,
          terminated: stats?.terminated ?? 0,
          expired: stats?.expired ?? 0,
        },
        revenue: {
          active_monthly_total: stats?.total_monthly_revenue ?? '0',
        },
        expiring_next_30_days: expiringCount?.count ?? 0,
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get contract stats' };
    }
  },
};

/** All management tools */
export const managementTools: MCPServerTool[] = [
  queryContracts,
  getExpiringContracts,
  queryKeys,
  assignKey,
  returnKey,
  getContractStats,
];
