/**
 * Network Scanning & Discovery Routes
 *
 * Provides API endpoints for network reconnaissance:
 * - TCP port scanning (single host, range, specific ports)
 * - ONVIF WS-Discovery multicast
 * - Device brand identification
 * - ARP table & local interface enumeration
 * - Site-wide batch health checks
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { networkScanner } from '../../services/network-scanner.js';
import { db } from '../../db/client.js';
import { devices, sites } from '../../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';

const ALLOWED_ROLES = ['operator', 'tenant_admin', 'super_admin'] as const;

export async function registerNetworkRoutes(app: FastifyInstance) {

  // ── GET /status — Network overview status ──────────────────────────────

  app.get(
    '/status',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: {
        tags: ['Network'],
        summary: 'Get network status overview',
      },
    },
    async (request, reply) => {
      const tenantId = request.tenantId;

      // Get device counts grouped by status
      const deviceRows = await db
        .select({
          total: sql<number>`count(*)::int`,
          online: sql<number>`count(*) filter (where ${devices.status} = 'online')::int`,
          offline: sql<number>`count(*) filter (where ${devices.status} = 'offline')::int`,
        })
        .from(devices)
        .where(eq(devices.tenantId, tenantId));

      const stats = deviceRows[0] ?? { total: 0, online: 0, offline: 0 };

      const ifaces = await networkScanner.getLocalInterfaces();

      return reply.send({
        success: true,
        data: {
          devices: stats,
          interfaces: ifaces,
        },
      });
    },
  );

  // ── POST /scan/host — Scan all common security ports on a single host ──

  app.post<{ Body: { host: string; timeout?: number } }>(
    '/scan/host',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: {
        tags: ['Network'],
        summary: 'Scan common security device ports on a single host',
        body: {
          type: 'object',
          required: ['host'],
          properties: {
            host: { type: 'string', description: 'IP address or hostname' },
            timeout: { type: 'number', description: 'Timeout per port in ms (default 3000)' },
          },
        },
      },
    },
    async (request, reply) => {
      const { host, timeout } = request.body;

      if (!host || !/^[\w.:%-]+$/.test(host)) {
        return reply.code(400).send({ success: false, error: 'Invalid host' });
      }

      const result = await networkScanner.scanHost(host, { timeout });
      return reply.send({ success: true, data: result });
    },
  );

  // ── POST /scan/range — Scan an IP range (CIDR or start-end) ───────────

  app.post<{ Body: { range: string; ports?: number[]; concurrency?: number; timeout?: number } }>(
    '/scan/range',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: {
        tags: ['Network'],
        summary: 'Scan IP range for active hosts with open ports',
        body: {
          type: 'object',
          required: ['range'],
          properties: {
            range: { type: 'string', description: 'CIDR (192.168.1.0/24) or dash range (192.168.1.1-50)' },
            ports: { type: 'array', items: { type: 'number' }, description: 'Specific ports to scan' },
            concurrency: { type: 'number', description: 'Parallel host limit (default 20)' },
            timeout: { type: 'number', description: 'Timeout per port in ms (default 3000)' },
          },
        },
      },
    },
    async (request, reply) => {
      const { range, ports, concurrency, timeout } = request.body;

      if (!range) {
        return reply.code(400).send({ success: false, error: 'Range is required' });
      }

      try {
        const results = await networkScanner.scanRange(range, { ports, concurrency, timeout });
        return reply.send({
          success: true,
          data: {
            range,
            hostsScanned: range.includes('/') ? 'CIDR' : 'range',
            hostsFound: results.length,
            hosts: results,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Scan failed';
        return reply.code(400).send({ success: false, error: msg });
      }
    },
  );

  // ── POST /scan/ports — Scan specific ports on a host ──────────────────

  app.post<{ Body: { host: string; ports: number[]; timeout?: number } }>(
    '/scan/ports',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: {
        tags: ['Network'],
        summary: 'Scan specific ports on a host',
        body: {
          type: 'object',
          required: ['host', 'ports'],
          properties: {
            host: { type: 'string' },
            ports: { type: 'array', items: { type: 'number' }, minItems: 1, maxItems: 100 },
            timeout: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { host, ports, timeout } = request.body;

      if (!host || !ports?.length) {
        return reply.code(400).send({ success: false, error: 'Host and ports are required' });
      }
      if (ports.length > 100) {
        return reply.code(400).send({ success: false, error: 'Maximum 100 ports per request' });
      }

      const results = await Promise.all(
        ports.map(async (port) => {
          const scan = await networkScanner.scanPort(host, port, timeout);
          return { port, ...scan };
        }),
      );

      return reply.send({ success: true, data: { host, ports: results } });
    },
  );

  // ── GET /discover/onvif — ONVIF WS-Discovery multicast ───────────────

  app.get<{ Querystring: { timeout?: number } }>(
    '/discover/onvif',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: {
        tags: ['Network'],
        summary: 'Discover ONVIF devices via WS-Discovery multicast',
        querystring: {
          type: 'object',
          properties: {
            timeout: { type: 'number', description: 'Discovery timeout in ms (default 5000)' },
          },
        },
      },
    },
    async (request, reply) => {
      const timeout = request.query.timeout ?? 5000;
      const clampedTimeout = Math.min(Math.max(timeout, 1000), 30000);

      const onvifDevices = await networkScanner.discoverOnvif(clampedTimeout);
      return reply.send({ success: true, data: onvifDevices });
    },
  );

  // ── POST /identify — Identify device brand from IP/port ───────────────

  app.post<{ Body: { host: string; port?: number } }>(
    '/identify',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: {
        tags: ['Network'],
        summary: 'Identify device brand/model via HTTP fingerprinting',
        body: {
          type: 'object',
          required: ['host'],
          properties: {
            host: { type: 'string' },
            port: { type: 'number', default: 80 },
          },
        },
      },
    },
    async (request, reply) => {
      const { host, port } = request.body;

      if (!host) {
        return reply.code(400).send({ success: false, error: 'Host is required' });
      }

      const identification = await networkScanner.identifyDevice(host, port);
      return reply.send({ success: true, data: identification });
    },
  );

  // ── GET /interfaces — List local network interfaces ───────────────────

  app.get(
    '/interfaces',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: {
        tags: ['Network'],
        summary: 'List local network interfaces with IPv4 addresses',
      },
    },
    async (_request, reply) => {
      const ifaces = await networkScanner.getLocalInterfaces();
      return reply.send({ success: true, data: ifaces });
    },
  );

  // ── GET /arp — Get ARP table ──────────────────────────────────────────

  app.get(
    '/arp',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: {
        tags: ['Network'],
        summary: 'Get ARP table (IP to MAC address mappings)',
      },
    },
    async (_request, reply) => {
      const entries = await networkScanner.getArpTable();
      return reply.send({ success: true, data: entries });
    },
  );

  // ── POST /ping — Simple TCP ping to host:port ────────────────────────

  app.post<{ Body: { host: string; port: number; timeout?: number } }>(
    '/ping',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: {
        tags: ['Network'],
        summary: 'TCP ping a host:port',
        body: {
          type: 'object',
          required: ['host', 'port'],
          properties: {
            host: { type: 'string' },
            port: { type: 'number' },
            timeout: { type: 'number', default: 5000 },
          },
        },
      },
    },
    async (request, reply) => {
      const { host, port, timeout } = request.body;

      if (!host || !port) {
        return reply.code(400).send({ success: false, error: 'Host and port are required' });
      }

      const result = await networkScanner.scanPort(host, port, timeout ?? 5000);
      return reply.send({
        success: true,
        data: {
          host,
          port,
          reachable: result.open,
          latencyMs: result.open ? result.latencyMs : null,
        },
      });
    },
  );

  // ── POST /site/:siteId/scan — Batch scan all devices in a site ────────

  app.post<{ Params: { siteId: string }; Body: { timeout?: number } }>(
    '/site/:siteId/scan',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: {
        tags: ['Network'],
        summary: 'Scan all devices in a site (batch health check + port scan)',
        params: {
          type: 'object',
          required: ['siteId'],
          properties: {
            siteId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            timeout: { type: 'number', description: 'Timeout per port in ms (default 3000)' },
          },
        },
      },
    },
    async (request, reply) => {
      const { siteId } = request.params;
      const timeout = request.body?.timeout ?? 3000;

      // Verify site belongs to tenant
      const [site] = await db
        .select()
        .from(sites)
        .where(and(eq(sites.id, siteId), eq(sites.tenantId, request.tenantId)))
        .limit(1);

      if (!site) {
        return reply.code(404).send({ success: false, error: 'Site not found' });
      }

      // Get all devices for this site
      const siteDevices = await db
        .select({
          id: devices.id,
          name: devices.name,
          ipAddress: devices.ipAddress,
          port: devices.port,
          httpPort: devices.httpPort,
          rtspPort: devices.rtspPort,
          type: devices.type,
          brand: devices.brand,
        })
        .from(devices)
        .where(and(eq(devices.siteId, siteId), eq(devices.tenantId, request.tenantId)));

      if (!siteDevices.length) {
        return reply.send({
          success: true,
          data: { siteId, siteName: site.name, devices: [], summary: { total: 0, online: 0, offline: 0 } },
        });
      }

      // Scan each device in parallel
      const scanResults = await Promise.all(
        siteDevices.map(async (device) => {
          if (!device.ipAddress) {
            return { ...device, status: 'no_ip' as const, scan: null };
          }

          const scanResult = await networkScanner.scanHost(device.ipAddress, { timeout });
          const hasOpenPorts = scanResult.ports.some((p) => p.open);

          return {
            id: device.id,
            name: device.name,
            ipAddress: device.ipAddress,
            type: device.type,
            brand: device.brand,
            status: hasOpenPorts ? 'online' as const : 'offline' as const,
            scan: scanResult,
          };
        }),
      );

      const online = scanResults.filter((r) => r.status === 'online').length;
      const offline = scanResults.filter((r) => r.status === 'offline').length;
      const noIp = scanResults.filter((r) => r.status === 'no_ip').length;

      return reply.send({
        success: true,
        data: {
          siteId,
          siteName: site.name,
          devices: scanResults,
          summary: {
            total: scanResults.length,
            online,
            offline,
            noIp,
          },
        },
      });
    },
  );
}
