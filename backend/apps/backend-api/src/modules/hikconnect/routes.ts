import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { hikConnect } from '../../services/hikconnect-cloud.js';

export async function registerHikConnectRoutes(app: FastifyInstance) {
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
