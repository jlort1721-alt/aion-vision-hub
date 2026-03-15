import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ipSchema, portSchema } from '@aion/common-utils';
import type { DeviceManager } from '../services/device-manager.js';
import { withTimeout, timeouts } from '../policies/timeout.js';

const connectSchema = z.object({
  ip: ipSchema,
  port: portSchema,
  username: z.string().min(1),
  password: z.string().min(1),
  brand: z.string().min(1),
  protocol: z.string().optional(),
  channels: z.number().int().min(1).optional(),
});

export async function registerDeviceRoutes(app: FastifyInstance, deviceManager: DeviceManager) {
  app.post('/devices/connect', async (request) => {
    const body = connectSchema.parse(request.body);
    const result = await withTimeout(
      deviceManager.connect(body),
      timeouts.connectMs,
      'device.connect',
    );
    return { success: result.success, data: result };
  });

  app.post('/devices/test', async (request) => {
    const body = connectSchema.parse(request.body);
    const result = await withTimeout(
      deviceManager.testConnection(body),
      timeouts.connectMs,
      'device.test',
    );
    return { success: result.success, data: result };
  });

  app.get('/devices', async () => {
    const devices = deviceManager.listDevices();
    return {
      success: true,
      data: devices.map((d) => ({
        deviceId: d.deviceId,
        brand: d.brand,
        ip: d.config.ip,
        port: d.config.port,
        connectedAt: d.connectedAt.toISOString(),
        capabilities: d.capabilities,
      })),
    };
  });

  app.get('/devices/:id/capabilities', async (request, reply) => {
    const { id } = request.params as { id: string };
    const adapter = deviceManager.getAdapter(id);
    if (!adapter) {
      reply.code(404).send({ success: false, error: { code: 'DEVICE_NOT_FOUND', message: 'Device not connected' } });
      return;
    }
    const capabilities = await adapter.getCapabilities(id);
    return { success: true, data: capabilities };
  });

  app.delete('/devices/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!deviceManager.isConnected(id)) {
      reply.code(404).send({ success: false, error: { code: 'DEVICE_NOT_FOUND', message: 'Device not connected' } });
      return;
    }
    await deviceManager.disconnect(id);
    return { success: true };
  });
}
