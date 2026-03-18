import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock redis as null (in-memory fallback mode)
vi.mock('../lib/redis.js', () => ({ redis: null }));

import { RedisCache } from '../lib/cache.js';

describe('RedisCache (in-memory fallback)', () => {
  let cache: RedisCache<{ value: number }>;

  beforeEach(() => {
    cache = new RedisCache<{ value: number }>('test', 1000);
  });

  it('returns null for missing key', async () => {
    expect(await cache.get('missing')).toBeNull();
  });

  it('set and get round-trip', async () => {
    await cache.set('key1', { value: 42 });
    expect(await cache.get('key1')).toEqual({ value: 42 });
  });

  it('has() returns true for existing key', async () => {
    await cache.set('key2', { value: 99 });
    expect(await cache.has('key2')).toBe(true);
  });

  it('has() returns false for missing key', async () => {
    expect(await cache.has('nope')).toBe(false);
  });

  it('del() removes a key', async () => {
    await cache.set('key3', { value: 1 });
    await cache.del('key3');
    expect(await cache.get('key3')).toBeNull();
  });

  it('expires entries after TTL', async () => {
    // Use a very short TTL
    const shortCache = new RedisCache<string>('short', 1);
    await shortCache.set('exp', 'data');

    // Wait for expiration
    await new Promise((r) => setTimeout(r, 10));
    expect(await shortCache.get('exp')).toBeNull();
  });

  it('has() returns false for expired entries', async () => {
    const shortCache = new RedisCache<string>('short2', 1);
    await shortCache.set('exp2', 'data');
    await new Promise((r) => setTimeout(r, 10));
    expect(await shortCache.has('exp2')).toBe(false);
  });

  it('custom TTL overrides default', async () => {
    await cache.set('custom', { value: 7 }, 50);
    expect(await cache.get('custom')).toEqual({ value: 7 });
    await new Promise((r) => setTimeout(r, 60));
    expect(await cache.get('custom')).toBeNull();
  });
});
