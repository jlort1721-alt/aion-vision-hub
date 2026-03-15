import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/env.js', () => ({
  config: {
    GATEWAY_ID: 'gw-test',
    SITE_ID: 'site-test',
    MEDIAMTX_API_URL: 'http://localhost:9997',
  },
}));

vi.mock('undici', () => ({
  request: vi.fn().mockResolvedValue({ statusCode: 200 }),
}));

vi.mock('@aion/common-utils', () => ({
  generateToken: vi.fn().mockReturnValue('mock-token-123'),
  secondsFromNow: vi.fn().mockReturnValue(1700000000),
}));

vi.mock('@aion/shared-contracts', () => ({
  DEFAULT_STREAM_POLICY: {
    mosaic: 'sub',
    fullscreen: 'main',
    playback: 'main',
    export: 'main',
    thumbnail: 'sub',
    fallbackOrder: ['sub', 'main', 'third'],
    maxConcurrentMainStreams: 4,
    maxConcurrentSubStreams: 32,
  },
  VALID_STREAM_TRANSITIONS: {
    idle: ['connecting'],
    connecting: ['live', 'failed', 'unauthorized'],
    live: ['degraded', 'reconnecting', 'idle'],
    degraded: ['live', 'reconnecting', 'failed'],
    reconnecting: ['live', 'failed', 'unavailable'],
    failed: ['connecting', 'idle'],
    unauthorized: ['connecting', 'idle'],
    unavailable: ['connecting', 'idle'],
  },
}));

import { StreamManager } from '../services/stream-manager.js';

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
    getDevice: vi.fn().mockReturnValue({ deviceId: 'dev-1' }),
  } as any;
}

const testProfiles = [
  { type: 'main', url: 'rtsp://192.168.1.100:554/main', codec: 'h264', resolution: '1920x1080' },
  { type: 'sub', url: 'rtsp://192.168.1.100:554/sub', codec: 'h264', resolution: '640x480' },
] as any[];

