/**
 * Generic Redis-backed cache with in-memory fallback.
 * Provides a transparent caching layer for services.
 */

import { redis } from './redis.js';

const CACHE_PREFIX = 'cache:';

export class RedisCache<T> {
  private memoryFallback = new Map<string, { data: T; expiresAt: number }>();
  private readonly prefix: string;
  private readonly defaultTtlMs: number;

  constructor(namespace: string, defaultTtlMs = 300_000) {
    this.prefix = `${CACHE_PREFIX}${namespace}:`;
    this.defaultTtlMs = defaultTtlMs;
  }

  async get(key: string): Promise<T | null> {
    if (redis) {
      const data = await redis.get(`${this.prefix}${key}`);
      if (!data) return null;
      return JSON.parse(data) as T;
    }

    const entry = this.memoryFallback.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      if (entry) this.memoryFallback.delete(key);
      return null;
    }
    return entry.data;
  }

  async set(key: string, value: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs ?? this.defaultTtlMs;

    if (redis) {
      await redis.set(`${this.prefix}${key}`, JSON.stringify(value), 'PX', ttl);
    } else {
      this.memoryFallback.set(key, { data: value, expiresAt: Date.now() + ttl });
    }
  }

  async del(key: string): Promise<void> {
    if (redis) {
      await redis.del(`${this.prefix}${key}`);
    } else {
      this.memoryFallback.delete(key);
    }
  }

  async has(key: string): Promise<boolean> {
    if (redis) {
      return (await redis.exists(`${this.prefix}${key}`)) === 1;
    }
    const entry = this.memoryFallback.get(key);
    if (!entry || Date.now() > entry.expiresAt) return false;
    return true;
  }
}
