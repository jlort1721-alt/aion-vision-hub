import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────

const { mockDispatch } = vi.hoisted(() => ({
  mockDispatch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../db/schema/index.js', () => ({
  sites: { id: 'id', name: 'name', wanIp: 'wan_ip' },
  devices: {
    id: 'id', name: 'name', port: 'port', type: 'type',
    status: 'status', tenantId: 'tenant_id', siteId: 'site_id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ op: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  isNotNull: vi.fn((a: unknown) => ({ op: 'isNotNull', a })),
}));

vi.mock('../workers/notification-dispatcher.js', () => ({
  dispatchDeviceStateChange: (...args: unknown[]) => mockDispatch(...args),
}));

// Mock net module — we control TCP ping results via mockSocketBehavior
const mockSocketBehavior = { reachable: true, latency: 12 };
vi.mock('net', () => {
  const EventEmitter = require('events');
  return {
    Socket: vi.fn().mockImplementation(() => {
      const socket = new EventEmitter();
      socket.setTimeout = vi.fn();
      socket.destroy = vi.fn();
      socket.connect = vi.fn().mockImplementation(() => {
        if (mockSocketBehavior.reachable) {
          process.nextTick(() => socket.emit('connect'));
        } else {
          process.nextTick(() => socket.emit('error', new Error('ECONNREFUSED')));
        }
      });
      return socket;
    }),
  };
});

import {
  startHealthCheckWorker,
  stopHealthCheckWorker,
  healthCheckCache,
} from '../workers/health-check-worker.js';

// ── Helpers ───────────────────────────────────────────────────────

function buildDb(siteRows: unknown[], deviceRows: unknown[]) {
  // Simpler builder: first .where() returns sites, second returns devices
  let queryCounter = 0;
  const whereFn = vi.fn().mockImplementation(() => {
    queryCounter++;
    if (queryCounter === 1) return Promise.resolve(siteRows);
    return Promise.resolve(deviceRows);
  });
  const fromFn = vi.fn().mockReturnValue({ where: whereFn });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  const updateWhereFn = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn().mockReturnValue({ where: updateWhereFn });
  const updateFn = vi.fn().mockReturnValue({ set: setFn });

  return { select: selectFn, update: updateFn, _setFn: setFn, _updateWhereFn: updateWhereFn };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('Health Check Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    healthCheckCache.clear();
    mockSocketBehavior.reachable = true;
    mockSocketBehavior.latency = 12;
  });

  afterEach(() => {
    stopHealthCheckWorker();
    vi.useRealTimers();
  });

  // ── startHealthCheckWorker / stopHealthCheckWorker ─────────

  describe('startHealthCheckWorker', () => {
    it('returns a cleanup function', () => {
      const db = buildDb([], []);
      const cleanup = startHealthCheckWorker(db as any, 60_000);
      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('prevents double-start (warns and returns cleanup)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const db = buildDb([], []);

      startHealthCheckWorker(db as any, 60_000);
      const cleanup2 = startHealthCheckWorker(db as any, 60_000);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('already running'),
      );
      expect(typeof cleanup2).toBe('function');
      warnSpy.mockRestore();
    });

    it('runs an immediate check on start', async () => {
      const db = buildDb([], []);
      startHealthCheckWorker(db as any, 300_000);

      // The immediate call is async — flush microtasks
      await vi.advanceTimersByTimeAsync(0);

      expect(db.select).toHaveBeenCalled();
    });

    it('runs checks on each interval tick', async () => {
      const db = buildDb([], []);
      startHealthCheckWorker(db as any, 1000);

      await vi.advanceTimersByTimeAsync(0); // initial
      db.select.mockClear();

      await vi.advanceTimersByTimeAsync(1000);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('stopHealthCheckWorker', () => {
    it('stops the timer so no further ticks fire', async () => {
      const db = buildDb([], []);
      startHealthCheckWorker(db as any, 1000);

      await vi.advanceTimersByTimeAsync(0); // initial
      stopHealthCheckWorker();
      db.select.mockClear();

      await vi.advanceTimersByTimeAsync(5000);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('is safe to call when not running', () => {
      expect(() => stopHealthCheckWorker()).not.toThrow();
    });
  });

  // ── Health check sweep logic ──────────────────────────────

  describe('health check sweep', () => {
    it('skips sites with no wanIp', async () => {
      const db = buildDb([{ id: 's1', name: 'Site 1', wanIp: null }], []);
      startHealthCheckWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      // Only the sites query should have been executed (devices query skipped)
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('skips non-checkable device types (network_wan, domotic, etc.)', async () => {
      const site = { id: 's1', name: 'HQ', wanIp: '1.2.3.4' };
      const devs = [
        { id: 'd1', name: 'WAN', port: 80, type: 'network_wan', status: 'online', tenantId: 't1' },
        { id: 'd2', name: 'LAN', port: 80, type: 'network_lan', status: 'online', tenantId: 't1' },
        { id: 'd3', name: 'Ewe', port: 80, type: 'cloud_account_ewelink', status: 'online', tenantId: 't1' },
      ];
      const db = buildDb([site], devs);
      startHealthCheckWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      // No device should be pinged or cached since all are skip types
      expect(healthCheckCache.size).toBe(0);
    });

    it('caches results for reachable devices', async () => {
      mockSocketBehavior.reachable = true;
      const site = { id: 's1', name: 'HQ', wanIp: '10.0.0.1' };
      const devs = [
        { id: 'd1', name: 'Cam 1', port: 554, type: 'camera', status: 'online', tenantId: 't1' },
      ];
      const db = buildDb([site], devs);
      startHealthCheckWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(healthCheckCache.has('d1')).toBe(true);
      expect(healthCheckCache.get('d1')!.reachable).toBe(true);
    });

    it('caches results for unreachable devices', async () => {
      mockSocketBehavior.reachable = false;
      const site = { id: 's1', name: 'HQ', wanIp: '10.0.0.1' };
      const devs = [
        { id: 'd1', name: 'Cam 1', port: 554, type: 'camera', status: 'online', tenantId: 't1' },
      ];
      const db = buildDb([site], devs);
      startHealthCheckWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(healthCheckCache.has('d1')).toBe(true);
      expect(healthCheckCache.get('d1')!.reachable).toBe(false);
      expect(healthCheckCache.get('d1')!.latencyMs).toBeNull();
    });

    it('updates DB when device status changes (online -> offline)', async () => {
      mockSocketBehavior.reachable = false;
      const site = { id: 's1', name: 'HQ', wanIp: '10.0.0.1' };
      const devs = [
        { id: 'd1', name: 'Cam 1', port: 554, type: 'camera', status: 'online', tenantId: 't1' },
      ];
      const db = buildDb([site], devs);
      startHealthCheckWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(db.update).toHaveBeenCalled();
      expect(db._setFn).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'offline' }),
      );
    });

    it('dispatches notification on state change', async () => {
      mockSocketBehavior.reachable = false;
      const site = { id: 's1', name: 'HQ', wanIp: '10.0.0.1' };
      const devs = [
        { id: 'd1', name: 'Cam 1', port: 554, type: 'camera', status: 'online', tenantId: 't1' },
      ];
      const db = buildDb([site], devs);
      startHealthCheckWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          deviceId: 'd1',
          previousStatus: 'online',
          newStatus: 'offline',
        }),
      );
    });

    it('updates lastSeen when device comes online from offline', async () => {
      mockSocketBehavior.reachable = true;
      const site = { id: 's1', name: 'HQ', wanIp: '10.0.0.1' };
      const devs = [
        { id: 'd1', name: 'Cam 1', port: 554, type: 'camera', status: 'offline', tenantId: 't1' },
      ];
      const db = buildDb([site], devs);
      startHealthCheckWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(db._setFn).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'online', lastSeen: expect.any(Date) }),
      );
    });

    it('updates lastSeen when device is still online (no status change)', async () => {
      mockSocketBehavior.reachable = true;
      const site = { id: 's1', name: 'HQ', wanIp: '10.0.0.1' };
      const devs = [
        { id: 'd1', name: 'Cam 1', port: 554, type: 'camera', status: 'online', tenantId: 't1' },
      ];
      const db = buildDb([site], devs);
      startHealthCheckWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      // Should still call update for lastSeen even though status hasn't changed
      expect(db.update).toHaveBeenCalled();
      expect(db._setFn).toHaveBeenCalledWith(
        expect.objectContaining({ lastSeen: expect.any(Date) }),
      );
    });

    it('continues sweep when notification dispatch fails', async () => {
      mockSocketBehavior.reachable = false;
      mockDispatch.mockRejectedValueOnce(new Error('dispatch boom'));

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const site = { id: 's1', name: 'HQ', wanIp: '10.0.0.1' };
      const devs = [
        { id: 'd1', name: 'Cam 1', port: 554, type: 'camera', status: 'online', tenantId: 't1' },
      ];
      const db = buildDb([site], devs);
      startHealthCheckWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('Notification dispatch failed'),
        expect.any(Error),
      );
      errSpy.mockRestore();
    });

    it('handles per-device errors without stopping the sweep', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const site = { id: 's1', name: 'HQ', wanIp: '10.0.0.1' };
      // Device with no port should cause an error path
      const devs = [
        { id: 'd1', name: 'Cam 1', port: null, type: 'camera', status: 'online', tenantId: 't1' },
      ];
      const db = buildDb([site], devs);
      startHealthCheckWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      // Worker should not crash
      errSpy.mockRestore();
    });
  });
});