describe('StreamManager', () => {
  let manager: StreamManager;
  let logger: ReturnType<typeof createMockLogger>;
  let deviceManager: ReturnType<typeof createMockDeviceManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createMockLogger();
    deviceManager = createMockDeviceManager();
    manager = new StreamManager(deviceManager, logger);
  });

  describe('registerStreams', () => {
    it('stores registration with correct deviceId and gatewayId', async () => {
      const reg = await manager.registerStreams('dev-1', testProfiles);

      expect(reg.deviceId).toBe('dev-1');
      expect(reg.gatewayId).toBe('gw-test');
      expect(reg.siteId).toBe('site-test');
      expect(reg.profiles).toHaveLength(2);
      expect(reg.state).toBe('idle');
    });

    it('is retrievable after registration', async () => {
      await manager.registerStreams('dev-1', testProfiles);
      expect(manager.getRegistration('dev-1')).toBeDefined();
    });
  });

  describe('getRegistration', () => {
    it('returns undefined for unregistered device', () => {
      expect(manager.getRegistration('unknown')).toBeUndefined();
    });
  });

  describe('listRegistrations', () => {
    it('returns all registrations', async () => {
      await manager.registerStreams('dev-1', testProfiles);
      await manager.registerStreams('dev-2', testProfiles);

      expect(manager.listRegistrations()).toHaveLength(2);
    });
  });

  describe('selectStream', () => {
    beforeEach(async () => {
      await manager.registerStreams('dev-1', testProfiles);
    });

    it('selects sub stream for mosaic context', () => {
      const profile = manager.selectStream('dev-1', 'mosaic' as any);
      expect(profile?.type).toBe('sub');
    });

    it('selects main stream for fullscreen context', () => {
      const profile = manager.selectStream('dev-1', 'fullscreen' as any);
      expect(profile?.type).toBe('main');
    });

    it('falls back through fallbackOrder when preferred not available', async () => {
      // Register with only 'main' profile
      await manager.registerStreams('dev-only-main', [testProfiles[0]]);
      // mosaic wants 'sub', but only 'main' is available → fallback to sub (not found) → main
      const profile = manager.selectStream('dev-only-main', 'mosaic' as any);
      expect(profile?.type).toBe('main');
    });

    it('returns undefined for unregistered device', () => {
      expect(manager.selectStream('unknown', 'mosaic' as any)).toBeUndefined();
    });
  });

  describe('getStreamUrl', () => {
    it('returns URL for registered stream type', async () => {
      await manager.registerStreams('dev-1', testProfiles);
      const url = manager.getStreamUrl('dev-1', 'main' as any);
      expect(url).toBe('rtsp://192.168.1.100:554/main');
    });

    it('returns undefined for unregistered device', () => {
      expect(manager.getStreamUrl('unknown', 'main' as any)).toBeUndefined();
    });

    it('returns undefined for unregistered stream type', async () => {
      await manager.registerStreams('dev-1', testProfiles);
      expect(manager.getStreamUrl('dev-1', 'third' as any)).toBeUndefined();
    });
  });

  describe('generateSignedUrl', () => {
    it('returns signed URL with token and expiry', async () => {
      await manager.registerStreams('dev-1', testProfiles);
      const signed = manager.generateSignedUrl('dev-1', 'main' as any);

      expect(signed).not.toBeNull();
      expect(signed!.token).toBe('mock-token-123');
      expect(signed!.expiresAt).toBe(1700000000);
      expect(signed!.protocol).toBe('webrtc');
      expect(signed!.deviceId).toBe('dev-1');
      expect(signed!.streamType).toBe('main');
    });

    it('returns null for unregistered device', () => {
      expect(manager.generateSignedUrl('unknown', 'main' as any)).toBeNull();
    });

    it('returns null for unavailable stream type', async () => {
      await manager.registerStreams('dev-1', testProfiles);
      expect(manager.generateSignedUrl('dev-1', 'third' as any)).toBeNull();
    });

    it('generates RTSP URL when protocol is rtsp', async () => {
      await manager.registerStreams('dev-1', testProfiles);
      const signed = manager.generateSignedUrl('dev-1', 'main' as any, 'rtsp');
      expect(signed!.url).toBe('rtsp://192.168.1.100:554/main');
      expect(signed!.protocol).toBe('rtsp');
    });
  });

  describe('transitionState', () => {
    beforeEach(async () => {
      await manager.registerStreams('dev-1', testProfiles);
    });

    it('allows valid transition: idle → connecting', () => {
      const result = manager.transitionState('dev-1', 'connecting' as any, 'user request');
      expect(result).toBe(true);
      expect(manager.getRegistration('dev-1')?.state).toBe('connecting');
    });

    it('allows valid transition chain: idle → connecting → live', () => {
      manager.transitionState('dev-1', 'connecting' as any, 'start');
      const result = manager.transitionState('dev-1', 'live' as any, 'connected');
      expect(result).toBe(true);
      expect(manager.getRegistration('dev-1')?.state).toBe('live');
    });

    it('rejects invalid transition: idle → live', () => {
      const result = manager.transitionState('dev-1', 'live' as any, 'invalid');
      expect(result).toBe(false);
      expect(manager.getRegistration('dev-1')?.state).toBe('idle');
    });

    it('returns false for unregistered device', () => {
      expect(manager.transitionState('unknown', 'connecting' as any, 'test')).toBe(false);
    });
  });

  describe('unregister', () => {
    it('removes registration', async () => {
      await manager.registerStreams('dev-1', testProfiles);
      manager.unregister('dev-1');
      expect(manager.getRegistration('dev-1')).toBeUndefined();
    });
  });

  describe('updatePolicy', () => {
    it('merges policy updates', async () => {
      await manager.registerStreams('dev-1', testProfiles);

      manager.updatePolicy({ mosaic: 'main' as any });

      // Now mosaic should prefer 'main'
      const profile = manager.selectStream('dev-1', 'mosaic' as any);
      expect(profile?.type).toBe('main');
    });
  });
});
