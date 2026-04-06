/**
 * ISAPI Alert Listener Worker — Standalone process for PM2
 *
 * Run via:
 *   pm2 start dist/workers/isapi-listener-worker.js --name isapi-alerts
 *
 * Or during development:
 *   npx tsx src/workers/isapi-listener-worker.ts
 *
 * Reads DATABASE_URL from environment (via .env / PM2 ecosystem config).
 */
import 'dotenv/config';
import { startISAPIListener, stopISAPIListener } from '../services/isapi-alert-listener.js';

const logger = {
  info: (...args: unknown[]) => console.log(`[isapi-worker]`, ...args),
  warn: (...args: unknown[]) => console.warn(`[isapi-worker]`, ...args),
  error: (...args: unknown[]) => console.error(`[isapi-worker]`, ...args),
  fatal: (...args: unknown[]) => console.error(`[isapi-worker] FATAL:`, ...args),
};

// ---------------------------------------------------------------------------
// Validate environment
// ---------------------------------------------------------------------------

if (!process.env.DATABASE_URL) {
  logger.fatal('DATABASE_URL is required — set it in .env or PM2 ecosystem config');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutdown signal received');
  stopISAPIListener();
  // Give connections a moment to close cleanly
  setTimeout(() => process.exit(0), 1_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught exception');
  stopISAPIListener();
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason: String(reason) }, 'Unhandled rejection');
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  logger.info('ISAPI alert listener worker starting');

  try {
    const listener = await startISAPIListener();
    const status = listener.getStatus();
    logger.info(
      { connections: status.connections.length },
      'ISAPI alert listener worker running',
    );
  } catch (err) {
    logger.fatal({ err: (err as Error).message }, 'Failed to start ISAPI listener');
    process.exit(1);
  }
}

main();
