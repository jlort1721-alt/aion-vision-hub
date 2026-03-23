/**
 * Cloud Platform Integration Routes
 *
 * Allows operators to connect their Hik-Connect (EZVIZ) and DMSS (IMOU)
 * accounts to automatically import and manage cloud-connected devices.
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import {
  getEzvizInstance,
  getImouInstance,
  normalizeEzvizDevices,
  normalizeImouDevices,
} from '../../services/cloud-platforms.js';
import { db } from '../../db/client.js';
import { devices, sites } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

export async function registerCloudPlatformRoutes(app: FastifyInstance) {

  // ═══════════════════════════════════════════════════════════
  // EZVIZ / HIK-CONNECT
  // ═══════════════════════════════════════════════════════════

  // ── POST /ezviz/login — Authenticate with EZVIZ/Hik-Connect ──
  app.post<{ Body: { appKey: string; appSecret: string } }>(
    '/ezviz/login',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Cloud Platforms'],
        summary: 'Authenticate with Hik-Connect / EZVIZ platform',
        description: 'Requires appKey and appSecret from https://open.ezviz.com developer account',
      },
    },
    async (request, reply) => {
      const { appKey, appSecret } = request.body;
      if (!appKey || !appSecret) {
        return reply.code(400).send({ success: false, error: 'appKey y appSecret son obligatorios' });
      }

      const ezviz = getEzvizInstance(request.tenantId);
      const result = await ezviz.authenticate(appKey, appSecret);

      if (!result.success) {
        return reply.code(401).send({ success: false, error: result.error });
      }

      await request.audit('cloud.ezviz.login', 'cloud_accounts', 'ezviz', { appKey: appKey.substring(0, 8) + '...' });

      return reply.send({
        success: true,
        data: { platform: 'ezviz', authenticated: true, message: 'Conectado a Hik-Connect / EZVIZ' },
      });
    },
  );

  // ── GET /ezviz/devices — List all EZVIZ devices ──
  app.get(
    '/ezviz/devices',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Cloud Platforms'],
        summary: 'List all devices from Hik-Connect / EZVIZ account',
      },
    },
    async (request, reply) => {
      const ezviz = getEzvizInstance(request.tenantId);
      if (!ezviz.isAuthenticated()) {
        return reply.code(401).send({ success: false, error: 'No autenticado en EZVIZ. Inicie sesión primero.' });
      }

      const { devices: rawDevices, error } = await ezviz.listDevices();
      if (error) {
        return reply.code(502).send({ success: false, error });
      }

      // Enrich with camera lists for NVRs
      const normalized = normalizeEzvizDevices(rawDevices);
      for (const device of normalized) {
        const { cameras } = await ezviz.listCameras(device.serialOrId);
        if (cameras.length > 0) {
          device.channels = cameras.length;
          device.channelList = cameras.map(c => ({
            id: c.channelNo,
            name: c.channelName || `Canal ${c.channelNo}`,
            status: c.status === 1 ? 'online' : 'offline',
          }));
        }
      }

      return reply.send({
        success: true,
        data: {
          platform: 'ezviz',
          total: normalized.length,
          online: normalized.filter(d => d.status === 'online').length,
          devices: normalized,
        },
      });
    },
  );

  // ── POST /ezviz/devices/:serial/stream — Get live stream URL ──
  app.post<{ Params: { serial: string }; Querystring: { channel?: string; quality?: string } }>(
    '/ezviz/devices/:serial/stream',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Cloud Platforms'],
        summary: 'Get HLS live stream URL from EZVIZ cloud',
      },
    },
    async (request, reply) => {
      const ezviz = getEzvizInstance(request.tenantId);
      if (!ezviz.isAuthenticated()) {
        return reply.code(401).send({ success: false, error: 'No autenticado en EZVIZ' });
      }

      const { serial } = request.params;
      const channel = parseInt(request.query.channel || '1', 10);
      const quality = parseInt(request.query.quality || '1', 10);

      const { url, error } = await ezviz.getLiveStreamUrl(serial, channel, quality);
      if (!url) {
        return reply.code(502).send({ success: false, error: error || 'No se pudo obtener URL de stream' });
      }

      return reply.send({
        success: true,
        data: { serial, channel, quality, hlsUrl: url, protocol: 'hls' },
      });
    },
  );

  // ── POST /ezviz/devices/:serial/snapshot — Capture snapshot ──
  app.post<{ Params: { serial: string }; Querystring: { channel?: string } }>(
    '/ezviz/devices/:serial/snapshot',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Cloud Platforms'], summary: 'Capture snapshot from EZVIZ device' },
    },
    async (request, reply) => {
      const ezviz = getEzvizInstance(request.tenantId);
      if (!ezviz.isAuthenticated()) {
        return reply.code(401).send({ success: false, error: 'No autenticado en EZVIZ' });
      }

      const channel = parseInt(request.query.channel || '1', 10);
      const { url, error } = await ezviz.captureSnapshot(request.params.serial, channel);

      return reply.send({ success: !!url, data: url ? { imageUrl: url } : null, error });
    },
  );

  // ── POST /ezviz/devices/:serial/ptz — PTZ control ──
  app.post<{ Params: { serial: string }; Body: { channel: number; direction: number; speed?: number; action: 'start' | 'stop' } }>(
    '/ezviz/devices/:serial/ptz',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Cloud Platforms'], summary: 'PTZ control on EZVIZ device' },
    },
    async (request, reply) => {
      const ezviz = getEzvizInstance(request.tenantId);
      if (!ezviz.isAuthenticated()) {
        return reply.code(401).send({ success: false, error: 'No autenticado en EZVIZ' });
      }

      const { channel, direction, speed, action } = request.body;
      if (action === 'stop') {
        await ezviz.ptzStop(request.params.serial, channel, direction);
        return reply.send({ success: true });
      }

      const result = await ezviz.ptzControl(request.params.serial, channel, direction, speed || 1);
      return reply.send(result);
    },
  );

  // ── POST /ezviz/import — Import EZVIZ devices into platform DB ──
  app.post<{ Body: { siteId: string; deviceSerials?: string[] } }>(
    '/ezviz/import',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: {
        tags: ['Cloud Platforms'],
        summary: 'Import EZVIZ devices into Clave Seguridad device inventory',
      },
    },
    async (request, reply) => {
      const ezviz = getEzvizInstance(request.tenantId);
      if (!ezviz.isAuthenticated()) {
        return reply.code(401).send({ success: false, error: 'No autenticado en EZVIZ' });
      }

      const { siteId, deviceSerials } = request.body;

      // Verify site exists
      const [site] = await db.select().from(sites).where(and(eq(sites.id, siteId), eq(sites.tenantId, request.tenantId))).limit(1);
      if (!site) {
        return reply.code(404).send({ success: false, error: 'Sitio no encontrado' });
      }

      const { devices: cloudDevices } = await ezviz.listDevices();
      const normalized = normalizeEzvizDevices(cloudDevices);

      // Filter if specific serials requested
      const toImport = deviceSerials?.length
        ? normalized.filter(d => deviceSerials.includes(d.serialOrId))
        : normalized;

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const cd of toImport) {
        // Check if already exists
        const existing = await db.select({ id: devices.id }).from(devices)
          .where(and(eq(devices.serialNumber, cd.serialOrId), eq(devices.tenantId, request.tenantId)))
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        try {
          // Get cameras for this device
          const { cameras } = await ezviz.listCameras(cd.serialOrId);

          await db.insert(devices).values({
            tenantId: request.tenantId,
            siteId,
            name: cd.name,
            type: cd.type,
            brand: 'hikvision',
            model: cd.model,
            serialNumber: cd.serialOrId,
            status: cd.status,
            channels: cameras.length || 1,
            connectionType: 'cloud',
            capabilities: {
              video: cd.capabilities.video,
              ptz: cd.capabilities.ptz,
              audio: cd.capabilities.talk,
              cloud: true,
              platform: 'ezviz',
            },
            tags: ['ezviz', 'cloud', 'hik-connect'],
            notes: `Importado desde Hik-Connect. Serial: ${cd.serialOrId}`,
          });
          imported++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          errors.push(`${cd.serialOrId}: ${msg}`);
        }
      }

      await request.audit('cloud.ezviz.import', 'devices', siteId, { imported, skipped, errors: errors.length });

      return reply.send({
        success: true,
        data: { imported, skipped, errors, total: toImport.length },
      });
    },
  );

  // ═══════════════════════════════════════════════════════════
  // IMOU / DMSS / DAHUA
  // ═══════════════════════════════════════════════════════════

  // ── POST /imou/login — Authenticate with IMOU/DMSS ──
  app.post<{ Body: { appId: string; appSecret: string } }>(
    '/imou/login',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Cloud Platforms'],
        summary: 'Authenticate with DMSS / IMOU platform',
        description: 'Requires appId and appSecret from https://open.imoulife.com developer account',
      },
    },
    async (request, reply) => {
      const { appId, appSecret } = request.body;
      if (!appId || !appSecret) {
        return reply.code(400).send({ success: false, error: 'appId y appSecret son obligatorios' });
      }

      const imou = getImouInstance(request.tenantId);
      const result = await imou.authenticate(appId, appSecret);

      if (!result.success) {
        return reply.code(401).send({ success: false, error: result.error });
      }

      await request.audit('cloud.imou.login', 'cloud_accounts', 'imou', { appId: appId.substring(0, 8) + '...' });

      return reply.send({
        success: true,
        data: { platform: 'imou', authenticated: true, message: 'Conectado a DMSS / IMOU' },
      });
    },
  );

  // ── GET /imou/devices — List all IMOU devices ──
  app.get(
    '/imou/devices',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Cloud Platforms'], summary: 'List all devices from DMSS / IMOU account' },
    },
    async (request, reply) => {
      const imou = getImouInstance(request.tenantId);
      if (!imou.isAuthenticated()) {
        return reply.code(401).send({ success: false, error: 'No autenticado en IMOU. Inicie sesión primero.' });
      }

      const { devices: rawDevices, error } = await imou.listDevices();
      if (error) {
        return reply.code(502).send({ success: false, error });
      }

      const normalized = normalizeImouDevices(rawDevices);

      return reply.send({
        success: true,
        data: {
          platform: 'imou',
          total: normalized.length,
          online: normalized.filter(d => d.status === 'online').length,
          devices: normalized,
        },
      });
    },
  );

  // ── POST /imou/devices/:deviceId/stream — Get live stream URL ──
  app.post<{ Params: { deviceId: string }; Querystring: { channel?: string } }>(
    '/imou/devices/:deviceId/stream',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Cloud Platforms'], summary: 'Get live stream URL from IMOU cloud' },
    },
    async (request, reply) => {
      const imou = getImouInstance(request.tenantId);
      if (!imou.isAuthenticated()) {
        return reply.code(401).send({ success: false, error: 'No autenticado en IMOU' });
      }

      const channel = request.query.channel || '0';
      const { url, error } = await imou.getLiveStreamUrl(request.params.deviceId, channel);

      if (!url) {
        return reply.code(502).send({ success: false, error: error || 'No se pudo obtener URL' });
      }

      return reply.send({
        success: true,
        data: { deviceId: request.params.deviceId, channel, hlsUrl: url, protocol: 'hls' },
      });
    },
  );

  // ── POST /imou/import — Import IMOU devices into platform DB ──
  app.post<{ Body: { siteId: string; deviceIds?: string[] } }>(
    '/imou/import',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Cloud Platforms'], summary: 'Import IMOU devices into Clave Seguridad' },
    },
    async (request, reply) => {
      const imou = getImouInstance(request.tenantId);
      if (!imou.isAuthenticated()) {
        return reply.code(401).send({ success: false, error: 'No autenticado en IMOU' });
      }

      const { siteId, deviceIds } = request.body;

      const [site] = await db.select().from(sites).where(and(eq(sites.id, siteId), eq(sites.tenantId, request.tenantId))).limit(1);
      if (!site) {
        return reply.code(404).send({ success: false, error: 'Sitio no encontrado' });
      }

      const { devices: cloudDevices } = await imou.listDevices();
      const normalized = normalizeImouDevices(cloudDevices);
      const toImport = deviceIds?.length
        ? normalized.filter(d => deviceIds.includes(d.serialOrId))
        : normalized;

      let imported = 0;
      let skipped = 0;

      for (const cd of toImport) {
        const existing = await db.select({ id: devices.id }).from(devices)
          .where(and(eq(devices.serialNumber, cd.serialOrId), eq(devices.tenantId, request.tenantId)))
          .limit(1);

        if (existing.length > 0) { skipped++; continue; }

        await db.insert(devices).values({
          tenantId: request.tenantId,
          siteId,
          name: cd.name,
          type: cd.type,
          brand: 'dahua',
          model: cd.model,
          serialNumber: cd.serialOrId,
          status: cd.status,
          channels: cd.channels,
          connectionType: 'cloud',
          capabilities: { video: true, cloud: true, platform: 'imou' },
          tags: ['imou', 'cloud', 'dmss'],
          notes: `Importado desde DMSS/IMOU. ID: ${cd.serialOrId}`,
        });
        imported++;
      }

      await request.audit('cloud.imou.import', 'devices', siteId, { imported, skipped });

      return reply.send({ success: true, data: { imported, skipped, total: toImport.length } });
    },
  );

  // ═══════════════════════════════════════════════════════════
  // UNIFIED STATUS
  // ═══════════════════════════════════════════════════════════

  app.get(
    '/status',
    {
      schema: { tags: ['Cloud Platforms'], summary: 'Get connection status for all cloud platforms' },
    },
    async (request, reply) => {
      const ezviz = getEzvizInstance(request.tenantId);
      const imou = getImouInstance(request.tenantId);

      return reply.send({
        success: true,
        data: {
          ezviz: { connected: ezviz.isAuthenticated(), platform: 'Hik-Connect / EZVIZ' },
          imou: { connected: imou.isAuthenticated(), platform: 'DMSS / IMOU' },
        },
      });
    },
  );
}
