import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';
import { createClient } from '@supabase/supabase-js';

interface NormalizedEvent {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  source_device_id: string;
  source_brand: string;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  tenant_id: string;
}

interface RawHikvisionEvent {
  eventType: string;
  channelID?: number;
  dateTime?: string;
  macAddress?: string;
  [key: string]: unknown;
}

interface RawDahuaEvent {
  Code: string;
  index?: number;
  action?: string;
  data?: Record<string, unknown>;
}

const HIK_TYPE_MAP: Record<string, string> = {
  VMD: 'motion_detection',
  linedetection: 'line_crossing',
  fielddetection: 'intrusion',
  facedetection: 'face_detection',
  ANPR: 'license_plate',
  videoloss: 'video_loss',
  shelteralarm: 'camera_tamper',
  audiomutation: 'audio_anomaly',
  scenechangedetection: 'scene_change',
  PIR: 'pir_alarm',
  storageDetection: 'storage_failure',
  diskfull: 'storage_full',
  nicbroken: 'network_disconnected',
  ipconflict: 'ip_conflict',
};

const HIK_SEVERITY_MAP: Record<string, NormalizedEvent['severity']> = {
  VMD: 'low',
  linedetection: 'medium',
  fielddetection: 'high',
  facedetection: 'info',
  ANPR: 'info',
  videoloss: 'critical',
  shelteralarm: 'high',
  audiomutation: 'medium',
  scenechangedetection: 'medium',
  PIR: 'medium',
  storageDetection: 'critical',
  diskfull: 'high',
  nicbroken: 'critical',
  ipconflict: 'high',
};

const DAHUA_TYPE_MAP: Record<string, string> = {
  VideoMotion: 'motion_detection',
  CrossLineDetection: 'line_crossing',
  CrossRegionDetection: 'intrusion',
  FaceDetection: 'face_detection',
  TrafficJunction: 'license_plate',
  VideoBlind: 'camera_tamper',
  VideoLoss: 'video_loss',
  AudioAnomaly: 'audio_anomaly',
  SmartMotionHuman: 'smart_motion_human',
  SmartMotionVehicle: 'smart_motion_vehicle',
  StorageNotExist: 'storage_failure',
  StorageLowSpace: 'storage_full',
  NetAbort: 'network_disconnected',
  IPConflict: 'ip_conflict',
};

const DAHUA_SEVERITY_MAP: Record<string, NormalizedEvent['severity']> = {
  VideoMotion: 'low',
  CrossLineDetection: 'medium',
  CrossRegionDetection: 'high',
  FaceDetection: 'info',
  TrafficJunction: 'info',
  VideoBlind: 'high',
  VideoLoss: 'critical',
  AudioAnomaly: 'medium',
  SmartMotionHuman: 'medium',
  SmartMotionVehicle: 'low',
  StorageNotExist: 'critical',
  StorageLowSpace: 'high',
  NetAbort: 'critical',
  IPConflict: 'high',
};

/**
 * EventIngestionService — normalizes and stores device events.
 *
 * Receives raw events from device adapters (Hikvision, Dahua, ONVIF),
 * normalizes them to a common format, buffers them, and flushes to Supabase
 * in batches for efficiency.
 *
 * Buffer management:
 *   - Flush every EVENT_FLUSH_INTERVAL_MS (default 5s)
 *   - Hard cap at EVENT_BUFFER_MAX_SIZE (default 500) — forces immediate flush
 *   - Deduplication window: events with same type+device within 1s are collapsed
 *   - Re-buffer on flush error (eventual consistency)
 */
export class EventIngestionService {
  private supabase;
  private buffer: NormalizedEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private dedupeWindow = new Map<string, number>(); // key → timestamp
  private flushRetryCount = 0;
  private readonly maxRetries = 3;

