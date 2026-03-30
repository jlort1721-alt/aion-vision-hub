/**
 * Pedestrian Detector Service — Person detection at pedestrian access points
 *
 * Periodically captures frames from pedestrian entrance cameras via go2rtc
 * and sends them to OpenAI GPT-4o Vision to detect people standing at or
 * approaching the entrance. Emits events for intercom/access workflows.
 *
 * Default interval: every 30 seconds.
 * Cooldown: 60 seconds per camera to avoid re-detecting the same person.
 */
import { createLogger } from '@aion/common-utils';
import { db } from '../db/client.js';
import { sql } from 'drizzle-orm';

const logger = createLogger({ name: 'pedestrian-detector' });

const GO2RTC_URL = process.env.GO2RTC_URL || 'http://localhost:1984';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_INTERVAL_MS = 30_000; // 30 seconds
const COOLDOWN_MS = 60_000; // 60 seconds per camera
const FRAME_CAPTURE_TIMEOUT_MS = 5_000;
const AI_REQUEST_TIMEOUT_MS = 15_000;

// ── Types ───────────────────────────────────────────────────────────────────

export interface PersonDetectionResult {
  cameraStreamKey: string;
  siteId: string;
  personDetected: boolean;
  cooldownActive: boolean;
  eventEmitted: boolean;
  timestamp: string;
}

interface CameraRow {
  id: string;
  stream_key: string;
  site_id: string;
  name: string;
}

// ── Lazy event bus import ───────────────────────────────────────────────────

type EventBusLike = {
  publish: (input: {
    type: string;
    source: string;
    severity: 'info' | 'warning' | 'critical' | 'emergency';
    data: Record<string, unknown>;
    site_id?: string;
    device_id?: string;
  }) => Promise<unknown>;
};

let eventBus: EventBusLike | null = null;

async function getEventBus(): Promise<EventBusLike | null> {
  if (eventBus) return eventBus;
  try {
    const mod = await import('./event-bus.js');
    eventBus = mod.eventBus ?? null;
  } catch {
    // event-bus module not available — events will only be logged
    eventBus = null;
  }
  return eventBus;
}

// ── Pedestrian Detector Class ───────────────────────────────────────────────

class PedestrianDetectorService {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;

  /**
   * Per-camera cooldown tracker.
   * Maps stream_key → timestamp of last detection.
   */
  private lastDetection = new Map<string, number>();

  /**
   * Start periodic pedestrian detection for all pedestrian cameras.
   * Default interval: 30 000 ms (30 seconds).
   */
  startDetection(intervalMs?: number): void {
    if (this.running) {
      logger.warn('Pedestrian detection is already running');
      return;
    }

    if (!OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY not configured — pedestrian detection disabled');
      return;
    }

    const interval = intervalMs ?? DEFAULT_INTERVAL_MS;
    this.running = true;

    logger.info({ intervalMs: interval }, 'Starting pedestrian detection service');

    // Run immediately on start, then at interval
    this.runDetectionCycle().catch((err) => {
      logger.error({ err }, 'Initial pedestrian detection cycle failed');
    });

    this.intervalHandle = setInterval(() => {
      this.runDetectionCycle().catch((err) => {
        logger.error({ err }, 'Pedestrian detection cycle failed');
      });
    }, interval);
  }

  /**
   * Stop periodic pedestrian detection.
   */
  stopDetection(): void {
    if (!this.running) {
      logger.debug('Pedestrian detection is not running');
      return;
    }

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    this.running = false;
    logger.info('Pedestrian detection service stopped');
  }

