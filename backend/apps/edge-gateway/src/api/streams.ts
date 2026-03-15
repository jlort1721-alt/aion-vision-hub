import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DeviceManager } from '../services/device-manager.js';
import type { StreamManager } from '../services/stream-manager.js';

const registerSchema = z.object({
  deviceId: z.string().min(1),
});

const urlSchema = z.object({
  type: z.enum(['main', 'sub']).default('sub'),
  protocol: z.enum(['rtsp', 'webrtc', 'hls']).default('webrtc'),
});

export async function registerStreamRoutes(
  app: FastifyInstance,
  deviceManager: DeviceManager,
  streamManager: StreamManager,
) {
  app.get('/streams/:deviceId', async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const adapter = deviceManager.getAdapter(deviceId);
    if (!adapter) {
      reply.code(404).send({ success: false, error: { code: 'DEVICE_NOT_FOUND', message: 'Device not connected' } });
      return;
    }
    const streams = await adapter.getStreams(deviceId);
    return { success: true, data: streams };
  });

  app.post('/streams/register', async (request) => {
    const { deviceId } = registerSchema.parse(request.body);
    const adapter = deviceManager.getAdapter(deviceId);
    if (!adapter) {
      return { success: false, error: { code: 'DEVICE_NOT_FOUND', message: 'Device not connected' } };
    }

    const profiles = await adapter.getStreams(deviceId);
    const registration = await streamManager.registerStreams(deviceId, profiles);
    return { success: true, data: registration };
  });

  app.get('/streams/:deviceId/url', async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const query = urlSchema.parse(request.query);

    const signed = streamManager.generateSignedUrl(deviceId, query.type, query.protocol);
    if (!signed) {
      reply.code(404).send({ success: false, error: { code: 'STREAM_NOT_FOUND', message: 'Stream not registered' } });
      return;
    }
    return { success: true, data: signed };
  });

  app.get('/streams/:deviceId/state', async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string };
    const reg = streamManager.getRegistration(deviceId);
    if (!reg) {
      reply.code(404).send({ success: false, error: { code: 'STREAM_NOT_FOUND', message: 'No registration found' } });
      return;
    }
    return { success: true, data: { state: reg.state, lastStateChange: reg.lastStateChange } };
  });
}
