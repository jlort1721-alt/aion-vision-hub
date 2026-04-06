/**
 * AION Remote Access Routes
 *
 * API endpoints for universal remote device access:
 * - Site access maps (all devices with connection details)
 * - HTTP reverse proxy to any device
 * - Connectivity testing (single device and batch)
 * - Port forwarding guide generation
 * - Proxy session management
 * - Device web interface proxy
 *
 * NOTE: Schema validation uses TypeScript generics only (no JSON Schema / Zod)
 * to avoid Zod v4 compat issues with fastify-type-provider-zod.
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { remoteAccess } from '../../services/remote-access.js';
import { isAllowedProxyPath } from '../../lib/ssrf-protection.js';

const ALLOWED_ROLES = ['operator', 'tenant_admin', 'super_admin'] as const;

export async function registerRemoteAccessRoutes(app: FastifyInstance) {

  // ── GET /sites/:siteId/access-map — Full device access map for a site ──

  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/access-map',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: { tags: ['Remote Access'], summary: 'Get complete access map for all devices at a site' },
    },
    async (request, reply) => {
      const { siteId } = request.params;
      const data = await remoteAccess.getSiteAccessMap(request.tenantId, siteId);
      return reply.send({ success: true, data });
    },
  );

  // ── GET /sites/:siteId/port-forwarding — Port forwarding guide ─────────

  app.get<{ Params: { siteId: string } }>(
    '/sites/:siteId/port-forwarding',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: { tags: ['Remote Access'], summary: 'Generate port forwarding guide for a site' },
    },
    async (request, reply) => {
      const { siteId } = request.params;
      const data = await remoteAccess.generatePortForwardingGuide(request.tenantId, siteId);
      return reply.send({ success: true, data });
    },
  );

  // ── POST /sites/:siteId/test-connectivity — Batch connectivity test ────

  app.post<{ Params: { siteId: string } }>(
    '/sites/:siteId/test-connectivity',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: { tags: ['Remote Access'], summary: 'Test connectivity to all devices at a site' },
    },
    async (request, reply) => {
      const { siteId } = request.params;
      const results = await remoteAccess.testSiteConnectivity(request.tenantId, siteId);
      const online = results.filter((r) => r.reachable).length;
      const offline = results.filter((r) => !r.reachable).length;

      return reply.send({
        success: true,
        data: {
          siteId,
          summary: { total: results.length, online, offline },
          devices: results,
        },
      });
    },
  );

  // ── POST /devices/:deviceId/test — Test single device connectivity ─────

  app.post<{ Params: { deviceId: string }; Body: { port?: number; timeout?: number } }>(
    '/devices/:deviceId/test',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: { tags: ['Remote Access'], summary: 'Test connectivity to a single device' },
    },
    async (request, reply) => {
      const { deviceId } = request.params;
      const { port, timeout } = (request.body as Record<string, unknown>) ?? {};

      const target = await remoteAccess.resolveTarget(
        request.tenantId,
        deviceId,
        port as number | undefined,
      );

      const result = await remoteAccess.testDeviceConnectivity(
        target.host,
        target.port,
        (timeout as number) ?? 5000,
      );

      return reply.send({
        success: true,
        data: {
          deviceId,
          deviceName: target.name,
          siteName: target.siteName,
          host: target.host,
          port: target.port,
          ...result,
        },
      });
    },
  );

  // ── POST /devices/:deviceId/proxy — HTTP reverse proxy to a device ─────

  app.post<{ Params: { deviceId: string }; Body: Record<string, unknown> }>(
    '/devices/:deviceId/proxy',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Remote Access'], summary: 'Proxy HTTP request to a remote device' },
    },
    async (request, reply) => {
      const { deviceId } = request.params;
      const body = (request.body ?? {}) as Record<string, unknown>;
      const method = (body.method as string) ?? 'GET';
      const path = body.path as string;
      const headers = (body.headers as Record<string, string>) ?? {};
      const reqBody = body.body as string | undefined;
      const port = body.port as number | undefined;
      const protocol = (body.protocol as 'http' | 'https') ?? 'http';
      const timeout = body.timeout as number | undefined;

      if (!path) {
        return reply.code(400).send({ success: false, error: 'path is required' });
      }

      // SECURITY: Validate proxy path against allowlist to prevent SSRF
      if (!isAllowedProxyPath(path)) {
        return reply.code(403).send({
          success: false,
          error: `Path '${path}' is not in the allowed proxy path whitelist (ISAPI, cgi-bin, onvif, api, SDK)`,
        });
      }

      const target = await remoteAccess.resolveTarget(
        request.tenantId,
        deviceId,
        port,
        protocol,
      );

      try {
        const response = await remoteAccess.proxyHttpRequest(target, {
          method,
          path,
          headers,
          body: reqBody,
          timeout,
        });

        const contentType = response.headers['content-type'] ?? 'application/octet-stream';
        const isText = contentType.includes('text') || contentType.includes('json') || contentType.includes('xml') || contentType.includes('html');

        return reply.send({
          success: true,
          data: {
            statusCode: response.statusCode,
            headers: response.headers,
            body: isText ? response.body.toString('utf-8') : response.body.toString('base64'),
            bodyEncoding: isText ? 'utf-8' : 'base64',
            latencyMs: response.latencyMs,
            target: {
              host: target.host,
              port: target.port,
              protocol: target.protocol,
              deviceName: target.name,
              siteName: target.siteName,
            },
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Proxy request failed';
        return reply.code(502).send({
          success: false,
          error: msg,
          data: {
            target: { host: target.host, port: target.port, deviceName: target.name, siteName: target.siteName },
          },
        });
      }
    },
  );

  // ── GET /devices/:deviceId/info — Get device info via ISAPI/HTTP probe ─

  app.get<{ Params: { deviceId: string }; Querystring: { port?: string } }>(
    '/devices/:deviceId/info',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: { tags: ['Remote Access'], summary: 'Get device information via remote HTTP probe' },
    },
    async (request, reply) => {
      const { deviceId } = request.params;
      const portStr = (request.query as Record<string, string>).port;
      const port = portStr ? parseInt(portStr, 10) : undefined;

      const target = await remoteAccess.resolveTarget(request.tenantId, deviceId, port);

      let probePath = '/';
      const brand = target.brand.toLowerCase();
      if (brand === 'hikvision') probePath = '/ISAPI/System/deviceInfo';
      else if (brand === 'dahua') probePath = '/cgi-bin/magicBox.cgi?action=getSystemInfo';
      else if (brand === 'axis') probePath = '/axis-cgi/basicdeviceinfo.cgi';

      try {
        const response = await remoteAccess.proxyHttpRequest(target, {
          method: 'GET',
          path: probePath,
          headers: {},
          timeout: 10000,
        });

        return reply.send({
          success: true,
          data: {
            deviceId,
            deviceName: target.name,
            siteName: target.siteName,
            brand: target.brand,
            remoteAddress: `${target.host}:${target.port}`,
            probePath,
            statusCode: response.statusCode,
            responseBody: response.body.toString('utf-8'),
            latencyMs: response.latencyMs,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Probe failed';
        return reply.send({
          success: false,
          error: msg,
          data: {
            deviceId,
            deviceName: target.name,
            remoteAddress: `${target.host}:${target.port}`,
            reachable: false,
          },
        });
      }
    },
  );

  // ── GET /devices/:deviceId/snapshot — Get camera snapshot via proxy ─────

  app.get<{ Params: { deviceId: string }; Querystring: Record<string, string> }>(
    '/devices/:deviceId/snapshot',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: { tags: ['Remote Access'], summary: 'Get camera snapshot via HTTP proxy' },
    },
    async (request, reply) => {
      const { deviceId } = request.params;
      const qs = request.query as Record<string, string>;
      const channel = qs.channel ? parseInt(qs.channel, 10) : 1;
      const port = qs.port ? parseInt(qs.port, 10) : undefined;

      const target = await remoteAccess.resolveTarget(request.tenantId, deviceId, port);

      let snapshotPath: string;
      const brand = target.brand.toLowerCase();

      if (brand === 'hikvision') {
        snapshotPath = `/ISAPI/Streaming/channels/${channel}01/picture`;
      } else if (brand === 'dahua') {
        snapshotPath = `/cgi-bin/snapshot.cgi?channel=${channel}`;
      } else if (brand === 'axis') {
        snapshotPath = `/axis-cgi/jpg/image.cgi?resolution=1920x1080`;
      } else {
        snapshotPath = `/snap.jpg?chn=${channel}`;
      }

      try {
        const response = await remoteAccess.proxyHttpRequest(target, {
          method: 'GET',
          path: snapshotPath,
          headers: {},
          timeout: 10000,
        });

        if (response.statusCode === 200) {
          const contentType = response.headers['content-type'] ?? 'image/jpeg';
          return reply
            .header('Content-Type', contentType)
            .header('X-Device-Name', target.name)
            .header('X-Site-Name', target.siteName)
            .send(response.body);
        }

        return reply.code(response.statusCode).send({
          success: false,
          error: `Device returned ${response.statusCode}`,
          deviceName: target.name,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Snapshot failed';
        return reply.code(502).send({ success: false, error: msg });
      }
    },
  );

  // ── POST /devices/:deviceId/door — Remote door/relay control ───────────

  app.post<{ Params: { deviceId: string }; Body: Record<string, unknown> }>(
    '/devices/:deviceId/door',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Remote Access'], summary: 'Control door/relay on a remote device' },
    },
    async (request, reply) => {
      const { deviceId } = request.params;
      const body = (request.body ?? {}) as Record<string, unknown>;
      const action = body.action as string;
      const door = (body.door as number) ?? 1;
      const port = body.port as number | undefined;

      if (!action || !['open', 'close', 'status'].includes(action)) {
        return reply.code(400).send({ success: false, error: 'action must be open, close, or status' });
      }

      const target = await remoteAccess.resolveTarget(request.tenantId, deviceId, port);
      const brand = target.brand.toLowerCase();

      let reqPath: string;
      let method: string;
      let reqBody: string | undefined;

      if (brand === 'hikvision') {
        if (action === 'status') {
          reqPath = `/ISAPI/AccessControl/RemoteControl/door/${door}`;
          method = 'GET';
        } else {
          reqPath = `/ISAPI/AccessControl/RemoteControl/door/${door}`;
          method = 'PUT';
          reqBody = `<RemoteControlDoor><cmd>${action}</cmd></RemoteControlDoor>`;
        }
      } else if (brand === 'dahua') {
        reqPath = `/cgi-bin/accessControl.cgi?action=${action === 'open' ? 'openDoor' : 'closeDoor'}&channel=${door}`;
        method = 'GET';
      } else {
        return reply.code(400).send({
          success: false,
          error: `Door control not supported for brand: ${target.brand}`,
        });
      }

      try {
        const response = await remoteAccess.proxyHttpRequest(target, {
          method,
          path: reqPath,
          headers: reqBody ? { 'Content-Type': 'application/xml' } : {},
          body: reqBody,
          timeout: 10000,
        });

        return reply.send({
          success: response.statusCode >= 200 && response.statusCode < 300,
          data: {
            deviceId,
            deviceName: target.name,
            action,
            door,
            statusCode: response.statusCode,
            response: response.body.toString('utf-8'),
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Door control failed';
        return reply.code(502).send({ success: false, error: msg });
      }
    },
  );

  // ── POST /devices/:deviceId/ptz — Remote PTZ control ──────────────────

  app.post<{ Params: { deviceId: string }; Body: Record<string, unknown> }>(
    '/devices/:deviceId/ptz',
    {
      preHandler: [requireRole(...ALLOWED_ROLES)],
      schema: { tags: ['Remote Access'], summary: 'Control PTZ on a remote camera' },
    },
    async (request, reply) => {
      const { deviceId } = request.params;
      const body = (request.body ?? {}) as Record<string, unknown>;
      const action = body.action as string;
      const speed = (body.speed as number) ?? 50;
      const channel = (body.channel as number) ?? 1;
      const port = body.port as number | undefined;

      if (!action) {
        return reply.code(400).send({ success: false, error: 'action is required' });
      }

      const target = await remoteAccess.resolveTarget(request.tenantId, deviceId, port);
      const brand = target.brand.toLowerCase();

      let reqPath: string;
      let method: string;
      let reqBody: string | undefined;

      if (brand === 'hikvision') {
        reqPath = `/ISAPI/PTZCtrl/channels/${channel}/continuous`;
        method = 'PUT';

        let pan = 0, tilt = 0, zoom = 0;
        if (action === 'left') pan = -speed;
        if (action === 'right') pan = speed;
        if (action === 'up') tilt = speed;
        if (action === 'down') tilt = -speed;
        if (action === 'zoom_in') zoom = speed;
        if (action === 'zoom_out') zoom = -speed;

        reqBody = `<PTZData><pan>${pan}</pan><tilt>${tilt}</tilt><zoom>${zoom}</zoom></PTZData>`;
      } else if (brand === 'dahua') {
        const dahuaMapping: Record<string, string> = {
          up: 'Up', down: 'Down', left: 'Left', right: 'Right',
          zoom_in: 'ZoomWide', zoom_out: 'ZoomTele', stop: 'stop',
        };
        const cmd = dahuaMapping[action] ?? 'stop';
        reqPath = `/cgi-bin/ptz.cgi?action=${action === 'stop' ? 'stop' : 'start'}&channel=${channel}&code=${cmd}&arg1=0&arg2=${speed}&arg3=0`;
        method = 'GET';
      } else {
        return reply.code(400).send({
          success: false,
          error: `PTZ not supported for brand: ${target.brand}`,
        });
      }

      try {
        const response = await remoteAccess.proxyHttpRequest(target, {
          method,
          path: reqPath,
          headers: reqBody ? { 'Content-Type': 'application/xml' } : {},
          body: reqBody,
          timeout: 5000,
        });

        return reply.send({
          success: response.statusCode >= 200 && response.statusCode < 300,
          data: { deviceId, deviceName: target.name, action, channel, speed, statusCode: response.statusCode },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'PTZ failed';
        return reply.code(502).send({ success: false, error: msg });
      }
    },
  );

  // ── POST /devices/:deviceId/reboot — Remote device reboot ─────────────

  app.post<{ Params: { deviceId: string }; Body: Record<string, unknown> }>(
    '/devices/:deviceId/reboot',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Remote Access'], summary: 'Reboot a remote device' },
    },
    async (request, reply) => {
      const { deviceId } = request.params;
      const body = (request.body ?? {}) as Record<string, unknown>;
      const port = body.port as number | undefined;

      const target = await remoteAccess.resolveTarget(request.tenantId, deviceId, port);
      const brand = target.brand.toLowerCase();

      let reqPath: string;
      let method: string;

      if (brand === 'hikvision') {
        reqPath = '/ISAPI/System/reboot';
        method = 'PUT';
      } else if (brand === 'dahua') {
        reqPath = '/cgi-bin/magicBox.cgi?action=reboot';
        method = 'GET';
      } else if (brand === 'axis') {
        reqPath = '/axis-cgi/restart.cgi';
        method = 'GET';
      } else {
        return reply.code(400).send({
          success: false,
          error: `Reboot not supported for brand: ${target.brand}`,
        });
      }

      try {
        const response = await remoteAccess.proxyHttpRequest(target, {
          method,
          path: reqPath,
          headers: {},
          timeout: 10000,
        });

        return reply.send({
          success: true,
          data: {
            deviceId,
            deviceName: target.name,
            siteName: target.siteName,
            rebooting: response.statusCode >= 200 && response.statusCode < 300,
            statusCode: response.statusCode,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Reboot failed';
        return reply.code(502).send({ success: false, error: msg });
      }
    },
  );

  // ── GET /sessions — Active proxy sessions ──────────────────────────────

  app.get(
    '/sessions',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Remote Access'], summary: 'List proxy sessions' },
    },
    async (_request, reply) => {
      const active = remoteAccess.getActiveSessions();
      const recent = remoteAccess.getAllSessions(50);
      return reply.send({ success: true, data: { activeSessions: active.length, sessions: recent } });
    },
  );

  // ── DELETE /sessions — Clear closed sessions ───────────────────────────

  app.delete(
    '/sessions',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Remote Access'], summary: 'Clear closed proxy sessions' },
    },
    async (_request, reply) => {
      const cleared = remoteAccess.clearClosedSessions();
      return reply.send({ success: true, data: { cleared } });
    },
  );
}
