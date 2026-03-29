/**
 * MCP Server Tool — AI Summary Tools
 *
 * Provides tools for generating AI-written narrative summaries of incidents
 * and shifts, including related events, comments, and timeline data.
 */

import { db } from '../../../db/client.js';
import { sql } from 'drizzle-orm';
import type { MCPServerTool } from './index.js';

// ── generate_incident_summary ──────────────────────────────────

const generateIncidentSummary: MCPServerTool = {
  name: 'generate_incident_summary',
  description:
    'Generate an AI-written narrative summary of an incident including all events, comments, and timeline',
  parameters: {
    incident_id: {
      type: 'string',
      description: 'Incident ID',
      required: true,
    },
  },
  execute: async (params, context) => {
    const incidentId = params.incident_id as string;

    // Get incident details
    const incidentRows = await db.execute(
      sql`SELECT * FROM incidents WHERE id = ${incidentId}::uuid AND tenant_id = ${context.tenantId}::uuid`,
    );
    const rows = incidentRows as unknown as Record<string, unknown>[];
    const inc = rows[0];
    if (!inc) return { error: 'Incident not found' };

    // Get related events
    const eventRows = await db.execute(
      sql`SELECT type, severity, description, created_at FROM events WHERE tenant_id = ${context.tenantId}::uuid AND metadata->>'incident_id' = ${incidentId} ORDER BY created_at LIMIT 20`,
    );
    const eventsList = eventRows as unknown as Record<string, unknown>[];

    // Build summary context
    return {
      incident: inc,
      events: eventsList,
      summary_prompt: `Generate a professional incident report summary in Spanish for incident "${String(inc.title ?? '')}". Status: ${String(inc.status ?? '')}. Priority: ${String(inc.priority ?? '')}. Include timeline of ${eventsList.length} related events.`,
    };
  },
};

// ── generate_shift_summary ─────────────────────────────────────

const generateShiftSummary: MCPServerTool = {
  name: 'generate_shift_summary',
  description:
    'Generate a summary of the current or specified shift including events, incidents, and actions taken',
  parameters: {
    date: {
      type: 'string',
      description: 'Date in YYYY-MM-DD format (default: today)',
    },
  },
  execute: async (params, context) => {
    const date = (params.date as string) || new Date().toISOString().slice(0, 10);

    const eventRows = await db.execute(
      sql`SELECT severity, count(*) as cnt FROM events WHERE tenant_id = ${context.tenantId}::uuid AND created_at::date = ${date}::date GROUP BY severity`,
    );
    const incidentRows = await db.execute(
      sql`SELECT status, count(*) as cnt FROM incidents WHERE tenant_id = ${context.tenantId}::uuid AND created_at::date = ${date}::date GROUP BY status`,
    );

    return {
      date,
      events: eventRows as unknown as Record<string, unknown>[],
      incidents: incidentRows as unknown as Record<string, unknown>[],
    };
  },
};

// ── Export ──────────────────────────────────────────────────────

export const aiSummaryTools: MCPServerTool[] = [
  generateIncidentSummary,
  generateShiftSummary,
];
