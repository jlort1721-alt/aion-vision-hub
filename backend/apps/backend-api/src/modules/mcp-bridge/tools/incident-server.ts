/**
 * MCP Server Tool — Incident Management Server
 *
 * Provides tools for creating, updating, commenting on, viewing
 * timelines of, and closing incidents. All operations are tenant-scoped
 * and audit-logged.
 */

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { incidents, events, auditLogs } from '../../../db/schema/index.js';
import type { MCPServerTool } from './index.js';

// ── create_incident ───────────────────────────────────────────

export const createIncident: MCPServerTool = {
  name: 'create_incident',
  description:
    'Create a new security incident. Links related events and assigns priority. Returns the created incident record.',
  parameters: {
    title: {
      type: 'string',
      description: 'Incident title (required)',
      required: true,
    },
    description: {
      type: 'string',
      description: 'Detailed description of the incident',
      required: true,
    },
    priority: {
      type: 'string',
      description: 'Incident priority level',
      required: true,
      enum: ['critical', 'high', 'medium', 'low'],
    },
    site_id: {
      type: 'string',
      description: 'Site UUID the incident is associated with',
      required: false,
    },
    related_event_ids: {
      type: 'string',
      description: 'Comma-separated list of related event UUIDs',
      required: false,
    },
  },
  execute: async (params, context) => {
    const title = params.title as string;
    const description = params.description as string;
    const priority = params.priority as string;

    if (!title || !description || !priority) {
      return { error: 'title, description, and priority are required' };
    }

    const validPriorities = ['critical', 'high', 'medium', 'low'];
    if (!validPriorities.includes(priority)) {
      return { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` };
    }

    const eventIds: string[] = params.related_event_ids
      ? (params.related_event_ids as string).split(',').map((id) => id.trim()).filter(Boolean)
      : [];

    // Verify related events belong to tenant
    if (eventIds.length > 0) {
      for (const eventId of eventIds) {
        const [evt] = await db
          .select({ id: events.id })
          .from(events)
          .where(and(eq(events.id, eventId), eq(events.tenantId, context.tenantId)))
          .limit(1);

        if (!evt) {
          return { error: `Event '${eventId}' not found or does not belong to this tenant` };
        }
      }
    }

    const [incident] = await db
      .insert(incidents)
      .values({
        tenantId: context.tenantId,
        title,
        description,
        priority,
        status: 'open',
        siteId: (params.site_id as string) || null,
        eventIds,
        evidenceUrls: [],
        comments: [],
        createdBy: context.userId,
      })
      .returning();

    return {
      message: 'Incident created successfully',
      incident,
    };
  },
};

// ── update_incident ───────────────────────────────────────────

export const updateIncident: MCPServerTool = {
  name: 'update_incident',
  description:
    'Update an existing incident. Can change status, priority, or assignee.',
  parameters: {
    incident_id: {
      type: 'string',
      description: 'Incident UUID to update (required)',
      required: true,
    },
    status: {
      type: 'string',
      description: 'New status',
      required: false,
      enum: ['open', 'investigating', 'resolved', 'closed'],
    },
    priority: {
      type: 'string',
      description: 'New priority',
      required: false,
      enum: ['critical', 'high', 'medium', 'low'],
    },
    assignee: {
      type: 'string',
      description: 'User UUID to assign the incident to',
      required: false,
    },
  },
  execute: async (params, context) => {
    const incidentId = params.incident_id as string;
    if (!incidentId) {
      return { error: 'incident_id is required' };
    }

    // Verify incident belongs to tenant
    const [existing] = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, context.tenantId)))
      .limit(1);

    if (!existing) {
      return { error: `Incident '${incidentId}' not found` };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (params.status) {
      const validStatuses = ['open', 'investigating', 'resolved', 'closed'];
      if (!validStatuses.includes(params.status as string)) {
        return { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };
      }
      updateData.status = params.status;

      if (params.status === 'resolved' || params.status === 'closed') {
        updateData.closedAt = new Date();
      }
    }
    if (params.priority) {
      const validPriorities = ['critical', 'high', 'medium', 'low'];
      if (!validPriorities.includes(params.priority as string)) {
        return { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` };
      }
      updateData.priority = params.priority;
    }
    if (params.assignee) {
      updateData.assignedTo = params.assignee;
    }

    const [incident] = await db
      .update(incidents)
      .set(updateData)
      .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, context.tenantId)))
      .returning();

    return {
      message: 'Incident updated successfully',
      incident,
    };
  },
};

// ── add_incident_comment ──────────────────────────────────────

export const addIncidentComment: MCPServerTool = {
  name: 'add_incident_comment',
  description:
    'Add a comment to an existing incident. Comments are stored in the incident timeline.',
  parameters: {
    incident_id: {
      type: 'string',
      description: 'Incident UUID to comment on (required)',
      required: true,
    },
    content: {
      type: 'string',
      description: 'Comment text (required)',
      required: true,
    },
  },
  execute: async (params, context) => {
    const incidentId = params.incident_id as string;
    const content = params.content as string;

    if (!incidentId || !content) {
      return { error: 'incident_id and content are required' };
    }

    // Verify incident belongs to tenant
    const [existing] = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, context.tenantId)))
      .limit(1);

    if (!existing) {
      return { error: `Incident '${incidentId}' not found` };
    }

    const commentEntry = {
      id: crypto.randomUUID(),
      content,
      authorId: context.userId,
      authorName: 'MCP Agent',
      createdAt: new Date().toISOString(),
    };

    const currentComments = Array.isArray(existing.comments) ? existing.comments : [];

    const [incident] = await db
      .update(incidents)
      .set({
        comments: [...currentComments, commentEntry],
        updatedAt: new Date(),
      })
      .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, context.tenantId)))
      .returning();

    return {
      message: 'Comment added successfully',
      comment: commentEntry,
      total_comments: Array.isArray(incident.comments) ? incident.comments.length : 0,
    };
  },
};

