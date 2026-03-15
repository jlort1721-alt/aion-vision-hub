import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing
vi.mock('../config/env.js', () => ({
  config: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-service-key',
    EVENT_FLUSH_INTERVAL_MS: 5000,
    EVENT_BUFFER_MAX_SIZE: 500,
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { EventIngestionService } from '../services/event-ingestion.js';

describe('EventIngestionService', () => {
  let service: EventIngestionService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    service = new EventIngestionService();
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  describe('Hikvision event normalization', () => {
    const testCases = [
      { eventType: 'VMD', expectedType: 'motion_detection', expectedSeverity: 'low' },
      { eventType: 'linedetection', expectedType: 'line_crossing', expectedSeverity: 'medium' },
      { eventType: 'fielddetection', expectedType: 'intrusion', expectedSeverity: 'high' },
      { eventType: 'videoloss', expectedType: 'video_loss', expectedSeverity: 'critical' },
      { eventType: 'facedetection', expectedType: 'face_detection', expectedSeverity: 'info' },
      { eventType: 'ANPR', expectedType: 'license_plate', expectedSeverity: 'info' },
      { eventType: 'shelteralarm', expectedType: 'camera_tamper', expectedSeverity: 'high' },
      { eventType: 'audiomutation', expectedType: 'audio_anomaly', expectedSeverity: 'medium' },
      { eventType: 'scenechangedetection', expectedType: 'scene_change', expectedSeverity: 'medium' },
      { eventType: 'PIR', expectedType: 'pir_alarm', expectedSeverity: 'medium' },
      { eventType: 'nicbroken', expectedType: 'network_disconnected', expectedSeverity: 'critical' },
    ];

    it.each(testCases)(
      'maps $eventType → type: $expectedType, severity: $expectedSeverity',
      async ({ eventType, expectedType, expectedSeverity }) => {
        service.ingestHikvision(
          { eventType, channelID: 1, dateTime: '2024-01-01T00:00:00Z' },
          'device-1',
          'tenant-1',
        );

        expect(service.getBufferSize()).toBe(1);

        service.stop();
        await vi.advanceTimersByTimeAsync(0);

        expect(mockFrom).toHaveBeenCalledWith('events');
        const insertedEvents = mockInsert.mock.calls[0][0];
        expect(insertedEvents[0].event_type).toBe(expectedType);
        expect(insertedEvents[0].severity).toBe(expectedSeverity);
        expect(insertedEvents[0].device_id).toBe('device-1');
        expect(insertedEvents[0].tenant_id).toBe('tenant-1');
      },
    );

    it('falls back to raw eventType for unknown Hikvision event', async () => {
      service.ingestHikvision({ eventType: 'UnknownEvent' }, 'device-1', 'tenant-1');
      service.stop();
      await vi.advanceTimersByTimeAsync(0);

      const insertedEvents = mockInsert.mock.calls[0][0];
      expect(insertedEvents[0].event_type).toBe('UnknownEvent');
      expect(insertedEvents[0].severity).toBe('info');
    });
  });

  describe('Dahua event normalization', () => {
    const testCases = [
      { Code: 'VideoMotion', expectedType: 'motion_detection', expectedSeverity: 'low' },
      { Code: 'CrossLineDetection', expectedType: 'line_crossing', expectedSeverity: 'medium' },
      { Code: 'CrossRegionDetection', expectedType: 'intrusion', expectedSeverity: 'high' },
      { Code: 'FaceDetection', expectedType: 'face_detection', expectedSeverity: 'info' },
      { Code: 'TrafficJunction', expectedType: 'license_plate', expectedSeverity: 'info' },
      { Code: 'VideoBlind', expectedType: 'camera_tamper', expectedSeverity: 'high' },
      { Code: 'VideoLoss', expectedType: 'video_loss', expectedSeverity: 'critical' },
      { Code: 'AudioAnomaly', expectedType: 'audio_anomaly', expectedSeverity: 'medium' },
      { Code: 'SmartMotionHuman', expectedType: 'smart_motion_human', expectedSeverity: 'medium' },
      { Code: 'NetAbort', expectedType: 'network_disconnected', expectedSeverity: 'critical' },
    ];

    it.each(testCases)(
      'maps $Code → type: $expectedType, severity: $expectedSeverity',
      async ({ Code, expectedType, expectedSeverity }) => {
        service.ingestDahua({ Code, action: 'Start' }, 'device-2', 'tenant-1');
        service.stop();
        await vi.advanceTimersByTimeAsync(0);

        const insertedEvents = mockInsert.mock.calls[0][0];
        expect(insertedEvents[0].event_type).toBe(expectedType);
        expect(insertedEvents[0].severity).toBe(expectedSeverity);
      },
    );

    it('falls back to raw Code for unknown Dahua event', async () => {
      service.ingestDahua({ Code: 'CustomAlarm' }, 'device-2', 'tenant-1');
      service.stop();
      await vi.advanceTimersByTimeAsync(0);

      const insertedEvents = mockInsert.mock.calls[0][0];
      expect(insertedEvents[0].event_type).toBe('CustomAlarm');
      expect(insertedEvents[0].severity).toBe('info');
    });
  });

  describe('Generic event ingestion', () => {
    it('adds tenant_id to generic event', () => {
      service.ingestGeneric(
        {
          type: 'custom_event',
          severity: 'medium',
          source_device_id: 'dev-3',
          source_brand: 'generic',
          title: 'Custom Event',
          description: 'Test event',
          metadata: {},
        },
        'tenant-2',
      );

      expect(service.getBufferSize()).toBe(1);
    });
  });

  describe('Buffer management', () => {
    it('accumulates events in buffer', () => {
      service.ingestHikvision({ eventType: 'VMD' }, 'dev-1', 'tenant-1');
      service.ingestHikvision({ eventType: 'linedetection' }, 'dev-1', 'tenant-1');
      service.ingestDahua({ Code: 'VideoMotion' }, 'dev-2', 'tenant-1');

      expect(service.getBufferSize()).toBe(3);
    });

    it('flushes on interval', async () => {
      service.start(5000);
      service.ingestHikvision({ eventType: 'VMD' }, 'dev-1', 'tenant-1');

      expect(mockInsert).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockInsert).toHaveBeenCalledOnce();
      expect(service.getBufferSize()).toBe(0);
    });

    it('re-buffers events on flush error', async () => {
      mockInsert.mockResolvedValueOnce({ error: { message: 'DB error' } });

      service.ingestHikvision({ eventType: 'VMD' }, 'dev-1', 'tenant-1');
      service.stop();
      await vi.advanceTimersByTimeAsync(0);

      expect(service.getBufferSize()).toBe(1);
    });

    it('does not flush empty buffer', async () => {
      service.start(5000);
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('deduplicates events with same type+device within 1s', () => {
      service.ingestHikvision({ eventType: 'VMD' }, 'dev-1', 'tenant-1');
      service.ingestHikvision({ eventType: 'VMD' }, 'dev-1', 'tenant-1');
      service.ingestHikvision({ eventType: 'VMD' }, 'dev-1', 'tenant-1');

      // Only 1 event should be in buffer (rest deduplicated)
      expect(service.getBufferSize()).toBe(1);
    });

    it('does NOT deduplicate events from different devices', () => {
      service.ingestHikvision({ eventType: 'VMD' }, 'dev-1', 'tenant-1');
      service.ingestHikvision({ eventType: 'VMD' }, 'dev-2', 'tenant-1');

      expect(service.getBufferSize()).toBe(2);
    });

    it('reports stats', () => {
      service.ingestHikvision({ eventType: 'VMD' }, 'dev-1', 'tenant-1');
      const stats = service.getStats();
      expect(stats.bufferSize).toBe(1);
      expect(stats.flushRetryCount).toBe(0);
    });
  });
});
