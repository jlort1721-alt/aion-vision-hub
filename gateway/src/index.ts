import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { registerDeviceRoutes } from './api/devices.js';
import { registerStreamRoutes } from './api/streams.js';
import { registerDiscoveryRoutes } from './api/discovery.js';
import { registerHealthRoutes } from './api/health.js';
import { registerPTZRoutes } from './api/ptz.js';
import { registerPlaybackRoutes } from './api/playback.js';
import { DeviceManager } from './services/device-manager.js';
import { StreamManager } from './services/stream-manager.js';
import { DiscoveryService } from './services/discovery.js';
import { ReconnectManager } from './services/reconnect-manager.js';
import { EventIngestionService } from './services/event-ingestion.js';
import { EventListenerService } from './services/event-listener.js';
import { PlaybackManager } from './services/playback-manager.js';
import { rateLimitHook } from './middleware/rate-limit.js';

const app = Fastify({ logger: logger });

async function bootstrap() {
  // ── Plugins ──
  await app.register(cors, {
    origin: config.CORS_ORIGINS.split(','),
    credentials: true,
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
  });

  await app.register(websocket);

  // ── Services (singleton instances) ──
  const deviceManager = new DeviceManager();
  const streamManager = new StreamManager(deviceManager);
  const discoveryService = new DiscoveryService();
  const reconnectManager = new ReconnectManager(deviceManager, {
    maxAttempts: config.RECONNECT_MAX_ATTEMPTS,
    baseDelayMs: config.RECONNECT_BASE_DELAY_MS,
    maxDelayMs: config.RECONNECT_MAX_DELAY_MS,
  });
  const eventIngestion = new EventIngestionService();
  const eventListener = new EventListenerService(deviceManager, eventIngestion);
  const playbackManager = new PlaybackManager(deviceManager);

  // ── Startup checks ──
  logger.info('Running startup checks...');

  // MediaMTX health check (non-blocking — gateway starts without it)
  const mediamtxOk = await streamManager.checkMediaMTXHealth();
  if (mediamtxOk) {
    logger.info({ url: config.MEDIAMTX_API_URL }, 'MediaMTX is reachable');
  } else {
    logger.warn({ url: config.MEDIAMTX_API_URL }, 'MediaMTX is NOT reachable — streaming will fail until it comes up');
  }

  // ── Start background services ──
  reconnectManager.start(config.DEVICE_PING_INTERVAL_MS);
  eventIngestion.start();

  // Periodic MediaMTX + stream health check (every 30s)
  const mediamtxHealthInterval = setInterval(async () => {
    await streamManager.checkMediaMTXHealth();
    await streamManager.healthCheckStreams();
  }, 30000);

  // ── Decorate Fastify with shared services ──
  app.decorate('deviceManager', deviceManager);
  app.decorate('streamManager', streamManager);
  app.decorate('discoveryService', discoveryService);
  app.decorate('reconnectManager', reconnectManager);
  app.decorate('eventIngestion', eventIngestion);
  app.decorate('eventListener', eventListener);
  app.decorate('playbackManager', playbackManager);

  // ── Rate limiting ──
  app.addHook('onRequest', rateLimitHook);

  // ── Auth hook — all routes except /health require JWT ──
  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/health')) return;
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // ── Request timeout ──
  app.addHook('onRequest', async (_request, reply) => {
    reply.raw.setTimeout(config.DEVICE_REQUEST_TIMEOUT_MS * 2, () => {
      reply.code(408).send({ error: 'Request timeout' });
    });
  });

  // ── Routes ──
  registerHealthRoutes(app);
  registerDeviceRoutes(app);
  registerStreamRoutes(app);
  registerDiscoveryRoutes(app);
  registerPTZRoutes(app);
  registerPlaybackRoutes(app);

  // ── Start ──
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  logger.info(
    {
      port: config.PORT,
      env: config.NODE_ENV,
      mediamtx: mediamtxOk ? 'connected' : 'unreachable',
      logLevel: config.LOG_LEVEL,
    },
    'AION Gateway started',
  );

  // ── Graceful shutdown ──
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');

    clearInterval(mediamtxHealthInterval);
    eventListener.detachAll();
    reconnectManager.stop();
    eventIngestion.stop();
    await playbackManager.stopAll();
    await streamManager.stopAll();

    await app.close();
    logger.info('Shutdown complete');
    process.exit(0);
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => shutdown(signal));
  }
}

bootstrap().catch((err) => {
  logger.fatal(err, 'Failed to start AION Gateway');
  process.exit(1);
});
