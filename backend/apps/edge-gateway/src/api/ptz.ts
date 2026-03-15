import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DeviceManager } from '../services/device-manager.js';
import { withTimeout, timeouts } from '../policies/timeout.js';

const commandSchema = z.object({
  action: z.enum(['left', 'right', 'up', 'down', 'zoomin', 'zoomout', 'stop', 'goto_preset']),
  speed: z.coerce.number().min(0).max(100).optional(),
  presetId: z.coerce.number().int().min(1).optional(),
  duration: z.coerce.number().int().min(100).max(30000).optional(),
});

const presetSchema = z.object({
  id: z.coerce.number().int().min(1),
  name: z.string().min(1).max(64),
});

export async function registerPTZRoutes(app: FastifyInstance, deviceManager: DeviceManager) {
  app.post('/ptz/:deviceId/command', async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const body = commandSchema.parse(request.body);
    const adapter = deviceManager.getAdapter(deviceId);
    if (!adapter) {
      reply.code(404).send({ success: false, error: { code: 'DEVICE_NOT_FOUND', message: 'Device not connected' } });
      return;
    }

    await withTimeout(adapter.sendCommand(deviceId, body), timeouts.ptzMs, 'ptz.command');

    // Auto-stop after duration
    if (body.duration && body.action !== 'stop') {
      setTimeout(async () => {
        try {
          await adapter.sendCommand(deviceId, { action: 'stop' });
        } catch { /* best effort */ }
      }, body.duration);
    }

    return { success: true };
  });

  app.get('/ptz/:deviceId/presets', async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const adapter = deviceManager.getAdapter(deviceId);
    if (!adapter) {
      reply.code(404).send({ success: false, error: { code: 'DEVICE_NOT_FOUND', message: 'Device not connected' } });
      return;
    }
    const presets = await adapter.getPresets(deviceId);
    return { success: true, data: presets };
  });

  app.post('/ptz/:deviceId/presets', async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const body = presetSchema.parse(request.body);
    const adapter = deviceManager.getAdapter(deviceId);
    if (!adapter) {
      reply.code(404).send({ success: false, error: { code: 'DEVICE_NOT_FOUND', message: 'Device not connected' } });
      return;
    }
    await adapter.setPreset(deviceId, body);
    return { success: true };
  });
}
