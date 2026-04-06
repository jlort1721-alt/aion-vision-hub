// Telemetry and error tracking must be initialized FIRST
import { initTelemetry, shutdownTelemetry } from './lib/telemetry.js';
import { initSentry } from './lib/sentry.js';
initTelemetry();
initSentry();

import { config } from './config/env.js';
import { buildApp } from './app.js';
import { db } from './db/client.js';
import { connectRedis, disconnectRedis } from './lib/redis.js';
import { startHealthCheckWorker, stopHealthCheckWorker } from './workers/health-check-worker.js';
import { startBackupWorker, stopBackupWorker } from './workers/backup-worker.js';
import { startReportsWorker, stopReportsWorker } from './workers/reports-worker.js';
import { startAutomationEngine, stopAutomationEngine } from './workers/automation-engine.js';
import { startRetentionWorker, stopRetentionWorker } from './workers/retention-worker.js';

// Connect Redis before starting the server (graceful fallback if not configured)
await connectRedis();

const app = await buildApp();

await app.listen({ port: config.PORT, host: config.HOST });
app.log.info(`AION Backend API listening on ${config.HOST}:${config.PORT}`);

// Start periodic workers (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  startHealthCheckWorker(db);
  startBackupWorker(db);
  startReportsWorker(db);
  startAutomationEngine(db);
  startRetentionWorker(db);
  app.log.info('Automation engine and Retention worker started');
}

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down...`);
    stopHealthCheckWorker();
    stopBackupWorker();
    stopReportsWorker();
    stopAutomationEngine();
    stopRetentionWorker();
    await shutdownTelemetry();
    await disconnectRedis();
    await app.close();
    process.exit(0);
  });
}
