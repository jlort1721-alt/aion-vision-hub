import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../retry.js';

describe('withRetry', () => {
  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffFactor: 2, jitter: false });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffFactor: 2, jitter: false });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffFactor: 2, jitter: false }))
      .rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('not retryable'));
    await expect(withRetry(fn, {
      maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 100, backoffFactor: 2, jitter: false,
      retryableErrors: () => false,
    })).rejects.toThrow('not retryable');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
