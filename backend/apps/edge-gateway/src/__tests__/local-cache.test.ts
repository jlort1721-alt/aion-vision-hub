import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalCache } from '../cache/local-cache.js';

describe('LocalCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should store and retrieve values', () => {
    const cache = new LocalCache<string>();
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return undefined for missing keys', () => {
    const cache = new LocalCache<string>();
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should expire entries after TTL', () => {
    const cache = new LocalCache<string>(100, 1000); // 1 second TTL
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');

    // Advance time past TTL
    vi.advanceTimersByTime(1001);
    expect(cache.get('key')).toBeUndefined();
  });

  it('should support per-entry TTL override', () => {
    const cache = new LocalCache<string>(100, 5000); // default 5s TTL
    cache.set('short', 'short-lived', 500);
    cache.set('long', 'long-lived', 10000);

    vi.advanceTimersByTime(600);
    expect(cache.get('short')).toBeUndefined();
    expect(cache.get('long')).toBe('long-lived');
  });

  it('should evict oldest entry when at capacity', () => {
    const cache = new LocalCache<string>(3, 60000);

    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    // Cache is full; adding a new entry should evict the oldest ('a')
    cache.set('d', '4');

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
    expect(cache.get('d')).toBe('4');
  });

  it('should promote recently accessed entries (LRU behavior)', () => {
    const cache = new LocalCache<string>(3, 60000);

    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');

    // Access 'a' to promote it to most recently used
    cache.get('a');

    // Adding a new entry should now evict 'b' (the least recently used)
    cache.set('d', '4');

    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe('3');
    expect(cache.get('d')).toBe('4');
  });

  it('should prune expired entries', () => {
    const cache = new LocalCache<string>(100, 1000);
    cache.set('expire1', 'val1');
    cache.set('expire2', 'val2');
    cache.set('keep', 'val3', 60000); // long TTL

    vi.advanceTimersByTime(1001);

    const pruned = cache.prune();
    expect(pruned).toBe(2);
    expect(cache.size()).toBe(1);
    expect(cache.get('keep')).toBe('val3');
  });

  it('should report correct size', () => {
    const cache = new LocalCache<number>();
    expect(cache.size()).toBe(0);

    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.size()).toBe(2);
  });

  it('should delete entries', () => {
    const cache = new LocalCache<string>();
    cache.set('key', 'value');
    expect(cache.delete('key')).toBe(true);
    expect(cache.get('key')).toBeUndefined();
    expect(cache.delete('key')).toBe(false);
  });

  it('should clear all entries', () => {
    const cache = new LocalCache<string>();
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('should check existence with has()', () => {
    const cache = new LocalCache<string>(100, 1000);
    cache.set('key', 'value');
    expect(cache.has('key')).toBe(true);
    expect(cache.has('missing')).toBe(false);

    // Expired entries should not be found
    vi.advanceTimersByTime(1001);
    expect(cache.has('key')).toBe(false);
  });
});
