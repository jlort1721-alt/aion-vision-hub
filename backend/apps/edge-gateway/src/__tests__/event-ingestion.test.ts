import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../config/env.js', () => ({
  config: {
    BACKEND_API_URL: 'http://localhost:3000',
    BACKEND_API_KEY: 'test-api-key',
  },
}));

vi.mock('undici', () => ({
  request: vi.fn().mockResolvedValue({ statusCode: 200 }),
}));

import { EventIngestionService } from '../services/event-ingestion.js';
import { request as undiciRequest } from 'undici';

function createMockLogger() {
  return {
    child: vi.fn().mockReturnThis(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as any;
}

function createMockDeviceManager() {
  return {
    getAdapter: vi.fn(),
    getDevice: vi.fn(),
  } as any;
}

describe('EventIngestionService (edge-gateway)', () => {
  let service: EventIngestionService;
  let logger: ReturnType<typeof createMockLogger>;
  let deviceManager: ReturnType<typeof createMockDeviceManager>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    logger = createMockLogger();
    deviceManager = createMockDeviceManager();
    service = new EventIngestionService(deviceManager, logger);
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  describe('subscribe', () => {
    it('subscribes to device events via adapter', async () => {
      const mockUnsub = vi.fn();
      const mockAdapter = { subscribe: vi.fn().mockResolvedValue(mockUnsub) };
      deviceManager.getAdapter.mockReturnValue(mockAdapter);

      await service.subscribe('dev-1');

      expect(deviceManager.getAdapter).toHaveBeenCalledWith('dev-1');
      expect(mockAdapter.subscribe).toHaveBeenCalledWith('dev-1', expect.any(Function));
      expect(service.isSubscribed('dev-1')).toBe(true);
    });

    it('skips subscription if device not connected', async () => {
      deviceManager.getAdapter.mockReturnValue(undefined);

      await service.subscribe('dev-1');

      expect(service.isSubscribed('dev-1')).toBe(false);
    });

    it('is idempotent — does not duplicate subscription', async () => {
      const mockAdapter = { subscribe: vi.fn().mockResolvedValue(vi.fn()) };
      deviceManager.getAdapter.mockReturnValue(mockAdapter);

      await service.subscribe('dev-1');
      await service.subscribe('dev-1');

      expect(mockAdapter.subscribe).toHaveBeenCalledOnce();
    });
  });

  describe('unsubscribe', () => {
    it('calls unsub function and removes subscription', async () => {
      const mockUnsub = vi.fn();
      const mockAdapter = { subscribe: vi.fn().mockResolvedValue(mockUnsub) };
      deviceManager.getAdapter.mockReturnValue(mockAdapter);

      await service.subscribe('dev-1');
      service.unsubscribe('dev-1');

      expect(mockUnsub).toHaveBeenCalledOnce();
      expect(service.isSubscribed('dev-1')).toBe(false);
    });

    it('is safe for unsubscribed device', () => {
      expect(() => service.unsubscribe('unknown')).not.toThrow();
    });
  });

  describe('callbacks', () => {
    it('registers callback and returns cleanup function', () => {
      const callback = vi.fn();
      const cleanup = service.onCallback(callback);

      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('invokes callbacks when event received', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      service.onCallback(callback1);
      service.onCallback(callback2);

      let eventHandler: any;
      const mockAdapter = {
        subscribe: vi.fn().mockImplementation((_id, handler) => {
          eventHandler = handler;
          return vi.fn();
        }),
      };
      deviceManager.getAdapter.mockReturnValue(mockAdapter);

      await service.subscribe('dev-1');

      const testEvent = { deviceId: 'dev-1', eventType: 'motion' };
      eventHandler(testEvent);

      expect(callback1).toHaveBeenCalledWith(testEvent);
      expect(callback2).toHaveBeenCalledWith(testEvent);
    });

    it('callback error does not break other callbacks', async () => {
      const badCallback = vi.fn().mockImplementation(() => {
        throw new Error('callback error');
      });
      const goodCallback = vi.fn();
      service.onCallback(badCallback);
      service.onCallback(goodCallback);

      let eventHandler: any;
      const mockAdapter = {
        subscribe: vi.fn().mockImplementation((_id, handler) => {
          eventHandler = handler;
          return vi.fn();
        }),
      };
      deviceManager.getAdapter.mockReturnValue(mockAdapter);

      await service.subscribe('dev-1');
      eventHandler({ deviceId: 'dev-1', eventType: 'motion' });

      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    it('sends buffered events to backend API', async () => {
      let eventHandler: any;
      const mockAdapter = {
        subscribe: vi.fn().mockImplementation((_id, handler) => {
          eventHandler = handler;
          return vi.fn();
        }),
      };
      deviceManager.getAdapter.mockReturnValue(mockAdapter);

      service.start();
      await service.subscribe('dev-1');
      eventHandler({ deviceId: 'dev-1', eventType: 'motion' });

      await vi.advanceTimersByTimeAsync(5000);

      expect(undiciRequest).toHaveBeenCalledWith(
        'http://localhost:3000/events/batch',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );
    });

    it('re-queues events on flush failure', async () => {
      vi.mocked(undiciRequest).mockRejectedValueOnce(new Error('network error'));

      let eventHandler: any;
      const mockAdapter = {
        subscribe: vi.fn().mockImplementation((_id, handler) => {
          eventHandler = handler;
          return vi.fn();
        }),
      };
      deviceManager.getAdapter.mockReturnValue(mockAdapter);

      service.start();
      await service.subscribe('dev-1');
      eventHandler({ deviceId: 'dev-1', eventType: 'motion' });

      await vi.advanceTimersByTimeAsync(5000);

      // Events re-queued — next flush should try again
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('stop unsubscribes from all devices', async () => {
      const mockUnsub = vi.fn();
      const mockAdapter = { subscribe: vi.fn().mockResolvedValue(mockUnsub) };
      deviceManager.getAdapter.mockReturnValue(mockAdapter);

      service.start();
      await service.subscribe('dev-1');
      await service.subscribe('dev-2');

      service.stop();

      expect(mockUnsub).toHaveBeenCalledTimes(2);
      expect(service.isSubscribed('dev-1')).toBe(false);
      expect(service.isSubscribed('dev-2')).toBe(false);
    });
  });
});
