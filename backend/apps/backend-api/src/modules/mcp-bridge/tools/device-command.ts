/**
 * MCP Server Tool — Device Command Server
 *
 * Provides tools for sending commands to physical devices (gates,
 * relays, reboots) and querying real-time device status. Every
 * command verifies tenant ownership of the device before execution
 * and records the action in the audit log.
 */

import { eq, and } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import {
  devices,
  sites,
  rebootTasks,
  domoticDevices,
  domoticActions,
  accessLogs,
  auditLogs,
} from '../../../db/schema/index.js';
import type { MCPServerTool } from './index.js';

// ── Helpers ───────────────────────────────────────────────────

/**
 * Verify a device exists and belongs to the given tenant.
 * Returns the device row or null.
 */
async function verifyDeviceOwnership(
  deviceId: string,
  tenantId: string,
): Promise<Record<string, unknown> | null> {
  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.tenantId, tenantId)))
    .limit(1);

  return device ?? null;
}

/**
 * Record a device command in the audit log.
 */
async function auditDeviceCommand(
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
    action: `mcp.device.${action}`,
    entityType: 'device',
    entityId: deviceId,
    afterState: details,
  });
}

// ── open_gate ─────────────────────────────────────────────────

export const openGate: MCPServerTool = {
  name: 'open_gate',
  description:
    'Send an open gate command to an access control device. Requires the device to be of type "access_control" and belong to the tenant.',
  parameters: {
    device_id: {
      type: 'string',
      description: 'Device UUID of the access control device (required)',
      required: true,
    },
    reason: {
      type: 'string',
      description: 'Reason for opening the gate (required for audit)',
      required: true,
    },
  },
  execute: async (params, context) => {
    const deviceId = params.device_id as string;
    const reason = params.reason as string;

    if (!deviceId || !reason) {
      return { error: 'device_id and reason are required' };
    }

    const device = await verifyDeviceOwnership(deviceId, context.tenantId);
    if (!device) {
      return { error: `Device '${deviceId}' not found or does not belong to this tenant` };
    }

    if (device.type !== 'access_control') {
      return {
        error: `Device '${device.name}' is of type '${device.type}', not 'access_control'. Cannot send gate command.`,
      };
    }

    if (device.status === 'offline') {
      return {
        error: `Device '${device.name}' is currently offline. Cannot send command.`,
      };
    }

    // Record the access log
    await db.insert(accessLogs).values({
      tenantId: context.tenantId,
      direction: 'in',
      method: 'mcp_remote',
      notes: `MCP Agent gate open: ${reason}`,
      operatorId: context.userId,
    });

    // Audit log the command
    await auditDeviceCommand(context.tenantId, context.userId, 'open_gate', deviceId, {
      reason,
      deviceName: device.name,
      timestamp: new Date().toISOString(),
    });

    return {
      message: `Gate open command sent to '${device.name}'`,
      device_id: deviceId,
      device_name: device.name,
      command: 'open_gate',
      reason,
      status: 'command_sent',
      timestamp: new Date().toISOString(),
    };
  },
};

// ── reboot_device ─────────────────────────────────────────────

export const rebootDevice: MCPServerTool = {
  name: 'reboot_device',
  description:
    'Send a reboot command to a device. Creates a reboot task record and returns the task status. Device must belong to the tenant.',
  parameters: {
    device_id: {
      type: 'string',
      description: 'Device UUID to reboot (required)',
      required: true,
    },
    reason: {
      type: 'string',
      description: 'Reason for the reboot (required for audit)',
      required: true,
    },
  },
  execute: async (params, context) => {
    const deviceId = params.device_id as string;
    const reason = params.reason as string;

    if (!deviceId || !reason) {
      return { error: 'device_id and reason are required' };
    }

    const device = await verifyDeviceOwnership(deviceId, context.tenantId);
    if (!device) {
      return { error: `Device '${deviceId}' not found or does not belong to this tenant` };
    }

    // Create reboot task
    const [task] = await db
      .insert(rebootTasks)
      .values({
        tenantId: context.tenantId,
        deviceId,
        reason,
        status: 'pending',
        initiatedBy: context.userId,
      })
      .returning();

    // Audit log the command
    await auditDeviceCommand(context.tenantId, context.userId, 'reboot', deviceId, {
      reason,
      deviceName: device.name,
      taskId: task.id,
      timestamp: new Date().toISOString(),
    });

    return {
      message: `Reboot command queued for '${device.name}'`,
      task_id: task.id,
      device_id: deviceId,
      device_name: device.name,
      command: 'reboot',
      reason,
      status: task.status,
      timestamp: new Date().toISOString(),
    };
  },
};

