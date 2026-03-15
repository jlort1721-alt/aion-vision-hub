import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the device-adapters factory
const mockAdapter = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  testConnection: vi.fn(),
  getCapabilities: vi.fn(),
};

vi.mock('@aion/device-adapters', () => ({
  AdapterFactory: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockReturnValue(mockAdapter),
  })),
}));

import { DeviceManager } from '../services/device-manager.js';

function createMockLogger() {
  return {
    child: vi.fn().mockReturnThis(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as any;
}

describe('DeviceManager', () => {
  let manager: DeviceManager;
  let logger: ReturnType<typeof createMockLogger>;

  const testConfig = {
    brand: 'hikvision',
    host: '192.168.1.100',
    port: 80,
    username: 'admin',
    password: 'pass',
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createMockLogger();
    manager = new DeviceManager(logger);
    mockAdapter.getCapabilities.mockResolvedValue({ ptz: true });
  });

  describe('connect', () => {
    it('stores managed device on successful connection', async () => {
      mockAdapter.connect.mockResolvedValue({ success: true, sessionId: 'sess-1' });

      const result = await manager.connect(testConfig);

      expect(result.success).toBe(true);
      expect(manager.isConnected('sess-1')).toBe(true);
      expect(manager.getDevice('sess-1')).toBeDefined();
      expect(manager.getDevice('sess-1')?.brand).toBe('hikvision');
    });

    it('does not store device on failed connection', async () => {
      mockAdapter.connect.mockResolvedValue({ success: false, error: 'timeout' });

      const result = await manager.connect(testConfig);

      expect(result.success).toBe(false);
      expect(manager.listDevices()).toHaveLength(0);
    });

    it('does not store device when sessionId is missing', async () => {
      mockAdapter.connect.mockResolvedValue({ success: true });

      await manager.connect(testConfig);

      expect(manager.listDevices()).toHaveLength(0);
    });
  });

  describe('disconnect', () => {
    it('removes device from map', async () => {
      mockAdapter.connect.mockResolvedValue({ success: true, sessionId: 'sess-1' });
      await manager.connect(testConfig);
      expect(manager.isConnected('sess-1')).toBe(true);

      await manager.disconnect('sess-1');

      expect(manager.isConnected('sess-1')).toBe(false);
      expect(mockAdapter.disconnect).toHaveBeenCalledWith('sess-1');
    });

    it('is no-op for unknown device', async () => {
      await manager.disconnect('unknown');
      expect(mockAdapter.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('getDevice / getAdapter', () => {
    it('returns managed device for connected device', async () => {
      mockAdapter.connect.mockResolvedValue({ success: true, sessionId: 'sess-1' });
      await manager.connect(testConfig);

      expect(manager.getDevice('sess-1')).toBeDefined();
      expect(manager.getAdapter('sess-1')).toBeDefined();
    });

    it('returns undefined for unknown device', () => {
      expect(manager.getDevice('unknown')).toBeUndefined();
      expect(manager.getAdapter('unknown')).toBeUndefined();
    });
  });

  describe('listDevices', () => {
    it('returns all connected devices', async () => {
      mockAdapter.connect.mockResolvedValueOnce({ success: true, sessionId: 'sess-1' });
      mockAdapter.connect.mockResolvedValueOnce({ success: true, sessionId: 'sess-2' });

      await manager.connect(testConfig);
      await manager.connect({ ...testConfig, brand: 'dahua' });

      const devices = manager.listDevices();
      expect(devices).toHaveLength(2);
    });

    it('returns empty array when no devices', () => {
      expect(manager.listDevices()).toHaveLength(0);
    });
  });

  describe('testConnection', () => {
    it('routes to adapter', async () => {
      mockAdapter.testConnection.mockResolvedValue({ success: true, latencyMs: 42 });

      const result = await manager.testConnection(testConfig);

      expect(result.success).toBe(true);
    });
  });

  describe('disconnectAll', () => {
    it('disconnects all devices', async () => {
      mockAdapter.connect.mockResolvedValueOnce({ success: true, sessionId: 'sess-1' });
      mockAdapter.connect.mockResolvedValueOnce({ success: true, sessionId: 'sess-2' });
      mockAdapter.disconnect.mockResolvedValue(undefined);

      await manager.connect(testConfig);
      await manager.connect(testConfig);

      await manager.disconnectAll();

      expect(manager.listDevices()).toHaveLength(0);
    });
  });

  describe('isConnected', () => {
    it('returns false for unknown device', () => {
      expect(manager.isConnected('unknown')).toBe(false);
    });

    it('returns true for connected device', async () => {
      mockAdapter.connect.mockResolvedValue({ success: true, sessionId: 'sess-1' });
      await manager.connect(testConfig);
      expect(manager.isConnected('sess-1')).toBe(true);
    });
  });
});
