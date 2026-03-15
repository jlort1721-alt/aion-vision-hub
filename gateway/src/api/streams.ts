import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const startStreamSchema = z.object({
  deviceId: z.string().min(1),
  streamType: z.enum(['main', 'sub']).default('sub'),
  channel: z.number().int().min(1).default(1),
});

export function registerStreamRoutes(app: FastifyInstance) {
  const streamManager = (app as any).streamManager;

  // List active streams
  app.get('/api/streams', async () => ({
    streams: streamManager.listActive(),
  }));

  // Start a stream (registers RTSP source in MediaMTX, returns WebRTC URL)
  app.post('/api/streams/start', async (request, reply) => {
    const parsed = startStreamSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.issues });
    }
    const { deviceId, streamType, channel } = parsed.data;
    const result = await streamManager.startStream(deviceId, streamType, channel);
    if (!result) {
      return reply.code(502).send({ error: 'Failed to start stream' });
    }
    return result;
  });

  // Stop a stream
  app.post('/api/streams/stop', async (request, reply) => {
    const parsed = startStreamSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.issues });
    }
    const { deviceId, streamType, channel } = parsed.data;
    await streamManager.stopStream(deviceId, streamType, channel);
    return { success: true };
  });

  // Stop all streams
  app.post('/api/streams/stop-all', async () => {
    await streamManager.stopAll();
    return { success: true };
  });
}
