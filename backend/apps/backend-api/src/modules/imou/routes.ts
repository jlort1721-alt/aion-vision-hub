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

  // GET /imou/binding-guide -- Instructions for binding Dahua XVR devices
  app.get('/binding-guide', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (_request, reply) => {
    const serials = [
      { sede: 'Alborada', serial: 'AL02505PAJD40E7' },
      { sede: 'Brescia', serial: 'AK01E46PAZ0BA9C' },
      { sede: 'Patio Bonito', serial: 'AL02505PAJDC6A4' },
      { sede: 'Terrabamba', serial: 'BB01B89PAJ5DDCD' },
      { sede: 'Danubios (Clave)', serial: 'AJ00421PAZF2E60' },
      { sede: 'Danubios (Puesto)', serial: 'AH0306CPAZ5EA1A' },
      { sede: 'Terrazzino', serial: 'AL02505PAJ638AA' },
      { sede: 'Quintas SM', serial: 'AH1020EPAZ39E67' },
      { sede: 'Hospital SJ', serial: 'AE01C60PAZA4D94' },
      { sede: 'Factory', serial: '9B02D09PAZ4C0D2' },
      { sede: 'Santana', serial: 'AB081E4PAZD6D5B' },
    ];
    return reply.send({
      success: true,
      data: {
        instructions: [
          '1. Login to https://open.imoulife.com',
          '2. Go to Device Management -> Add Device',
          '3. Enter each serial number below with the verification code from your IMOU_BIND_PASSWORD env variable',
          '4. After binding, devices will appear in GET /imou/devices',
        ],
        devices: serials,
        configured: imouCloud.isConfigured(),
      },
    });
  });
}