// ── get_incident_timeline ─────────────────────────────────────

export const getIncidentTimeline: MCPServerTool = {
  name: 'get_incident_timeline',
  description:
    'Get the full timeline of an incident including creation, status changes, comments, and related events.',
  parameters: {
    incident_id: {
      type: 'string',
      description: 'Incident UUID to get timeline for (required)',
      required: true,
    },
  },
  execute: async (params, context) => {
    const incidentId = params.incident_id as string;
    if (!incidentId) {
      return { error: 'incident_id is required' };
    }

    // Get incident
    const [incident] = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, context.tenantId)))
      .limit(1);

    if (!incident) {
      return { error: `Incident '${incidentId}' not found` };
    }

    // Get related events
    const eventIds = Array.isArray(incident.eventIds) ? incident.eventIds : [];
    const relatedEvents = [];

    for (const eventId of eventIds) {
      const [evt] = await db
        .select()
        .from(events)
        .where(and(eq(events.id, eventId as string), eq(events.tenantId, context.tenantId)))
        .limit(1);

      if (evt) {
        relatedEvents.push(evt);
      }
    }

    // Get audit trail for this incident
    const auditTrail = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, context.tenantId),
          eq(auditLogs.entityType, 'incident'),
          eq(auditLogs.entityId, incidentId),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(50);

    // Build timeline
    const timeline: Array<{
      timestamp: string;
      type: string;
      description: string;
      details?: unknown;
    }> = [];

    // Creation entry
    timeline.push({
      timestamp: incident.createdAt.toISOString(),
      type: 'created',
      description: `Incident created: ${incident.title}`,
      details: {
        priority: incident.priority,
        status: incident.status,
        createdBy: incident.createdBy,
      },
    });

    // Related events
    for (const evt of relatedEvents) {
      timeline.push({
        timestamp: evt.createdAt.toISOString(),
        type: 'related_event',
        description: `Related event: ${evt.title}`,
        details: {
          eventId: evt.id,
          severity: evt.severity,
          eventType: evt.eventType,
          status: evt.status,
        },
      });
    }

    // Comments
    const comments = Array.isArray(incident.comments) ? incident.comments : [];
    for (const comment of comments) {
      const c = comment as Record<string, unknown>;
      timeline.push({
        timestamp: (c.createdAt as string) || incident.createdAt.toISOString(),
        type: 'comment',
        description: c.content as string,
        details: {
          authorId: c.authorId,
          authorName: c.authorName,
        },
      });
    }

    // Audit entries
    for (const audit of auditTrail) {
      timeline.push({
        timestamp: audit.createdAt.toISOString(),
        type: 'audit',
        description: `Action: ${audit.action}`,
        details: audit.afterState,
      });
    }

    // Closure entry
    if (incident.closedAt) {
      timeline.push({
        timestamp: incident.closedAt.toISOString(),
        type: 'closed',
        description: 'Incident closed',
      });
    }

    // Sort timeline by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      incident: {
        id: incident.id,
        title: incident.title,
        status: incident.status,
        priority: incident.priority,
        createdAt: incident.createdAt.toISOString(),
        closedAt: incident.closedAt?.toISOString() ?? null,
      },
      timeline,
      related_events_count: relatedEvents.length,
      comments_count: comments.length,
    };
  },
};

// ── close_incident ────────────────────────────────────────────

export const closeIncident: MCPServerTool = {
  name: 'close_incident',
  description:
    'Close an incident with resolution notes. Sets the status to "closed" and records the resolution timestamp.',
  parameters: {
    incident_id: {
      type: 'string',
      description: 'Incident UUID to close (required)',
      required: true,
    },
    resolution_notes: {
      type: 'string',
      description: 'Resolution notes explaining how the incident was resolved (required)',
      required: true,
    },
  },
  execute: async (params, context) => {
    const incidentId = params.incident_id as string;
    const resolutionNotes = params.resolution_notes as string;

    if (!incidentId || !resolutionNotes) {
      return { error: 'incident_id and resolution_notes are required' };
    }

    // Verify incident belongs to tenant
    const [existing] = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, context.tenantId)))
      .limit(1);

    if (!existing) {
      return { error: `Incident '${incidentId}' not found` };
    }

    if (existing.status === 'closed') {
      return { error: 'Incident is already closed' };
    }

    // Add resolution comment
    const closingComment = {
      id: crypto.randomUUID(),
      content: `[RESOLUTION] ${resolutionNotes}`,
      authorId: context.userId,
      authorName: 'MCP Agent',
      createdAt: new Date().toISOString(),
    };

    const currentComments = Array.isArray(existing.comments) ? existing.comments : [];

    const [incident] = await db
      .update(incidents)
      .set({
        status: 'closed',
        closedAt: new Date(),
        comments: [...currentComments, closingComment],
        updatedAt: new Date(),
      })
      .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, context.tenantId)))
      .returning();

    return {
      message: 'Incident closed successfully',
      incident: {
        id: incident.id,
        title: incident.title,
        status: incident.status,
        priority: incident.priority,
        closedAt: incident.closedAt?.toISOString(),
        resolutionNotes,
      },
    };
  },
};

/** All incident management tools */
export const incidentServerTools: MCPServerTool[] = [
  createIncident,
  updateIncident,
  addIncidentComment,
  getIncidentTimeline,
  closeIncident,
];
