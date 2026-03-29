/**
 * MCP Server Tool — eWeLink Smart Devices
 *
 * Provides tools for listing, toggling, and controlling eWeLink/Sonoff
 * smart devices (doors, sirens, lights, locks) via the eWeLink MCP bridge.
 * Every command is audit-logged.
 */

import { db } from '../../../db/client.js';
import { auditLogs } from '../../../db/schema/index.js';
import { ewelinkMCP } from '../../../services/ewelink-mcp.js';
import { createLogger } from '@aion/common-utils';
import type { MCPServerTool } from './index.js';

const logger = createLogger({ name: 'mcp-ewelink-tools' });

// ── Helpers ───────────────────────────────────────────────────

async function auditEwelinkCommand(
  tenantId: string,
  userId: string,
  action: string,
  deviceId: string,
  details: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLogs).values({
    tenantId,
    userId,
    userEmail: 'mcp-agent',
    action: `mcp.ewelink.${action}`,
    entityType: 'ewelink_device',
    entityId: deviceId,
    afterState: details,
  });
}

// ── list_ewelink_devices ──────────────────────────────────────

export const listEwelinkDevices: MCPServerTool = {
  name: 'list_ewelink_devices',
  description:
    'List all eWeLink smart devices (doors, sirens, lights, locks) with their current status. Returns device IDs, names, online status, and switch state.',
  parameters: {},
  execute: async (_params, context) => {
    if (!ewelinkMCP.isConfigured()) {
      return { error: 'eWeLink MCP bridge is not configured. Set EWELINK_MCP_URL in the backend environment.' };
    }

    const devices = await ewelinkMCP.getDevices();

    // Audit the listing
    await auditEwelinkCommand(context.tenantId, context.userId, 'list_devices', 'all', {
      deviceCount: devices.length,
      timestamp: new Date().toISOString(),
    });

    return devices.map((d) => ({
      id: d.deviceid,
      name: d.name,
      online: d.online,
      switch: d.params?.switch ?? null,
      uiid: d.uiid,
    }));
  },
};

// ── toggle_ewelink_device ─────────────────────────────────────

export const toggleEwelinkDevice: MCPServerTool = {
  name: 'toggle_ewelink_device',
  description:
    'Turn an eWeLink device ON or OFF. Use for doors, sirens, lights, locks, or any Sonoff relay.',
  parameters: {
    deviceId: {
      type: 'string',
      description: 'eWeLink device ID to toggle (required)',
      required: true,
    },
    on: {
      type: 'boolean',
      description: 'true to turn ON, false to turn OFF (required)',
      required: true,
    },
  },
  execute: async (params, context) => {
    const deviceId = params.deviceId as string;
    const on = params.on === true || params.on === 'true';

    if (!deviceId) {
      return { error: 'deviceId is required' };
    }

    if (!ewelinkMCP.isConfigured()) {
      return { error: 'eWeLink MCP bridge is not configured. Set EWELINK_MCP_URL in the backend environment.' };
    }

    const success = await ewelinkMCP.toggleDevice(deviceId, on);

    await auditEwelinkCommand(context.tenantId, context.userId, 'toggle_device', deviceId, {
      on,
      success,
      timestamp: new Date().toISOString(),
    });

    logger.info({ deviceId, on, tenantId: context.tenantId }, 'eWeLink device toggled via MCP tool');

    return {
      success,
      deviceId,
      newState: on ? 'on' : 'off',
    };
  },
};

// ── activate_siren ────────────────────────────────────────────

export const activateSiren: MCPServerTool = {
  name: 'activate_siren',
  description:
    'Activate an eWeLink siren for a specified duration (default 10 seconds), then automatically deactivate it.',
  parameters: {
    deviceId: {
      type: 'string',
      description: 'eWeLink device ID of the siren (required)',
      required: true,
    },
    duration: {
      type: 'number',
      description: 'Seconds to keep siren active (default: 10)',
      required: false,
    },
  },
  execute: async (params, context) => {
    const deviceId = params.deviceId as string;
    const duration = Number(params.duration) || 10;

    if (!deviceId) {
      return { error: 'deviceId is required' };
    }

    if (!ewelinkMCP.isConfigured()) {
      return { error: 'eWeLink MCP bridge is not configured. Set EWELINK_MCP_URL in the backend environment.' };
    }

    const success = await ewelinkMCP.toggleDevice(deviceId, true);

    // Schedule auto-off after duration
    setTimeout(() => {
      ewelinkMCP.toggleDevice(deviceId, false).catch((err) => {
        logger.error({ deviceId, err: err instanceof Error ? err.message : 'unknown' }, 'Siren auto-off failed');
      });
    }, duration * 1000);

    await auditEwelinkCommand(context.tenantId, context.userId, 'activate_siren', deviceId, {
      duration,
      success,
      timestamp: new Date().toISOString(),
    });

    logger.info({ deviceId, duration, tenantId: context.tenantId }, 'Siren activated via MCP tool');

    return {
      success,
      siren: deviceId,
      duration,
      message: `Siren activated for ${duration} seconds`,
    };
  },
};

// ── open_ewelink_door ─────────────────────────────────────────

export const openEwelinkDoor: MCPServerTool = {
  name: 'open_ewelink_door',
  description:
    'Open an eWeLink-controlled door using a pulse: turn ON, wait 3 seconds (or custom duration), then turn OFF.',
  parameters: {
    deviceId: {
      type: 'string',
      description: 'eWeLink device ID of the door relay (required)',
      required: true,
    },
    pulseDuration: {
      type: 'number',
      description: 'Seconds to keep the relay active before auto-off (default: 3)',
      required: false,
    },
  },
  execute: async (params, context) => {
    const deviceId = params.deviceId as string;
    const pulseDuration = Number(params.pulseDuration) || 3;

    if (!deviceId) {
      return { error: 'deviceId is required' };
    }

    if (!ewelinkMCP.isConfigured()) {
      return { error: 'eWeLink MCP bridge is not configured. Set EWELINK_MCP_URL in the backend environment.' };
    }

    const success = await ewelinkMCP.toggleDevice(deviceId, true);

    // Auto-off after pulse duration
    setTimeout(() => {
      ewelinkMCP.toggleDevice(deviceId, false).catch((err) => {
        logger.error({ deviceId, err: err instanceof Error ? err.message : 'unknown' }, 'Door pulse auto-off failed');
      });
    }, pulseDuration * 1000);

    await auditEwelinkCommand(context.tenantId, context.userId, 'open_door', deviceId, {
      pulseDuration,
      success,
      timestamp: new Date().toISOString(),
    });

    logger.info({ deviceId, pulseDuration, tenantId: context.tenantId }, 'Door opened via MCP tool (pulse)');

    return {
      success,
      deviceId,
      pulseDuration,
      message: `Door relay pulsed ON for ${pulseDuration}s then auto-OFF`,
    };
  },
};

/** All eWeLink MCP tools */
export const ewelinkTools: MCPServerTool[] = [
  listEwelinkDevices,
  toggleEwelinkDevice,
  activateSiren,
  openEwelinkDoor,
];
