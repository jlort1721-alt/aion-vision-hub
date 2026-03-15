import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../config/env.js', () => ({
  config: {
    DEVICE_RECONNECT_MAX_ATTEMPTS: 3,
    DEVICE_RECONNECT_BASE_DELAY_MS: 1000,
  },
}));

import { ReconnectPolicy } from '../policies/reconnect.js';

function createMockLogger() {
  return {
    child: vi.fn().mockReturnThis(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  } as any;
}

describe('ReconnectPolicy', () => {
  let policy: ReconnectPolicy;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.useFakeTimers();
    // Stub Math.random for deterministic jitter
    vi.spyOn(Math, 'random').mockReturnValue(0);
    logger = createMockLogger();
    policy = new ReconnectPolicy(logger);
  });

  afterEach(() => {
    policy.stopAll();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('shouldReconnect', () => {
    it('returns true for unknown device', () => {
      expect(policy.shouldReconnect('dev-1')).toBe(true);
    });

    it('returns true when under max attempts', () => {
      const reconnectFn = vi.fn().mockRejectedValue(new Error('fail'));
      policy.scheduleReconnect('dev-1', reconnectFn);
      expect(policy.shouldReconnect('dev-1')).toBe(true);
    });

    it('returns false after max attempts exhausted', () => {
      const reconnectFn = vi.fn().mockRejectedValue(new Error('fail'));
      // Schedule 3 times to exhaust attempts
      policy.scheduleReconnect('dev-1', reconnectFn);
      policy.scheduleReconnect('dev-1', reconnectFn);
      policy.scheduleReconnect('dev-1', reconnectFn);
      // After 3 attempts (max), should be exhausted
      policy.scheduleReconnect('dev-1', reconnectFn);
      expect(policy.shouldReconnect('dev-1')).toBe(false);
    });
  });

  describe('scheduleReconnect', () => {
    it('sets status to waiting on first call', () => {
      const reconnectFn = vi.fn().mockResolvedValue(undefined);
      policy.scheduleReconnect('dev-1', reconnectFn);
      const state = policy.getState('dev-1');
      expect(state?.status).toBe('waiting');
      expect(state?.attempts).toBe(1);
    });

    it('increments attempt count', () => {
      const reconnectFn = vi.fn().mockRejectedValue(new Error('fail'));
      policy.scheduleReconnect('dev-1', reconnectFn);
      policy.scheduleReconnect('dev-1', reconnectFn);
      const state = policy.getState('dev-1');
      expect(state?.attempts).toBe(2);
    });

    it('sets status to exhausted after max attempts', () => {
      const reconnectFn = vi.fn().mockRejectedValue(new Error('fail'));
      policy.scheduleReconnect('dev-1', reconnectFn);
      policy.scheduleReconnect('dev-1', reconnectFn);
      policy.scheduleReconnect('dev-1', reconnectFn);
      // Attempt 4 should be blocked — status is exhausted
      policy.scheduleReconnect('dev-1', reconnectFn);
      const state = policy.getState('dev-1');
      expect(state?.status).toBe('exhausted');
    });

    it('calls reconnectFn after delay', async () => {
      const reconnectFn = vi.fn().mockResolvedValue(undefined);
      policy.scheduleReconnect('dev-1', reconnectFn);

      // With Math.random = 0, jitter is 0, delay = 1000 * 2^0 = 1000ms
      expect(reconnectFn).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1000);
      expect(reconnectFn).toHaveBeenCalledOnce();
    });

    it('resets state on successful reconnect', async () => {
      const reconnectFn = vi.fn().mockResolvedValue(undefined);
      policy.scheduleReconnect('dev-1', reconnectFn);

      await vi.advanceTimersByTimeAsync(1000);
      expect(policy.getState('dev-1')).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('clears state for device', () => {
      const reconnectFn = vi.fn().mockRejectedValue(new Error('fail'));
      policy.scheduleReconnect('dev-1', reconnectFn);
      expect(policy.getState('dev-1')).toBeDefined();

      policy.reset('dev-1');
      expect(policy.getState('dev-1')).toBeUndefined();
    });

    it('is safe for unknown device', () => {
      expect(() => policy.reset('unknown')).not.toThrow();
    });
  });

  describe('getState', () => {
    it('returns undefined for unknown device', () => {
      expect(policy.getState('unknown')).toBeUndefined();
    });
  });

  describe('stopAll', () => {
    it('clears all devices', () => {
      const reconnectFn = vi.fn().mockRejectedValue(new Error('fail'));
      policy.scheduleReconnect('dev-1', reconnectFn);
      policy.scheduleReconnect('dev-2', reconnectFn);

      policy.stopAll();
      expect(policy.getState('dev-1')).toBeUndefined();
      expect(policy.getState('dev-2')).toBeUndefined();
    });
  });
});
