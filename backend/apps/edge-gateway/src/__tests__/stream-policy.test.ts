import { describe, it, expect } from 'vitest';
import type { StreamProfile } from '@aion/shared-contracts';
import { StreamPolicyEngine } from '../policies/stream-policy.js';

const mainProfile: StreamProfile = {
  type: 'main',
  url: 'rtsp://cam/main',
  codec: 'H.265',
  resolution: '2560x1440',
  fps: 25,
  channel: 1,
};

const subProfile: StreamProfile = {
  type: 'sub',
  url: 'rtsp://cam/sub',
  codec: 'H.264',
  resolution: '640x480',
  fps: 15,
  channel: 1,
};

const thirdProfile: StreamProfile = {
  type: 'third',
  url: 'rtsp://cam/third',
  codec: 'H.264',
  resolution: '320x240',
  fps: 10,
  channel: 1,
};

describe('StreamPolicyEngine', () => {
  it('should select sub stream for mosaic context', () => {
    const engine = new StreamPolicyEngine();
    const selected = engine.selectProfile([mainProfile, subProfile], 'mosaic');
    expect(selected).not.toBeNull();
    expect(selected!.type).toBe('sub');
  });

  it('should select main stream for fullscreen context', () => {
    const engine = new StreamPolicyEngine();
    const selected = engine.selectProfile([mainProfile, subProfile], 'fullscreen');
    expect(selected).not.toBeNull();
    expect(selected!.type).toBe('main');
  });

  it('should fall back when preferred type is unavailable', () => {
    const engine = new StreamPolicyEngine();
    // Only third stream available; mosaic prefers 'sub', fullscreen prefers 'main',
    // fallbackOrder is ['sub', 'main', 'third'] so it should eventually pick third.
    const selected = engine.selectProfile([thirdProfile], 'fullscreen');
    expect(selected).not.toBeNull();
    expect(selected!.type).toBe('third');
  });

  it('should return null for empty profiles list', () => {
    const engine = new StreamPolicyEngine();
    const selected = engine.selectProfile([], 'mosaic');
    expect(selected).toBeNull();
  });

  describe('concurrency limits', () => {
    it('should enforce main stream concurrency limit', () => {
      const engine = new StreamPolicyEngine({ maxConcurrentMainStreams: 2 });

      expect(engine.acquireStream('main')).toBe(true);
      expect(engine.acquireStream('main')).toBe(true);
      // Third main stream should be denied
      expect(engine.acquireStream('main')).toBe(false);
    });

    it('should enforce sub stream concurrency limit', () => {
      const engine = new StreamPolicyEngine({ maxConcurrentSubStreams: 1 });

      expect(engine.acquireStream('sub')).toBe(true);
      expect(engine.acquireStream('sub')).toBe(false);
    });

    it('should allow acquiring after releasing', () => {
      const engine = new StreamPolicyEngine({ maxConcurrentMainStreams: 1 });

      expect(engine.acquireStream('main')).toBe(true);
      expect(engine.acquireStream('main')).toBe(false);
      engine.releaseStream('main');
      expect(engine.acquireStream('main')).toBe(true);
    });

    it('should fall back to sub when main limit is reached during profile selection', () => {
      const engine = new StreamPolicyEngine({ maxConcurrentMainStreams: 1 });

      // Exhaust the main stream limit
      engine.acquireStream('main');

      // Fullscreen prefers main but limit is reached, should fall back to sub
      const selected = engine.selectProfile([mainProfile, subProfile], 'fullscreen');
      expect(selected).not.toBeNull();
      expect(selected!.type).toBe('sub');
    });

    it('should report stats correctly', () => {
      const engine = new StreamPolicyEngine({ maxConcurrentMainStreams: 4, maxConcurrentSubStreams: 32 });

      engine.acquireStream('main');
      engine.acquireStream('main');
      engine.acquireStream('sub');

      const stats = engine.getStats();
      expect(stats.activeMainStreams).toBe(2);
      expect(stats.activeSubStreams).toBe(1);
      expect(stats.maxMainStreams).toBe(4);
      expect(stats.maxSubStreams).toBe(32);
    });
  });
});