  constructor() {
    this.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY);
  }

  start(flushIntervalMs?: number): void {
    const interval = flushIntervalMs ?? config.EVENT_FLUSH_INTERVAL_MS;
    this.flushInterval = setInterval(() => this.flush(), interval);
    logger.info({ flushIntervalMs: interval, maxBufferSize: config.EVENT_BUFFER_MAX_SIZE }, 'EventIngestionService started');
  }

  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush(); // Final flush
  }

  ingestHikvision(raw: RawHikvisionEvent, deviceId: string, tenantId: string): void {
    const normalized: NormalizedEvent = {
      type: HIK_TYPE_MAP[raw.eventType] || raw.eventType,
      severity: HIK_SEVERITY_MAP[raw.eventType] || 'info',
      source_device_id: deviceId,
      source_brand: 'hikvision',
      title: `${HIK_TYPE_MAP[raw.eventType] || raw.eventType}`.replace(/_/g, ' '),
      description: `Hikvision event: ${raw.eventType} on channel ${raw.channelID || 1}`,
      metadata: { channelID: raw.channelID, dateTime: raw.dateTime, rawType: raw.eventType },
      tenant_id: tenantId,
    };
    this.pushEvent(normalized);
  }

  ingestDahua(raw: RawDahuaEvent, deviceId: string, tenantId: string): void {
    const normalized: NormalizedEvent = {
      type: DAHUA_TYPE_MAP[raw.Code] || raw.Code,
      severity: DAHUA_SEVERITY_MAP[raw.Code] || 'info',
      source_device_id: deviceId,
      source_brand: 'dahua',
      title: `${DAHUA_TYPE_MAP[raw.Code] || raw.Code}`.replace(/_/g, ' '),
      description: `Dahua event: ${raw.Code} (${raw.action || 'Pulse'})`,
      metadata: { channel: raw.index, action: raw.action, rawCode: raw.Code, ...raw.data },
      tenant_id: tenantId,
    };
    this.pushEvent(normalized);
  }

  ingestGeneric(event: Omit<NormalizedEvent, 'tenant_id'>, tenantId: string): void {
    this.pushEvent({ ...event, tenant_id: tenantId });
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  getStats(): { bufferSize: number; flushRetryCount: number } {
    return { bufferSize: this.buffer.length, flushRetryCount: this.flushRetryCount };
  }

  private pushEvent(event: NormalizedEvent): void {
    // Deduplication: same type+device+channel within 1 second
    const channel = (event.metadata as Record<string, unknown>)?.channelID ?? (event.metadata as Record<string, unknown>)?.channel ?? '*';
    const dedupeKey = `${event.source_device_id}:${event.type}:${channel}`;
    const now = Date.now();
    const lastSeen = this.dedupeWindow.get(dedupeKey);
    if (lastSeen && now - lastSeen < 1000) {
      logger.trace({ type: event.type, deviceId: event.source_device_id }, 'Event deduplicated');
      return;
    }
    this.dedupeWindow.set(dedupeKey, now);

    this.buffer.push(event);
    logger.debug({ deviceId: event.source_device_id, type: event.type }, 'Event ingested');

    // Hard cap — force immediate flush
    if (this.buffer.length >= config.EVENT_BUFFER_MAX_SIZE) {
      logger.info({ bufferSize: this.buffer.length }, 'Buffer full, forcing flush');
      this.flush();
    }

    // Periodically clean dedupe window
    if (this.dedupeWindow.size > 1000) {
      const cutoff = now - 2000;
      for (const [key, ts] of this.dedupeWindow) {
        if (ts < cutoff) this.dedupeWindow.delete(key);
      }
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = [...this.buffer];
    this.buffer = [];

    try {
      const { error } = await this.supabase.from('events').insert(
        events.map((e) => ({
          event_type: e.type,
          severity: e.severity,
          status: 'new',
          device_id: e.source_device_id,
          title: e.title,
          description: e.description,
          metadata: e.metadata,
          tenant_id: e.tenant_id,
        })),
      );

      if (error) {
        logger.error({ error, count: events.length }, 'Failed to flush events to database');
        this.reBuffer(events);
      } else {
        this.flushRetryCount = 0;
        logger.info({ count: events.length }, 'Events flushed to database');
      }
    } catch (err) {
      logger.error({ err, count: events.length }, 'Event flush error');
      this.reBuffer(events);
    }
  }

  private reBuffer(events: NormalizedEvent[]): void {
    this.flushRetryCount++;
    if (this.flushRetryCount > this.maxRetries) {
      logger.error(
        { droppedCount: events.length, retries: this.flushRetryCount },
        'Max flush retries exceeded, dropping events',
      );
      this.flushRetryCount = 0;
      return;
    }
    // Only re-buffer up to max size
    const space = config.EVENT_BUFFER_MAX_SIZE - this.buffer.length;
    if (space > 0) {
      this.buffer.unshift(...events.slice(0, space));
    }
  }
}
