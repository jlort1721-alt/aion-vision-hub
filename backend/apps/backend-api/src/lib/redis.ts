/**
 * Redis client with graceful fallback.
 *
 * If REDIS_URL is configured, creates a real ioredis connection.
 * Otherwise, exports null — callers should check and fall back to in-memory.
 *
 * Usage:
 *   import { redis, redisPublisher, redisSubscriber } from '../lib/redis.js';
 *   if (redis) { await redis.set(key, value); }
 */

import { Redis } from 'ioredis';
import { createLogger } from '@aion/common-utils';
import { config } from '../config/env.js';

const logger = createLogger({ name: 'redis' });

function createRedisClient(purpose: string): Redis | null {
  if (!config.REDIS_URL) return null;

  const client = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 5) return null; // stop retrying
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  client.on('connect', () => logger.info({ purpose }, 'Connected'));
  client.on('error', (err: Error) => logger.error({ err, purpose }, 'Connection error'));
  client.on('close', () => logger.warn({ purpose }, 'Connection closed'));

  return client;
}

/** Main Redis client for get/set/hash operations. */
export const redis = createRedisClient('main');

/** Dedicated publisher for pub/sub (cannot use subscriber's connection). */
export const redisPublisher = createRedisClient('publisher');

/** Dedicated subscriber for pub/sub channels. */
export const redisSubscriber = createRedisClient('subscriber');

/** Connect all Redis clients. Call during app startup. */
export async function connectRedis(): Promise<void> {
  const clients = [redis, redisPublisher, redisSubscriber].filter(Boolean) as Redis[];
  if (!clients.length) {
    logger.info('REDIS_URL not configured — using in-memory state (single instance only)');
    return;
  }
  await Promise.all(clients.map((c) => c.connect()));
}

/** Disconnect all Redis clients. Call during graceful shutdown. */
export async function disconnectRedis(): Promise<void> {
  const clients = [redis, redisPublisher, redisSubscriber].filter(Boolean) as Redis[];
  await Promise.all(clients.map((c) => c.quit().catch(() => {})));
}
