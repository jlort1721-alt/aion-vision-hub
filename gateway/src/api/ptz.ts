import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const ptzCommandSchema = z.object({
  deviceId: z.string().min(1),
  action: z.enum([
    'left', 'right', 'up', 'down',
    'zoomin', 'zoomout', 'stop',
    'goto_preset', 'set_preset',
    'iris_open', 'iris_close',
    'focus_near', 'focus_far', 'auto_focus',
  ]),
  speed: z.number().min(0).max(100).optional(),
  presetId: z.number().int().min(1).optional(),
  channel: z.number().int().min(1).default(1),
});

const presetSchema = z.object({
  deviceId: z.string().min(1),
  presetId: z.number().int().min(1),
  name: z.string().min(1).max(64),
});

export function registerPTZRoutes(app: FastifyInstance) {
  const deviceManager = (app as any).deviceManager;

  // Send PTZ command
  app.post('/api/ptz/command', async (request, reply) => {
    const parsed = ptzCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.issues });
    }

    try {
      await deviceManager.sendPTZCommand(parsed.data.deviceId, {
        action: parsed.data.action,
        speed: parsed.data.speed,
        presetId: parsed.data.presetId,
        channel: parsed.data.channel,
      });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PTZ command failed';
      return reply.code(502).send({ error: message });
    }
  });

  // Get PTZ presets
  app.get('/api/ptz/:deviceId/presets', async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const device = deviceManager.getDevice(deviceId);
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    const presets = await deviceManager.getPTZPresets(deviceId);
    return { presets };
  });

  // Set PTZ preset
  app.post('/api/ptz/preset', async (request, reply) => {
    const parsed = presetSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.issues });
    }

    try {
      await deviceManager.setPTZPreset(parsed.data.deviceId, {
        id: parsed.data.presetId,
        name: parsed.data.name,
      });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Set preset failed';
      return reply.code(502).send({ error: message });
    }
  });
}
