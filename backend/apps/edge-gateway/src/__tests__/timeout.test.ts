import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the config module before importing
vi.mock('../config/env.js', () => ({
  config: {
    DEVICE_CONNECT_TIMEOUT_MS: 5000,
    DISCOVERY_TIMEOUT_MS: 10000,
  },
}));

import { withTimeout } from '../policies/timeout.js';

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when promise completes before timeout', async () => {
    const promise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('done'), 100);
    });

    const resultPromise = withTimeout(promise, 5000, 'test-op');
    vi.advanceTimersByTime(100);
    const result = await resultPromise;
    expect(result).toBe('done');
  });

  it('rejects with timeout error when promise exceeds ms', async () => {
    const promise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('done'), 10000);
    });

    const resultPromise = withTimeout(promise, 100, 'connect');
    vi.advanceTimersByTime(100);

    await expect(resultPromise).rejects.toThrow('Timeout: connect exceeded 100ms');
  });

  it('error message includes operation name and duration', async () => {
    const neverResolves = new Promise<void>(() => {});
    const resultPromise = withTimeout(neverResolves, 3000, 'device-ping');
    vi.advanceTimersByTime(3000);

    await expect(resultPromise).rejects.toThrow('Timeout: device-ping exceeded 3000ms');
  });

  it('propagates original error when promise rejects before timeout', async () => {
    const promise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('connection refused')), 50);
    });

    const resultPromise = withTimeout(promise, 5000, 'connect');
    vi.advanceTimersByTime(50);

    await expect(resultPromise).rejects.toThrow('connection refused');
  });

  it('resolves immediately for already-resolved promise', async () => {
    const result = await withTimeout(Promise.resolve(42), 5000, 'instant');
    expect(result).toBe(42);
  });

  it('rejects immediately for already-rejected promise', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('fail')), 5000, 'instant'),
    ).rejects.toThrow('fail');
  });
});
