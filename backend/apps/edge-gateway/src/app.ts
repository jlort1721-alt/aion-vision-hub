import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { createLogger, createLoggerConfig } from '@aion/common-utils';
import { config } from './config/env.js';

// Services
import { DeviceManager } from './services/device-manager.js';
import { StreamManager } from './services/stream-manager.js';
import { DiscoveryService } from './services/discovery.js';
import { EventIngestionService } from './services/event-ingestion.js';
import { PlaybackManager } from './services/playback-manager.js';
import { HealthMonitor } from './services/health-monitor.js';
import { CredentialVault } from './services/credential-vault.js';

// API routes
import { registerHealthRoutes } from './api/health.js';
import { registerDeviceRoutes } from './api/devices.js';
import { registerStreamRoutes } from './api/streams.js';
import { registerDiscoveryRoutes } from './api/discovery.js';
import { registerPlaybackRoutes } from './api/playback.js';
import { registerPTZRoutes } from './api/ptz.js';
import { registerEventRoutes } from './api/events.js';

const loggerOpts = { name: 'aion-gateway', level: config.LOG_LEVEL };
const logger = createLogger(loggerOpts);

export async function buildGateway() {
  const app = Fastify({ logger: createLoggerConfig(loggerOpts), trustProxy: true });

  // Plugins
  await app.register(cors, {
    origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
    verify: { algorithms: ['HS256'] },
  });
  await app.register(websocket);

  // Initialize services
  const deviceManager = new DeviceManager(logger);
  const streamManager = new StreamManager(deviceManager, logger);
  const discoveryService = new DiscoveryService(deviceManager, logger);
  const eventService = new EventIngestionService(deviceManager, logger);
  const playbackManager = new PlaybackManager(deviceManager, logger);
  const healthMonitor = new HealthMonitor(deviceManager, streamManager, logger);
  const credentialVault = new CredentialVault(logger);

  // Decorate Fastify instance for access in hooks
  app.decorate('deviceManager', deviceManager);
  app.decorate('streamManager', streamManager);
  app.decorate('credentialVault', credentialVault);

  // Auth hook — all routes except /health require JWT
  app.addHook('onRequest', async (request, reply) => {
    const path = request.url.split('?')[0];
    if (path === '/health' || path.startsWith('/health/')) return;
    if (request.method === 'OPTIONS') return;
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ success: false, error: { code: 'AUTH_TOKEN_INVALID', message: 'Unauthorized' } });
    }
  });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    logger.error({ err: error, url: request.url }, 'Request error');
    reply.code(statusCode).send({
      success: false,
      error: {
        code: statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: config.NODE_ENV === 'production' ? 'Internal error' : (error instanceof Error ? error.message : 'Unknown error'),
      },
    });
  });

  // Register routes
  await registerHealthRoutes(app, deviceManager, healthMonitor, streamManager);
  await registerDeviceRoutes(app, deviceManager);
  await registerStreamRoutes(app, deviceManager, streamManager);
  await registerDiscoveryRoutes(app, discoveryService);
  await registerPlaybackRoutes(app, playbackManager);
  await registerPTZRoutes(app, deviceManager);
  await registerEventRoutes(app, deviceManager, eventService);

  // Lifecycle hooks
  app.addHook('onReady', async () => {
    healthMonitor.start();
    eventService.start();
    logger.info('Gateway services started');
  });

  app.addHook('onClose', async () => {
    healthMonitor.stop();
    eventService.stop();
    await deviceManager.disconnectAll();
    logger.info('Gateway services stopped');
  });

  return app;
}
