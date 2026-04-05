/**
 * MCP Tools — Remote Access
 *
 * AI agent tools for remote device access, connectivity testing,
 * and port forwarding management via AION Remote Connect.
 */

import type { MCPServerTool } from './index.js';
import { remoteAccess } from '../../../services/remote-access.js';
import { db } from '../../../db/client.js';
import { sites, devices } from '../../../db/schema/index.js';
import { eq, and, ilike } from 'drizzle-orm';

export const remoteAccessTools: MCPServerTool[] = [
  // ── Site Access Map ─────────────────────────────────────────
  {
    name: 'get_site_access_map',
    description: 'Get complete remote access map for a site: all devices with their WAN IPs, mapped ports, access URLs (HTTP, RTSP, SIP), and port forwarding requirements. Use when the user asks how to access devices at a site remotely.',
    parameters: {
      site_name: {
        type: 'string',
        description: 'Site name to search (partial match supported)',
        required: true,
      },
    },
    execute: async (params, ctx) => {
      const name = params.site_name as string;

      // Find site by partial name match
      const matchedSites = await db
        .select({ id: sites.id, name: sites.name })
        .from(sites)
        .where(and(eq(sites.tenantId, ctx.tenantId), ilike(sites.name, `%${name}%`)))
        .limit(5);

      if (!matchedSites.length) {
        return { error: `No site found matching "${name}"` };
      }

      const site = matchedSites[0];
      return remoteAccess.getSiteAccessMap(ctx.tenantId, site.id);
    },
  },

  // ── Port Forwarding Guide ───────────────────────────────────
  {
    name: 'get_port_forwarding_guide',
    description: 'Generate complete port forwarding configuration guide for a site router. Returns all rules needed to enable remote access to all devices (cameras, DVRs, intercoms, access control). Use when the user needs to configure their router.',
    parameters: {
      site_name: {
        type: 'string',
        description: 'Site name (partial match)',
        required: true,
      },
    },
    execute: async (params, ctx) => {
      const name = params.site_name as string;

      const matchedSites = await db
        .select({ id: sites.id })
        .from(sites)
        .where(and(eq(sites.tenantId, ctx.tenantId), ilike(sites.name, `%${name}%`)))
        .limit(1);

      if (!matchedSites.length) {
        return { error: `No site found matching "${name}"` };
      }

      return remoteAccess.generatePortForwardingGuide(ctx.tenantId, matchedSites[0].id);
    },
  },

  // ── Test Site Connectivity ──────────────────────────────────
  {
    name: 'test_site_connectivity',
    description: 'Test TCP connectivity to all devices at a site via their WAN IP and mapped ports. Returns which devices are reachable and their latency. Use to diagnose network issues.',
    parameters: {
      site_name: {
        type: 'string',
        description: 'Site name (partial match)',
        required: true,
      },
    },
    execute: async (params, ctx) => {
      const name = params.site_name as string;

      const matchedSites = await db
        .select({ id: sites.id, name: sites.name })
        .from(sites)
        .where(and(eq(sites.tenantId, ctx.tenantId), ilike(sites.name, `%${name}%`)))
        .limit(1);

      if (!matchedSites.length) {
        return { error: `No site found matching "${name}"` };
      }

      const results = await remoteAccess.testSiteConnectivity(ctx.tenantId, matchedSites[0].id);
      const online = results.filter((r) => r.reachable).length;

      return {
        site: matchedSites[0].name,
        summary: { total: results.length, online, offline: results.length - online },
        devices: results,
      };
    },
  },

  // ── Proxy HTTP Request ──────────────────────────────────────
  {
    name: 'proxy_device_request',
    description: 'Send an HTTP request to a remote device through the AION proxy. Supports ISAPI, CGI, and web interface access. Use for device info retrieval, configuration, or control.',
    parameters: {
      device_name: {
        type: 'string',
        description: 'Device name (partial match)',
        required: true,
      },
      path: {
        type: 'string',
        description: 'HTTP path (e.g. /ISAPI/System/deviceInfo, /cgi-bin/magicBox.cgi?action=getSystemInfo)',
        required: true,
      },
      method: {
        type: 'string',
        description: 'HTTP method',
        enum: ['GET', 'POST', 'PUT', 'DELETE'],
      },
    },
    execute: async (params, ctx) => {
      const name = params.device_name as string;
      const path = params.path as string;
      const method = (params.method as string) ?? 'GET';

      // Find device by name
      const matchedDevices = await db
        .select({ id: devices.id })
        .from(devices)
        .where(and(eq(devices.tenantId, ctx.tenantId), ilike(devices.name, `%${name}%`)))
        .limit(1);

      if (!matchedDevices.length) {
        return { error: `No device found matching "${name}"` };
      }

      const target = await remoteAccess.resolveTarget(ctx.tenantId, matchedDevices[0].id);

      const response = await remoteAccess.proxyHttpRequest(target, {
        method,
        path,
        headers: {},
        timeout: 15000,
      });

      return {
        deviceName: target.name,
        siteName: target.siteName,
        remoteAddress: `${target.host}:${target.port}`,
        statusCode: response.statusCode,
        body: response.body.toString('utf-8'),
        latencyMs: response.latencyMs,
      };
    },
  },

  // ── Remote Device Info ──────────────────────────────────────
  {
    name: 'get_remote_device_info',
    description: 'Get device information by probing it remotely via HTTP. Automatically selects the right API (ISAPI for Hikvision, CGI for Dahua, VAPIX for Axis). Use to check device model, firmware, serial number.',
    parameters: {
      device_name: {
        type: 'string',
        description: 'Device name (partial match)',
        required: true,
      },
    },
    execute: async (params, ctx) => {
      const name = params.device_name as string;

      const matchedDevices = await db
        .select({ id: devices.id })
        .from(devices)
        .where(and(eq(devices.tenantId, ctx.tenantId), ilike(devices.name, `%${name}%`)))
        .limit(1);

      if (!matchedDevices.length) {
        return { error: `No device found matching "${name}"` };
      }

      const target = await remoteAccess.resolveTarget(ctx.tenantId, matchedDevices[0].id);
      const brand = target.brand.toLowerCase();

      let probePath = '/';
      if (brand === 'hikvision') probePath = '/ISAPI/System/deviceInfo';
      else if (brand === 'dahua') probePath = '/cgi-bin/magicBox.cgi?action=getSystemInfo';
      else if (brand === 'axis') probePath = '/axis-cgi/basicdeviceinfo.cgi';

      const response = await remoteAccess.proxyHttpRequest(target, {
        method: 'GET',
        path: probePath,
        headers: {},
        timeout: 10000,
      });

      return {
        deviceName: target.name,
        siteName: target.siteName,
        brand: target.brand,
        remoteAddress: `${target.host}:${target.port}`,
        statusCode: response.statusCode,
        info: response.body.toString('utf-8'),
        latencyMs: response.latencyMs,
      };
    },
  },

  // ── Remote Door Control ─────────────────────────────────────
  {
    name: 'remote_door_control',
    description: 'Open or close a door/relay on a remote access control device (Hikvision or Dahua). Use when the user asks to open a gate, door, or barrier remotely.',
    parameters: {
      device_name: {
        type: 'string',
        description: 'Device name (partial match)',
        required: true,
      },
      action: {
        type: 'string',
        description: 'Action to perform',
        required: true,
        enum: ['open', 'close', 'status'],
      },
      door: {
        type: 'number',
        description: 'Door/relay number (default 1)',
      },
    },
    execute: async (params, ctx) => {
      const name = params.device_name as string;
      const action = params.action as string;
      const door = (params.door as number) ?? 1;

      const matchedDevices = await db
        .select({ id: devices.id })
        .from(devices)
        .where(and(eq(devices.tenantId, ctx.tenantId), ilike(devices.name, `%${name}%`)))
        .limit(1);

      if (!matchedDevices.length) {
        return { error: `No device found matching "${name}"` };
      }

      const target = await remoteAccess.resolveTarget(ctx.tenantId, matchedDevices[0].id);
      const brand = target.brand.toLowerCase();

      let path: string;
      let method: string;
      let body: string | undefined;

      if (brand === 'hikvision') {
        path = `/ISAPI/AccessControl/RemoteControl/door/${door}`;
        method = action === 'status' ? 'GET' : 'PUT';
        if (action !== 'status') {
          body = `<RemoteControlDoor><cmd>${action}</cmd></RemoteControlDoor>`;
        }
      } else if (brand === 'dahua') {
        path = `/cgi-bin/accessControl.cgi?action=${action === 'open' ? 'openDoor' : 'closeDoor'}&channel=${door}`;
        method = 'GET';
      } else {
        return { error: `Door control not supported for brand: ${target.brand}` };
      }

      const response = await remoteAccess.proxyHttpRequest(target, {
        method,
        path,
        headers: body ? { 'Content-Type': 'application/xml' } : {},
        body,
        timeout: 10000,
      });

      return {
        deviceName: target.name,
        action,
        door,
        success: response.statusCode >= 200 && response.statusCode < 300,
        response: response.body.toString('utf-8'),
      };
    },
  },
];
