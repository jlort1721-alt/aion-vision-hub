/**
 * MCP Server Tools — Hikvision ISAPI Direct Control
 *
 * Provides AI agent tools for directly controlling Hikvision DVR/NVR
 * devices via the ISAPI protocol over HTTP Digest Auth.
 */
import type { MCPServerTool } from './index.js';
import { hikvisionISAPI } from '../../../services/hikvision-isapi.js';

export const hikvisionISAPITools: MCPServerTool[] = [
  {
    name: 'test_hikvision_devices',
    description: 'Test connectivity of all Hikvision DVR/NVR devices for the tenant. Returns online/offline status and device model for each.',
    parameters: {},
    execute: async (_params, context) => {
      return hikvisionISAPI.testAllDevices(context.tenantId);
    },
  },
  {
    name: 'get_hikvision_device_info',
    description: 'Get detailed info from a Hikvision device via ISAPI: model, serial number, firmware version, MAC address.',
    parameters: {
      deviceId: { type: 'string', description: 'Device ID from the database', required: true },
    },
    execute: async (params, context) => {
      return hikvisionISAPI.getDeviceInfo(params.deviceId as string, context.tenantId);
    },
  },
  {
    name: 'get_hikvision_channels',
    description: 'List all video input channels on a Hikvision DVR/NVR. Returns channel IDs and names.',
    parameters: {
      deviceId: { type: 'string', description: 'Device ID from the database', required: true },
    },
    execute: async (params, context) => {
      return hikvisionISAPI.getChannels(params.deviceId as string, context.tenantId);
    },
  },
  {
    name: 'get_hikvision_hdd_status',
    description: 'Check HDD health and storage capacity on a Hikvision DVR/NVR. Returns capacity, free space, and status for each HDD.',
    parameters: {
      deviceId: { type: 'string', description: 'Device ID from the database', required: true },
    },
    execute: async (params, context) => {
      return hikvisionISAPI.getHDDStatus(params.deviceId as string, context.tenantId);
    },
  },
  {
    name: 'hikvision_ptz_control',
    description: 'Control PTZ (Pan-Tilt-Zoom) on a Hikvision camera. Can move in a direction, go to preset, or stop movement.',
    parameters: {
      deviceId: { type: 'string', description: 'Device ID from the database', required: true },
      action: { type: 'string', description: 'PTZ action', required: true, enum: ['up', 'down', 'left', 'right', 'zoomIn', 'zoomOut', 'stop', 'preset'] },
      channel: { type: 'string', description: 'Camera channel number (default: 1)' },
      preset: { type: 'string', description: 'Preset number (required when action=preset)' },
      speed: { type: 'string', description: 'Movement speed 1-7 (default: 4)' },
    },
    execute: async (params, context) => {
      const deviceId = params.deviceId as string;
      const channel = parseInt(params.channel as string) || 1;
      const action = params.action as string;

      if (action === 'stop') {
        return { success: await hikvisionISAPI.ptzStop(deviceId, context.tenantId, channel) };
      }
      if (action === 'preset') {
        const preset = parseInt(params.preset as string) || 1;
        return { success: await hikvisionISAPI.ptzPreset(deviceId, context.tenantId, channel, preset) };
      }
      const speed = parseInt(params.speed as string) || 4;
      return { success: await hikvisionISAPI.ptzMove(deviceId, context.tenantId, channel, action, speed) };
    },
  },
  {
    name: 'hikvision_open_door',
    description: 'Open a door connected to a Hikvision access controller via ISAPI relay control.',
    parameters: {
      deviceId: { type: 'string', description: 'Device ID from the database', required: true },
      doorId: { type: 'string', description: 'Door/relay number (default: 1)' },
    },
    execute: async (params, context) => {
      const doorId = parseInt(params.doorId as string) || 1;
      return { success: await hikvisionISAPI.openDoor(params.deviceId as string, context.tenantId, doorId) };
    },
  },
  {
    name: 'hikvision_reboot_device',
    description: 'Reboot a Hikvision DVR/NVR remotely via ISAPI. Use with caution — device will be offline for 2-3 minutes.',
    parameters: {
      deviceId: { type: 'string', description: 'Device ID from the database', required: true },
    },
    execute: async (params, context) => {
      return { success: await hikvisionISAPI.reboot(params.deviceId as string, context.tenantId) };
    },
  },
];
