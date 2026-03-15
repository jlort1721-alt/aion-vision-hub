import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const connectSchema = z.object({
  ip: z.string().ip(),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  password: z.string(),
  brand: z.enum(['hikvision', 'dahua', 'onvif']),
  protocol: z.string().optional(),
  tenantId: z.string().optional(),
});

const testSchema = z.object({
  ip: z.string().ip(),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  password: z.string(),
  brand: z.enum(['hikvision', 'dahua', 'onvif']),
});

export function registerDeviceRoutes(app: FastifyInstance) {
  const deviceManager = (app as any).deviceManager;
  const eventListener = (app as any).eventListener;

  // List connected devices
  app.get('/api/devices', async () => ({
    devices: deviceManager.listConnected(),
  }));

  // Connect to a device
  app.post('/api/devices/connect', async (request, reply) => {
    const parsed = connectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.issues });
    }

    const { tenantId, ...deviceConfig } = parsed.data;
    const result = await deviceManager.connect(deviceConfig, tenantId);

    if (result.success && result.sessionId && tenantId && eventListener) {
      // Auto-attach event listener for connected devices
      eventListener.attachDevice(result.sessionId, tenantId);
    }

    return result.success ? result : reply.code(502).send(result);
  });

  // Disconnect a device
  app.post('/api/devices/:id/disconnect', async (request) => {
    const { id } = request.params as { id: string };

    // Detach event listener first
    if (eventListener) {
      eventListener.detachDevice(id);
    }

    await deviceManager.disconnect(id);
    return { success: true };
  });

  // Test connection (does NOT persist)
  app.post('/api/devices/test', async (request, reply) => {
    const parsed = testSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.issues });
    }
    return deviceManager.testConnection(parsed.data);
  });

  // Get device health
  app.get('/api/devices/:id/health', async (request, reply) => {
    const { id } = request.params as { id: string };
    const device = deviceManager.getDevice(id);
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    return deviceManager.getHealth(id);
  });

  // Get streams for a device
  app.get('/api/devices/:id/streams', async (request, reply) => {
    const { id } = request.params as { id: string };
    const device = deviceManager.getDevice(id);
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    return { streams: await deviceManager.getStreams(id) };
  });

  // Get device capabilities (from connection cache)
  app.get('/api/devices/:id/capabilities', async (request, reply) => {
    const { id } = request.params as { id: string };
    const device = deviceManager.getDevice(id);
    if (!device) return reply.code(404).send({ error: 'Device not found' });
    // Capabilities are stored in the adapter connection — re-test to get them
    const result = await deviceManager.testConnection(device.config);
    return { capabilities: result.capabilities || null };
  });
}
