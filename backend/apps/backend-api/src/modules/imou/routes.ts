import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { imouCloud } from '../../services/imou-cloud.js';

export async function registerImouRoutes(app: FastifyInstance) {
  // Check if IMOU is configured
  app.get('/status', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        configured: imouCloud.isConfigured(),
        message: imouCloud.isConfigured()
          ? 'IMOU Cloud API configured'
          : 'IMOU Cloud not configured. Set IMOU_APP_ID and IMOU_APP_SECRET in .env',
      },
    });
  });

  // List IMOU devices
  app.get('/devices', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (_request, reply) => {
    if (!imouCloud.isConfigured()) {
      return reply.send({ success: true, data: [], message: 'IMOU not configured' });
    }
    try {
      const devices = await imouCloud.listDevices();
      return reply.send({ success: true, data: devices });
    } catch (err) {
      return reply.send({ success: false, error: (err as Error).message });
    }
  });

  // Get live stream URL for a Dahua device
  app.get('/stream/:deviceId', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const { channel } = request.query as { channel?: string };
    if (!imouCloud.isConfigured()) {
      return reply.code(503).send({ success: false, error: 'IMOU not configured' });
    }
    try {
      const url = await imouCloud.getLiveStreamUrl(deviceId, parseInt(channel || '0'));
      return reply.send({ success: true, data: { url } });
    } catch (err) {
      return reply.send({ success: false, error: (err as Error).message });
    }
  });
}
