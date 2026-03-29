/**
 * MCP Server Tool — Compliance & Training
 *
 * Provides tools for checking compliance status (templates, audits,
 * retention policies), querying certifications, and tracking
 * expiring certifications. All operations are tenant-scoped.
 */

import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import {
  complianceTemplates,
  dataRetentionPolicies,
  certifications,
  trainingPrograms,
} from '../../../db/schema/index.js';
import type { MCPServerTool } from './index.js';

// ── get_compliance_status ────────────────────────────────────

export const getComplianceStatus: MCPServerTool = {
  name: 'get_compliance_status',
  description:
    'Get overall compliance status including template counts, overdue retention policy executions, and active data retention policies.',
  parameters: {},
  execute: async (_params, context) => {
    try {
      // Compliance templates summary
      const [templateStats] = await db
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where ${complianceTemplates.isActive} = true)::int`,
          by_type_habeas: sql<number>`count(*) filter (where ${complianceTemplates.type} = 'habeas_data')::int`,
          by_type_consent: sql<number>`count(*) filter (where ${complianceTemplates.type} = 'consent_form')::int`,
          by_type_privacy: sql<number>`count(*) filter (where ${complianceTemplates.type} = 'privacy_policy')::int`,
          by_type_retention: sql<number>`count(*) filter (where ${complianceTemplates.type} = 'data_retention')::int`,
          by_type_incident: sql<number>`count(*) filter (where ${complianceTemplates.type} = 'incident_report')::int`,
          by_type_breach: sql<number>`count(*) filter (where ${complianceTemplates.type} = 'data_breach_notification')::int`,
        })
        .from(complianceTemplates)
        .where(eq(complianceTemplates.tenantId, context.tenantId));

      // Data retention policies
      const now = new Date();
      const [retentionStats] = await db
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where ${dataRetentionPolicies.isActive} = true)::int`,
          overdue: sql<number>`count(*) filter (where ${dataRetentionPolicies.isActive} = true and ${dataRetentionPolicies.nextExecutionAt} < ${now})::int`,
        })
        .from(dataRetentionPolicies)
        .where(eq(dataRetentionPolicies.tenantId, context.tenantId));

      // Certification status summary
      const [certStats] = await db
        .select({
          total: sql<number>`count(*)::int`,
          expired: sql<number>`count(*) filter (where ${certifications.status} = 'expired')::int`,
          expiring_30d: sql<number>`count(*) filter (where ${certifications.status} = 'completed' and ${certifications.expiresAt} <= ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)})::int`,
          completed: sql<number>`count(*) filter (where ${certifications.status} = 'completed')::int`,
          in_progress: sql<number>`count(*) filter (where ${certifications.status} = 'in_progress')::int`,
        })
        .from(certifications)
        .where(eq(certifications.tenantId, context.tenantId));

      return {
        compliance_templates: {
          total: templateStats?.total ?? 0,
          active: templateStats?.active ?? 0,
          by_type: {
            habeas_data: templateStats?.by_type_habeas ?? 0,
            consent_form: templateStats?.by_type_consent ?? 0,
            privacy_policy: templateStats?.by_type_privacy ?? 0,
            data_retention: templateStats?.by_type_retention ?? 0,
            incident_report: templateStats?.by_type_incident ?? 0,
            data_breach_notification: templateStats?.by_type_breach ?? 0,
          },
        },
        data_retention: {
          total_policies: retentionStats?.total ?? 0,
          active_policies: retentionStats?.active ?? 0,
          overdue_executions: retentionStats?.overdue ?? 0,
        },
        certifications: {
          total: certStats?.total ?? 0,
          completed: certStats?.completed ?? 0,
          in_progress: certStats?.in_progress ?? 0,
          expired: certStats?.expired ?? 0,
          expiring_next_30_days: certStats?.expiring_30d ?? 0,
        },
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get compliance status' };
    }
  },
};

// ── query_certifications ─────────────────────────────────────

export const queryCertifications: MCPServerTool = {
  name: 'query_certifications',
  description:
    'List certifications with optional status or expiry filter. Includes program name and user details.',
  parameters: {
    status: {
      type: 'string',
      description: 'Filter by certification status',
      required: false,
      enum: ['enrolled', 'in_progress', 'completed', 'expired', 'failed'],
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

      const conditions = [eq(certifications.tenantId, context.tenantId)];
      if (params.status) {
        conditions.push(eq(certifications.status, params.status as string));
      }

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(certifications)
        .where(and(...conditions));

      const rows = await db
        .select({
          id: certifications.id,
          programId: certifications.programId,
          programName: trainingPrograms.name,
          programCategory: trainingPrograms.category,
          userId: certifications.userId,
          userName: certifications.userName,
          status: certifications.status,
          score: certifications.score,
          completedAt: certifications.completedAt,
          expiresAt: certifications.expiresAt,
          createdAt: certifications.createdAt,
        })
        .from(certifications)
        .leftJoin(trainingPrograms, eq(certifications.programId, trainingPrograms.id))
        .where(and(...conditions))
        .orderBy(desc(certifications.createdAt))
        .limit(limit);

      return {
        certifications: rows,
        total: countResult?.count ?? 0,
        returned: rows.length,
        limit,
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to query certifications' };
    }
  },
};

// ── get_expiring_certifications ──────────────────────────────

export const getExpiringCertifications: MCPServerTool = {
  name: 'get_expiring_certifications',
  description:
    'Get certifications expiring within a specified number of days. Helps manage recertification schedules.',
  parameters: {
    days: {
      type: 'number',
      description: 'Number of days to look ahead for expiring certifications (default: 30)',
      required: false,
    },
  },
  execute: async (params, context) => {
    try {
      const days = Math.max(Number(params.days) || 30, 1);
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const rows = await db
        .select({
          id: certifications.id,
          programId: certifications.programId,
          programName: trainingPrograms.name,
          programCategory: trainingPrograms.category,
          userId: certifications.userId,
          userName: certifications.userName,
          status: certifications.status,
          score: certifications.score,
          completedAt: certifications.completedAt,
          expiresAt: certifications.expiresAt,
        })
        .from(certifications)
        .leftJoin(trainingPrograms, eq(certifications.programId, trainingPrograms.id))
        .where(
          and(
            eq(certifications.tenantId, context.tenantId),
            eq(certifications.status, 'completed'),
            gte(certifications.expiresAt, now),
            lte(certifications.expiresAt, futureDate),
          ),
        )
        .orderBy(certifications.expiresAt);

      return {
        expiring_certifications: rows,
        count: rows.length,
        window_days: days,
        from_date: now.toISOString(),
        to_date: futureDate.toISOString(),
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to get expiring certifications' };
    }
  },
};

/** All compliance and training tools */
export const complianceTrainingTools: MCPServerTool[] = [
  getComplianceStatus,
  queryCertifications,
  getExpiringCertifications,
];
