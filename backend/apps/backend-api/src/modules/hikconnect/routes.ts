import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { hikConnect } from '../../services/hikconnect-cloud.js';
import { hikvisionISAPI } from '../../services/hikvision-isapi.js';

export async function registerHikConnectRoutes(app: FastifyInstance) {
  // ── ISAPI Direct Device Control ──────────────────────────────

  // Test all Hikvision devices
  app.get('/isapi/test-all', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (req, reply) => {
    const data = await hikvisionISAPI.testAllDevices(req.tenantId);
    return reply.send({ success: true, data });
  });

  // Get device info via ISAPI
  app.get('/isapi/:deviceId/info', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (req, reply) => {
    const { deviceId } = req.params as { deviceId: string };
    const data = await hikvisionISAPI.getDeviceInfo(deviceId, req.tenantId);
    return reply.send({ success: true, data });
  });

  // Get channels for a device
  app.get('/isapi/:deviceId/channels', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (req, reply) => {
    const { deviceId } = req.params as { deviceId: string };
    const data = await hikvisionISAPI.getChannels(deviceId, req.tenantId);
    return reply.send({ success: true, data });
  });

  // Get snapshot from a channel
  app.get('/isapi/:deviceId/snapshot/:channel', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (req, reply) => {
    const { deviceId, channel } = req.params as { deviceId: string; channel: string };
    const buffer = await hikvisionISAPI.getSnapshot(deviceId, req.tenantId, parseInt(channel));
    if (!buffer) return reply.code(502).send({ success: false, error: 'Snapshot unavailable' });
    return reply.type('image/jpeg').send(buffer);
  });

  // PTZ control
  app.post('/isapi/:deviceId/ptz', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (req, reply) => {
    const { deviceId } = req.params as { deviceId: string };
    const { channel, direction, speed, preset, action } = req.body as {
      channel?: number; direction?: string; speed?: number; preset?: number; action?: string;
    };
    const ch = channel || 1;

    if (action === 'stop') {
      const ok = await hikvisionISAPI.ptzStop(deviceId, req.tenantId, ch);
      return reply.send({ success: ok });
    }
    if (preset !== undefined) {
      const ok = await hikvisionISAPI.ptzPreset(deviceId, req.tenantId, ch, preset);
      return reply.send({ success: ok });
    }
    if (direction) {
      const ok = await hikvisionISAPI.ptzMove(deviceId, req.tenantId, ch, direction, speed);
      return reply.send({ success: ok });
    }
    return reply.code(400).send({ success: false, error: 'Provide direction, preset, or action=stop' });
  });

  // Open door
  app.post('/isapi/:deviceId/door', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (req, reply) => {
    const { deviceId } = req.params as { deviceId: string };
    const { doorId } = req.body as { doorId?: number };
    const ok = await hikvisionISAPI.openDoor(deviceId, req.tenantId, doorId || 1);
    if (ok) await req.audit('hikconnect.isapi.door_open', 'devices', deviceId, { doorId });
    return reply.send({ success: ok });
  });

  // HDD status
  app.get('/isapi/:deviceId/hdd', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (req, reply) => {
    const { deviceId } = req.params as { deviceId: string };
    const data = await hikvisionISAPI.getHDDStatus(deviceId, req.tenantId);
    return reply.send({ success: true, data });
  });

  // Reboot device
  app.post('/isapi/:deviceId/reboot', {
    preHandler: [requireRole('tenant_admin', 'super_admin')],
  }, async (req, reply) => {
    const { deviceId } = req.params as { deviceId: string };
    const ok = await hikvisionISAPI.reboot(deviceId, req.tenantId);
    if (ok) await req.audit('hikconnect.isapi.reboot', 'devices', deviceId);
    return reply.send({ success: ok });
  });

  // Get go2rtc stream URL
  app.get('/isapi/:deviceId/stream-url', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (req, reply) => {
    const { deviceId } = req.params as { deviceId: string };
    const { channel, substream } = req.query as { channel?: string; substream?: string };
    const url = await hikvisionISAPI.getStreamUrl(
      deviceId, req.tenantId,
      channel ? parseInt(channel) : 1,
      substream !== 'false'
    );
    return reply.send({ success: true, data: { url } });
  });
  app.get('/status', {
    preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
  }, async (_req, reply) => {
    return reply.send({
      success: true,
      data: {
        configured: hikConnect.isConfigured(),
        message: hikConnect.isConfigured()
          ? 'HikConnect configured'
          : 'Set HIKCONNECT_AK and HIKCONNECT_SK in .env (register at tpp.hikvision.com)',
      },
    });
  });

  app.get('/devices', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (_req, reply) => {
    const data = await hikConnect.getDevices();
    return reply.send({ success: true, data });
  });

  app.get('/stream/:cameraCode', {
    preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
  }, async (req, reply) => {
    const url = await hikConnect.getPreviewURL((req.params as Record<string, string>).cameraCode);
    return reply.send({ success: true, data: { url } });
  });
}
