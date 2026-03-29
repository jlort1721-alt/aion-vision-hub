/**
 * MCP Server Tool — Visitor Management
 *
 * Provides tools for searching, registering, and managing visitors
 * including blacklist checks and daily statistics. All operations
 * are tenant-scoped.
 */

import { eq, and, sql, desc, gte, or, ilike } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { visitors, visitorPasses } from '../../../db/schema/index.js';
import type { MCPServerTool } from './index.js';

// ── search_visitors ──────────────────────────────────────────

export const searchVisitors: MCPServerTool = {
  name: 'search_visitors',
  description:
    'Search visitors by name or document ID. Returns matching visitor records with their visit history summary.',
  parameters: {
    query: {
      type: 'string',
      description: 'Search term to match against full name or document ID (required)',
      required: true,
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results (default: 20, max: 100)',
      required: false,
    },
  },
  execute: async (params, context) => {
    try {
      const query = params.query as string;
      if (!query) {
        return { error: 'query is required' };
      }

      const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
      const searchPattern = `%${query}%`;

      const rows = await db
        .select({
          id: visitors.id,
          fullName: visitors.fullName,
          documentId: visitors.documentId,
          phone: visitors.phone,
          email: visitors.email,
          company: visitors.company,
          visitReason: visitors.visitReason,
          hostName: visitors.hostName,
          isBlacklisted: visitors.isBlacklisted,
          visitCount: visitors.visitCount,
          lastVisitAt: visitors.lastVisitAt,
          createdAt: visitors.createdAt,
        })
        .from(visitors)
        .where(
          and(
            eq(visitors.tenantId, context.tenantId),
            or(
              ilike(visitors.fullName, searchPattern),
              ilike(visitors.documentId, searchPattern),
            ),
          ),
        )
        .orderBy(desc(visitors.lastVisitAt))
        .limit(limit);

      return {
        visitors: rows,
        returned: rows.length,
        search_term: query,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to search visitors' };
    }
  },
};

// ── register_visitor ─────────────────────────────────────────

export const registerVisitor: MCPServerTool = {
  name: 'register_visitor',
  description:
    'Register a new visitor record with their personal information, purpose of visit, and host details.',
  parameters: {
    full_name: {
      type: 'string',
      description: 'Full name of the visitor (required)',
      required: true,
    },
    document_id: {
      type: 'string',
      description: 'Document or ID number of the visitor (required)',
      required: true,
    },
    visit_reason: {
      type: 'string',
      description: 'Purpose of the visit',
      required: true,
      enum: ['meeting', 'delivery', 'maintenance', 'personal', 'other'],
    },
    host_name: {
      type: 'string',
      description: 'Name of the person being visited',
      required: false,
    },
    phone: {
      type: 'string',
      description: 'Visitor phone number',
      required: false,
    },
    email: {
      type: 'string',
      description: 'Visitor email address',
      required: false,
    },
    company: {
      type: 'string',
      description: 'Visitor company or organization',
      required: false,
    },
    site_id: {
      type: 'string',
      description: 'Site UUID the visitor is visiting',
      required: false,
    },
    notes: {
      type: 'string',
      description: 'Additional notes about the visitor',
      required: false,
    },
  },
  execute: async (params, context) => {
    try {
      const fullName = params.full_name as string;
      const documentId = params.document_id as string;
      const visitReason = params.visit_reason as string;

      if (!fullName || !documentId || !visitReason) {
        return { error: 'full_name, document_id, and visit_reason are required' };
      }

      // Check if visitor with same document already exists for this tenant
      const [existing] = await db
        .select({ id: visitors.id, isBlacklisted: visitors.isBlacklisted })
        .from(visitors)
        .where(
          and(
            eq(visitors.tenantId, context.tenantId),
            eq(visitors.documentId, documentId),
          ),
        )
        .limit(1);

      if (existing) {
        if (existing.isBlacklisted) {
          return {
            error: `Visitor with document '${documentId}' is blacklisted. Registration denied.`,
            visitor_id: existing.id,
            blacklisted: true,
          };
        }
        return {
          message: 'Visitor with this document already exists',
          visitor_id: existing.id,
          already_registered: true,
        };
      }

      const [visitor] = await db
        .insert(visitors)
        .values({
          tenantId: context.tenantId,
          fullName,
          documentId,
          visitReason,
          hostName: (params.host_name as string) || null,
          phone: (params.phone as string) || null,
          email: (params.email as string) || null,
          company: (params.company as string) || null,
          siteId: (params.site_id as string) || null,
          notes: (params.notes as string) || null,
          visitCount: 0,
          isBlacklisted: false,
        })
        .returning();

      return {
        message: 'Visitor registered successfully',
        visitor,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to register visitor' };
    }
  },
};

// ── get_visitor_stats ────────────────────────────────────────

export const getVisitorStats: MCPServerTool = {
  name: 'get_visitor_stats',
  description:
    'Get visitor statistics for today including total visitors, pending passes, and currently checked-in count.',
  parameters: {},
  execute: async (_params, context) => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Total visitors registered today
      const [visitorStats] = await db
        .select({
          total: sql<number>`count(*)::int`,
          blacklisted: sql<number>`count(*) filter (where ${visitors.isBlacklisted} = true)::int`,
        })
        .from(visitors)
        .where(eq(visitors.tenantId, context.tenantId));

      // Today's visitor passes
      const [passStats] = await db
        .select({
          total_today: sql<number>`count(*) filter (where ${visitorPasses.createdAt} >= ${todayStart})::int`,
          active: sql<number>`count(*) filter (where ${visitorPasses.status} = 'active')::int`,
          checked_in: sql<number>`count(*) filter (where ${visitorPasses.checkInAt} is not null and ${visitorPasses.checkOutAt} is null)::int`,
          checked_out_today: sql<number>`count(*) filter (where ${visitorPasses.checkOutAt} >= ${todayStart})::int`,
          expired: sql<number>`count(*) filter (where ${visitorPasses.status} = 'expired')::int`,
        })
        .from(visitorPasses)
        .where(eq(visitorPasses.tenantId, context.tenantId));

      // Visitors created today
      const [newToday] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(visitors)
        .where(
          and(
            eq(visitors.tenantId, context.tenantId),
            gte(visitors.createdAt, todayStart),
          ),
        );

      return {
        total_visitors: visitorStats?.total ?? 0,
        blacklisted_visitors: visitorStats?.blacklisted ?? 0,
        new_visitors_today: newToday?.count ?? 0,
        passes: {
          issued_today: passStats?.total_today ?? 0,
          active: passStats?.active ?? 0,
          currently_checked_in: passStats?.checked_in ?? 0,
          checked_out_today: passStats?.checked_out_today ?? 0,
          expired: passStats?.expired ?? 0,
        },
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get visitor stats' };
    }
  },
};

// ── check_visitor_blacklist ──────────────────────────────────

export const checkVisitorBlacklist: MCPServerTool = {
  name: 'check_visitor_blacklist',
  description:
    'Check if a person is on the visitor blacklist by name or document ID. Returns blacklist status and visitor details if found.',
  parameters: {
    query: {
      type: 'string',
      description: 'Name or document ID to check against the blacklist (required)',
      required: true,
    },
  },
  execute: async (params, context) => {
    try {
      const query = params.query as string;
      if (!query) {
        return { error: 'query is required' };
      }

      const searchPattern = `%${query}%`;

      const rows = await db
        .select({
          id: visitors.id,
          fullName: visitors.fullName,
          documentId: visitors.documentId,
          company: visitors.company,
          isBlacklisted: visitors.isBlacklisted,
          notes: visitors.notes,
          lastVisitAt: visitors.lastVisitAt,
        })
        .from(visitors)
        .where(
          and(
            eq(visitors.tenantId, context.tenantId),
            or(
              ilike(visitors.fullName, searchPattern),
              ilike(visitors.documentId, searchPattern),
            ),
          ),
        )
        .limit(10);

      const blacklisted = rows.filter((r) => r.isBlacklisted);

      return {
        found: rows.length > 0,
        is_blacklisted: blacklisted.length > 0,
        blacklisted_matches: blacklisted,
        all_matches: rows,
        search_term: query,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to check blacklist' };
    }
  },
};

/** All visitor management tools */
export const visitorTools: MCPServerTool[] = [
  searchVisitors,
  registerVisitor,
  getVisitorStats,
  checkVisitorBlacklist,
];
