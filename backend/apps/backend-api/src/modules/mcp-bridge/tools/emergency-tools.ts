/**
 * MCP Server Tool — Emergency Management
 *
 * Provides tools for listing emergency protocols, contacts, and
 * activating emergency protocols. All operations are tenant-scoped.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { emergencyProtocols, emergencyContacts, emergencyActivations } from '../../../db/schema/index.js';
import type { MCPServerTool } from './index.js';

// ── list_emergency_protocols ───────────────────────────────────

export const listEmergencyProtocols: MCPServerTool = {
  name: 'list_emergency_protocols',
  description:
    'List available emergency protocols (intrusion, fire, medical, panic, etc). Returns all protocols for the tenant.',
  parameters: {},
  execute: async (_params, context) => {
    const results = await db
      .select({
        id: emergencyProtocols.id,
        name: emergencyProtocols.name,
        type: emergencyProtocols.type,
        description: emergencyProtocols.description,
        priority: emergencyProtocols.priority,
        isActive: emergencyProtocols.isActive,
      })
      .from(emergencyProtocols)
      .where(eq(emergencyProtocols.tenantId, context.tenantId))
      .orderBy(emergencyProtocols.priority);

    return {
      protocols: results,
      total: results.length,
    };
  },
};

// ── list_emergency_contacts ────────────────────────────────────

export const listEmergencyContacts: MCPServerTool = {
  name: 'list_emergency_contacts',
  description:
    'List emergency contacts with phone numbers, roles, and priority. Returns contacts ordered by priority.',
  parameters: {},
  execute: async (_params, context) => {
    const results = await db
      .select({
        id: emergencyContacts.id,
        name: emergencyContacts.name,
        phone: emergencyContacts.phone,
        email: emergencyContacts.email,
        role: emergencyContacts.role,
        priority: emergencyContacts.priority,
        isActive: emergencyContacts.isActive,
      })
      .from(emergencyContacts)
      .where(eq(emergencyContacts.tenantId, context.tenantId))
      .orderBy(emergencyContacts.priority);

    return {
      contacts: results,
      total: results.length,
    };
  },
};

// ── activate_emergency_protocol ────────────────────────────────

export const activateEmergencyProtocol: MCPServerTool = {
  name: 'activate_emergency_protocol',
  description:
    'Activate an emergency protocol. USE WITH CAUTION — this triggers real notifications and creates an activation record. Requires a valid protocol ID and reason.',
  parameters: {
    protocol_id: {
      type: 'string',
      description: 'UUID of the emergency protocol to activate',
      required: true,
    },
    reason: {
      type: 'string',
      description: 'Reason for activating the emergency protocol',
      required: true,
    },
  },
  execute: async (params, context) => {
    const protocolId = params.protocol_id as string;
    const reason = params.reason as string;

    // Verify the protocol exists and is active
    const [protocol] = await db
      .select({ id: emergencyProtocols.id, name: emergencyProtocols.name, isActive: emergencyProtocols.isActive })
      .from(emergencyProtocols)
      .where(and(eq(emergencyProtocols.id, protocolId), eq(emergencyProtocols.tenantId, context.tenantId)))
      .limit(1);

    if (!protocol) {
      return { error: `Emergency protocol '${protocolId}' not found or does not belong to this tenant` };
    }

    if (!protocol.isActive) {
      return { error: `Emergency protocol '${protocol.name}' is not active` };
    }

    const now = new Date();
    const timelineEntry = [{ time: now.toISOString(), action: 'Protocol activated via AI assistant', user: context.userId }];

    const [activation] = await db
      .insert(emergencyActivations)
      .values({
        tenantId: context.tenantId,
        protocolId,
        activatedBy: context.userId,
        status: 'active',
        timeline: timelineEntry,
      })
      .returning({ id: emergencyActivations.id });

    return {
      success: true,
      activation_id: activation.id,
      protocol_id: protocolId,
      protocol_name: protocol.name,
      status: 'active',
      reason,
    };
  },
};

/** All emergency tools */
export const emergencyTools: MCPServerTool[] = [
  listEmergencyProtocols,
  listEmergencyContacts,
  activateEmergencyProtocol,
];
