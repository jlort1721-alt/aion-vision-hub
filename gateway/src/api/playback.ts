import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const searchSchema = z.object({
  deviceId: z.string().min(1),
  channel: z.number().int().min(1).default(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

const playbackSchema = z.object({
  deviceId: z.string().min(1),
  channel: z.number().int().min(1).default(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

const stopSchema = z.object({
  deviceId: z.string().min(1),
  channel: z.number().int().min(1).default(1),
});

export function registerPlaybackRoutes(app: FastifyInstance) {
  const playbackManager = (app as any).playbackManager;

  // Search recordings
  app.post('/api/playback/search', async (request, reply) => {
    const parsed = searchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.issues });
    }

    const result = await playbackManager.searchRecordings(
      parsed.data.deviceId,
      parsed.data.channel,
      parsed.data.startTime,
      parsed.data.endTime,
    );
    return result;
  });

  // Start playback
  app.post('/api/playback/start', async (request, reply) => {
    const parsed = playbackSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.issues });
    }

    const result = await playbackManager.startPlayback(
      parsed.data.deviceId,
      parsed.data.channel,
      parsed.data.startTime,
      parsed.data.endTime,
    );
    if (!result) {
      return reply.code(502).send({ error: 'Failed to start playback' });
    }
    return result;
  });

  // Stop playback
  app.post('/api/playback/stop', async (request, reply) => {
    const parsed = stopSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.issues });
    }

    await playbackManager.stopPlayback(parsed.data.deviceId, parsed.data.channel);
    return { success: true };
  });

  // List active playback sessions
  app.get('/api/playback/sessions', async () => {
    return { sessions: playbackManager.listSessions() };
  });
}