// ── toggle_relay ──────────────────────────────────────────────

export const toggleRelay: MCPServerTool = {
  name: 'toggle_relay',
  description:
    'Toggle a domotic relay device on or off. The device must be of type "relay" in the domotic_devices table and belong to the tenant.',
  parameters: {
    device_id: {
      type: 'string',
      description: 'Domotic device UUID to toggle (required)',
      required: true,
    },
    state: {
      type: 'string',
      description: 'Desired state',
      required: true,
      enum: ['on', 'off'],
    },
    reason: {
      type: 'string',
      description: 'Reason for toggling the relay (required for audit)',
      required: true,
    },
  },
  execute: async (params, context) => {
    const deviceId = params.device_id as string;
    const state = params.state as string;
    const reason = params.reason as string;

    if (!deviceId || !state || !reason) {
      return { error: 'device_id, state, and reason are required' };
    }

    if (state !== 'on' && state !== 'off') {
      return { error: "state must be 'on' or 'off'" };
    }

    // Verify domotic device belongs to tenant
    const [domoticDevice] = await db
      .select()
      .from(domoticDevices)
      .where(and(eq(domoticDevices.id, deviceId), eq(domoticDevices.tenantId, context.tenantId)))
      .limit(1);

    if (!domoticDevice) {
      return { error: `Domotic device '${deviceId}' not found or does not belong to this tenant` };
    }

    if (domoticDevice.status === 'offline') {
      return {
        error: `Device '${domoticDevice.name}' is currently offline. Cannot send command.`,
      };
    }

    // Update device state
    await db
      .update(domoticDevices)
      .set({
        state,
        lastAction: `mcp_toggle_${state}`,
        updatedAt: new Date(),
      })
      .where(eq(domoticDevices.id, deviceId));

    // Record action
    await db.insert(domoticActions).values({
      tenantId: context.tenantId,
      deviceId,
      action: `toggle_${state}`,
      result: 'command_sent',
      userId: context.userId,
    });

    // Audit log
    await db.insert(auditLogs).values({
      tenantId: context.tenantId,
      userId: context.userId,
      userEmail: 'mcp-agent',
      action: 'mcp.device.toggle_relay',
      entityType: 'domotic_device',
      entityId: deviceId,
      afterState: {
        reason,
        deviceName: domoticDevice.name,
        previousState: domoticDevice.state,
        newState: state,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      message: `Relay '${domoticDevice.name}' toggled to '${state}'`,
      device_id: deviceId,
      device_name: domoticDevice.name,
      previous_state: domoticDevice.state,
      new_state: state,
      reason,
      status: 'command_sent',
      timestamp: new Date().toISOString(),
    };
  },
};

// ── get_device_status ─────────────────────────────────────────

export const getDeviceStatus: MCPServerTool = {
  name: 'get_device_status',
  description:
    'Get real-time status of a specific device including connectivity info, last seen time, and site details.',
  parameters: {
    device_id: {
      type: 'string',
      description: 'Device UUID to check status of (required)',
      required: true,
    },
  },
  execute: async (params, context) => {
    const deviceId = params.device_id as string;
    if (!deviceId) {
      return { error: 'device_id is required' };
    }

    const [row] = await db
      .select({
        device: devices,
        siteName: sites.name,
        siteWanIp: sites.wanIp,
        siteStatus: sites.status,
      })
      .from(devices)
      .leftJoin(sites, eq(devices.siteId, sites.id))
      .where(and(eq(devices.id, deviceId), eq(devices.tenantId, context.tenantId)))
      .limit(1);

    if (!row) {
      return { error: `Device '${deviceId}' not found or does not belong to this tenant` };
    }

    const d = row.device;
    const remoteAddress =
      row.siteWanIp && d.port ? `${row.siteWanIp}:${d.port}` : null;

    return {
      device: {
        id: d.id,
        name: d.name,
        type: d.type,
        brand: d.brand,
        model: d.model,
        status: d.status,
        ipAddress: d.ipAddress,
        port: d.port,
        channels: d.channels,
        firmwareVersion: d.firmwareVersion,
        serialNumber: d.serialNumber,
        lastSeen: d.lastSeen?.toISOString() ?? null,
        tags: d.tags,
        capabilities: d.capabilities,
        remoteAddress,
      },
      site: {
        id: d.siteId,
        name: row.siteName,
        wanIp: row.siteWanIp,
        status: row.siteStatus,
      },
      checked_at: new Date().toISOString(),
    };
  },
};

// ── list_device_capabilities ──────────────────────────────────

export const listDeviceCapabilities: MCPServerTool = {
  name: 'list_device_capabilities',
  description:
    'List what commands and capabilities a device supports based on its type and configuration.',
  parameters: {
    device_id: {
      type: 'string',
      description: 'Device UUID to list capabilities for (required)',
      required: true,
    },
  },
  execute: async (params, context) => {
    const deviceId = params.device_id as string;
    if (!deviceId) {
      return { error: 'device_id is required' };
    }

    const device = await verifyDeviceOwnership(deviceId, context.tenantId);
    if (!device) {
      return { error: `Device '${deviceId}' not found or does not belong to this tenant` };
    }

    // Determine capabilities based on device type
    const typeCapabilities: Record<string, string[]> = {
      camera: ['live_view', 'playback', 'snapshot', 'reboot', 'health_check'],
      nvr: ['live_view', 'playback', 'reboot', 'health_check', 'channel_list'],
      dvr: ['live_view', 'playback', 'reboot', 'health_check', 'channel_list'],
      access_control: ['open_gate', 'health_check', 'access_log'],
      domotic: ['toggle_relay', 'get_state', 'health_check'],
      intercom: ['call', 'open_door', 'reboot', 'health_check'],
      sensor: ['get_reading', 'health_check'],
      alarm_panel: ['arm', 'disarm', 'status', 'health_check'],
      network_switch: ['reboot', 'port_status', 'health_check'],
      router: ['reboot', 'wan_status', 'health_check'],
    };

    const deviceType = device.type as string;
    const storedCapabilities = device.capabilities as Record<string, unknown>;
    const baseCapabilities = typeCapabilities[deviceType] ?? ['health_check'];

    // Merge stored capabilities with type-based defaults
    const customCapabilities = Object.keys(storedCapabilities).filter(
      (k) => storedCapabilities[k] === true,
    );

    const allCapabilities = [...new Set([...baseCapabilities, ...customCapabilities])];

    return {
      device_id: deviceId,
      device_name: device.name,
      device_type: deviceType,
      brand: device.brand,
      model: device.model,
      status: device.status,
      capabilities: allCapabilities,
      available_commands: allCapabilities.filter((c) =>
        ['open_gate', 'toggle_relay', 'reboot', 'call', 'open_door', 'arm', 'disarm'].includes(c),
      ),
      stored_capabilities: storedCapabilities,
    };
  },
};

/** All device command tools */
export const deviceCommandTools: MCPServerTool[] = [
  openGate,
  rebootDevice,
  toggleRelay,
  getDeviceStatus,
  listDeviceCapabilities,
];
