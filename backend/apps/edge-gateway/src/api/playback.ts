import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PlaybackManager } from '../services/playback-manager.js';

const searchSchema = z.object({
  deviceId: z.string().min(1),
  channel: z.coerce.number().int().min(1).default(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  eventType: z.string().optional(),
});

const startSchema = z.object({
  deviceId: z.string().min(1),
  channel: z.coerce.number().int().min(1).default(1),
  startTime: z.string().datetime(),
  speed: z.coerce.number().min(0.25).max(16).optional(),
});

const exportSchema = z.object({
  deviceId: z.string().min(1),
  channel: z.coerce.number().int().min(1).default(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  format: z.enum(['mp4', 'avi', 'mkv']).default('mp4'),
});

export async function registerPlaybackRoutes(app: FastifyInstance, playbackManager: PlaybackManager) {
  app.post('/playback/search', async (request) => {
    const body = searchSchema.parse(request.body);
    const segments = await playbackManager.search({
      ...body,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
    });
    return { success: true, data: segments };
  });

  app.post('/playback/start', async (request) => {
    const body = startSchema.parse(request.body);
    const session = await playbackManager.startPlayback({
      ...body,
      startTime: new Date(body.startTime),
    });
    return { success: true, data: session };
  });

  app.delete('/playback/:sessionId', async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    await playbackManager.stopPlayback(sessionId);
    return { success: true };
  });

  app.post('/playback/export', async (request) => {
    const body = exportSchema.parse(request.body);
    const job = await playbackManager.exportClip({
      ...body,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
    });
    return { success: true, data: job };
  });
}