  /**
   * Check a single pedestrian camera for a person at the entrance.
   *
   * Respects the per-camera cooldown: if a person was detected on this
   * camera within the last 60 seconds, the check is skipped to avoid
   * re-detecting the same individual.
   */
  async checkForPerson(cameraStreamKey: string, siteId: string): Promise<PersonDetectionResult> {
    const timestamp = new Date().toISOString();
    const now = Date.now();

    // Check cooldown
    const lastDetectedAt = this.lastDetection.get(cameraStreamKey);
    if (lastDetectedAt && (now - lastDetectedAt) < COOLDOWN_MS) {
      const remainingMs = COOLDOWN_MS - (now - lastDetectedAt);
      logger.debug(
        { cameraStreamKey, remainingMs },
        'Camera in cooldown — skipping detection',
      );
      return {
        cameraStreamKey,
        siteId,
        personDetected: false,
        cooldownActive: true,
        eventEmitted: false,
        timestamp,
      };
    }

    try {
      // Step 1: Capture frame
      const frame = await this.captureFrame(cameraStreamKey);

      // Step 2: Detect person via AI
      const personDetected = await this.analyzeForPerson(frame);

      let eventEmitted = false;

      if (personDetected) {
        // Set cooldown for this camera
        this.lastDetection.set(cameraStreamKey, now);

        logger.info(
          { cameraStreamKey, siteId },
          'Person detected at pedestrian entrance',
        );

        // Emit event
        const bus = await getEventBus();
        if (bus) {
          try {
            await bus.publish({
              type: 'access.pedestrian.detected',
              source: 'pedestrian-detector',
              severity: 'info',
              site_id: siteId,
              data: {
                cameraStreamKey,
                siteId,
                timestamp,
              },
            });
            eventEmitted = true;
          } catch {
            // event bus emission failure is non-critical
            logger.debug('Failed to emit pedestrian detection event');
          }
        }
      } else {
        logger.debug({ cameraStreamKey }, 'No person detected at entrance');
      }

      return {
        cameraStreamKey,
        siteId,
        personDetected,
        cooldownActive: false,
        eventEmitted,
        timestamp,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ cameraStreamKey, siteId, error: message }, 'Person detection check failed');

      return {
        cameraStreamKey,
        siteId,
        personDetected: false,
        cooldownActive: false,
        eventEmitted: false,
        timestamp,
      };
    }
  }

  /**
   * Query the cameras table for pedestrian entrance cameras.
   * Matches cameras whose name contains 'peatonal' or 'entrance'.
   */
  async getPedestrianCameras(): Promise<CameraRow[]> {
    try {
      const rows = await db.execute(sql`
        SELECT id, stream_key, site_id, name
        FROM cameras
        WHERE name ILIKE '%peatonal%'
           OR name ILIKE '%entrance%'
      `);

      const cameras = (rows as unknown as CameraRow[]);
      logger.debug({ count: cameras.length }, 'Fetched pedestrian cameras');
      return cameras;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ error: message }, 'Failed to query pedestrian cameras');
      return [];
    }
  }

  /**
   * Check whether the service is properly configured.
   */
  isConfigured(): boolean {
    return !!OPENAI_API_KEY;
  }

  /**
   * Whether the detection loop is currently active.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Clear the per-camera cooldown state.
   */
  clearCooldowns(): void {
    const count = this.lastDetection.size;
    this.lastDetection.clear();
    logger.info({ cleared: count }, 'Pedestrian detection cooldowns cleared');
  }

  /**
   * Return current service status for health checks.
   */
  getStatus(): Record<string, unknown> {
    return {
      configured: this.isConfigured(),
      running: this.running,
      provider: 'openai-gpt4o-vision',
      go2rtcUrl: GO2RTC_URL,
      defaultIntervalMs: DEFAULT_INTERVAL_MS,
      cooldownMs: COOLDOWN_MS,
      activeCooldowns: this.lastDetection.size,
      message: this.isConfigured()
        ? this.running
          ? 'Pedestrian detector active and running'
          : 'Pedestrian detector configured but not started'
        : 'Set OPENAI_API_KEY to enable pedestrian detection',
    };
  }

  // ── Private: Detection cycle ──────────────────────────────────────────────

  private async runDetectionCycle(): Promise<void> {
    const cameras = await this.getPedestrianCameras();

    if (cameras.length === 0) {
      logger.debug('No pedestrian cameras found — skipping detection cycle');
      return;
    }

    logger.debug({ cameraCount: cameras.length }, 'Running pedestrian detection cycle');

    const results: PersonDetectionResult[] = [];

    for (const camera of cameras) {
      try {
        const result = await this.checkForPerson(camera.stream_key, camera.site_id);
        results.push(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(
          { cameraId: camera.id, streamKey: camera.stream_key, error: message },
          'Person detection failed for camera',
        );
      }
    }

    const detectedCount = results.filter((r) => r.personDetected).length;
    const cooldownCount = results.filter((r) => r.cooldownActive).length;

    logger.info(
      { total: results.length, detected: detectedCount, cooldown: cooldownCount },
      'Pedestrian detection cycle complete',
    );

    // Prune expired cooldowns to prevent unbounded map growth
    this.pruneCooldowns();
  }

  // ── Private: Frame capture ────────────────────────────────────────────────

  private async captureFrame(streamKey: string): Promise<Buffer> {
    const url = `${GO2RTC_URL}/api/frame.jpeg?src=${encodeURIComponent(streamKey)}`;
    logger.debug({ streamKey, url }, 'Capturing frame for person detection');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FRAME_CAPTURE_TIMEOUT_MS);

    try {
      const resp = await fetch(url, { signal: controller.signal });

      if (!resp.ok) {
        throw new Error(`go2rtc frame capture failed: ${resp.status} ${resp.statusText}`);
      }

      const arrayBuffer = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length < 1000) {
        throw new Error(`Frame too small (${buffer.length} bytes) — camera may be offline`);
      }

      logger.debug({ streamKey, bytes: buffer.length }, 'Frame captured for person detection');
      return buffer;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Private: AI person analysis ───────────────────────────────────────────

  private async analyzeForPerson(imageBuffer: Buffer): Promise<boolean> {
    const base64Image = imageBuffer.toString('base64');

    const payload = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system' as const,
          content:
            'Analyze this security camera image of a pedestrian entrance. ' +
            'Is there a person standing at or approaching the entrance/door? ' +
            'Respond with ONLY one word: YES or NO',
        },
        {
          role: 'user' as const,
          content: [
            {
              type: 'image_url' as const,
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: 'low' as const,
              },
            },
          ],
        },
      ],
      max_tokens: 10,
      temperature: 0,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

    try {
      const resp = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => 'unknown');
        throw new Error(`OpenAI API error: ${resp.status} — ${errBody}`);
      }

      const data = await resp.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const rawResponse = data.choices?.[0]?.message?.content?.trim().toUpperCase() ?? '';
      logger.debug({ rawResponse }, 'Person detection AI response');

      return rawResponse.includes('YES');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ error: message }, 'Person detection AI analysis failed');
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Private: Cooldown maintenance ─────────────────────────────────────────

  /**
   * Remove expired cooldown entries to prevent the map from growing indefinitely.
   */
  private pruneCooldowns(): void {
    const now = Date.now();
    let pruned = 0;

    for (const [key, lastDetected] of this.lastDetection) {
      if ((now - lastDetected) >= COOLDOWN_MS) {
        this.lastDetection.delete(key);
        pruned++;
      }
    }

    if (pruned > 0) {
      logger.debug({ pruned, remaining: this.lastDetection.size }, 'Pruned expired cooldowns');
    }
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const pedestrianDetector = new PedestrianDetectorService();
