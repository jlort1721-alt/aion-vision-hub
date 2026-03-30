/**
 * Door Validator Service — Automatic vehicular door state validation
 *
 * Periodically captures frames from vehicular cameras via go2rtc and
 * sends them to OpenAI GPT-4o Vision to determine if doors/gates are
 * open or closed. Emits alerts when a gate is held open without a
 * vehicle present (potential security risk).
 *
 * Default interval: every 2 minutes (120 000 ms).
 */
import { createLogger } from '@aion/common-utils';
import { db } from '../db/client.js';
import { sql } from 'drizzle-orm';

const logger = createLogger({ name: 'door-validator' });

const GO2RTC_URL = process.env.GO2RTC_URL || 'http://localhost:1984';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_INTERVAL_MS = 120_000; // 2 minutes
const FRAME_CAPTURE_TIMEOUT_MS = 5_000;
const AI_REQUEST_TIMEOUT_MS = 15_000;

// ── Types ───────────────────────────────────────────────────────────────────

export type DoorState = 'OPEN' | 'CLOSED' | 'UNKNOWN';

export interface DoorCheckResult {
  cameraStreamKey: string;
  siteId: string;
  doorState: DoorState;
  vehiclePresent: boolean;
  alertEmitted: boolean;
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

// ── Door Validator Class ────────────────────────────────────────────────────

class DoorValidatorService {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;

  /**
   * Start periodic door validation for all vehicular cameras.
   * Default interval: 120 000 ms (2 minutes).
   */
  startValidation(intervalMs?: number): void {
    if (this.running) {
      logger.warn('Door validation is already running');
      return;
    }

    if (!OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY not configured — door validation disabled');
      return;
    }

    const interval = intervalMs ?? DEFAULT_INTERVAL_MS;
    this.running = true;

    logger.info({ intervalMs: interval }, 'Starting door validation service');

    // Run immediately on start, then at interval
    this.runValidationCycle().catch((err) => {
      logger.error({ err }, 'Initial door validation cycle failed');
    });

    this.intervalHandle = setInterval(() => {
      this.runValidationCycle().catch((err) => {
        logger.error({ err }, 'Door validation cycle failed');
      });
    }, interval);
  }

  /**
   * Stop periodic door validation.
   */
  stopValidation(): void {
    if (!this.running) {
      logger.debug('Door validation is not running');
      return;
    }

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    this.running = false;
    logger.info('Door validation service stopped');
  }

  /**
   * Check the state of a single vehicular door/gate.
   *
   * Captures a frame from the camera, sends it to OpenAI Vision, and
   * determines whether the door is open or closed and whether a vehicle
   * is present.
   */
  async checkDoor(cameraStreamKey: string, siteId: string): Promise<DoorCheckResult> {
    const timestamp = new Date().toISOString();

    try {
      // Step 1: Capture frame
      const frame = await this.captureFrame(cameraStreamKey);

      // Step 2: Determine door state
      const doorState = await this.analyzeDoorState(frame);

      // Step 3: If open, check for vehicle
      let vehiclePresent = false;
      if (doorState === 'OPEN') {
        vehiclePresent = await this.detectVehicle(frame);
      }

      // Step 4: Determine if we should emit an alert
      let alertEmitted = false;

      if (doorState === 'OPEN' && !vehiclePresent) {
        // Door is open with no vehicle — potential security issue
        logger.warn(
          { cameraStreamKey, siteId },
          'Vehicular door held open with no vehicle detected',
        );

        const bus = await getEventBus();
        if (bus) {
          try {
            await bus.publish({
              type: 'access.door.held_open',
              source: 'door-validator',
              severity: 'warning',
              site_id: siteId,
              data: {
                cameraStreamKey,
                siteId,
                doorState,
                vehiclePresent: false,
                timestamp,
              },
            });
            alertEmitted = true;
          } catch {
            // event bus emission failure is non-critical
            logger.debug('Failed to emit door held_open event');
          }
        }
      } else if (doorState === 'OPEN' && vehiclePresent) {
        // Door open with vehicle — normal operation (entering/exiting)
        logger.debug(
          { cameraStreamKey, siteId },
          'Vehicular door open — vehicle present (normal operation)',
        );
      } else if (doorState === 'CLOSED') {
        // Door closed — normal state
        logger.debug({ cameraStreamKey, siteId, doorState }, 'Door state normal');
      }

      return {
        cameraStreamKey,
        siteId,
        doorState,
        vehiclePresent,
        alertEmitted,
        timestamp,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ cameraStreamKey, siteId, error: message }, 'Door check failed');

      return {
        cameraStreamKey,
        siteId,
        doorState: 'UNKNOWN',
        vehiclePresent: false,
        alertEmitted: false,
        timestamp,
      };
    }
  }

  /**
   * Query the cameras table for vehicular-related cameras.
   * Matches cameras whose name contains 'vehicular' or that have is_lpr = true.
   */
  async getVehicularCameras(): Promise<CameraRow[]> {
    try {
      const rows = await db.execute(sql`
        SELECT id, stream_key, site_id, name
        FROM cameras
        WHERE name ILIKE '%vehicular%'
           OR is_lpr = true
      `);

      const cameras = (rows as unknown as CameraRow[]);
      logger.debug({ count: cameras.length }, 'Fetched vehicular cameras');
      return cameras;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ error: message }, 'Failed to query vehicular cameras');
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
   * Whether the validation loop is currently active.
   */
  isRunning(): boolean {
    return this.running;
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
      message: this.isConfigured()
        ? this.running
          ? 'Door validator active and running'
          : 'Door validator configured but not started'
        : 'Set OPENAI_API_KEY to enable door validation',
    };
  }

  // ── Private: Validation cycle ─────────────────────────────────────────────

  private async runValidationCycle(): Promise<void> {
    const cameras = await this.getVehicularCameras();

    if (cameras.length === 0) {
      logger.debug('No vehicular cameras found — skipping validation cycle');
      return;
    }

    logger.debug({ cameraCount: cameras.length }, 'Running door validation cycle');

    const results: DoorCheckResult[] = [];

    for (const camera of cameras) {
      try {
        const result = await this.checkDoor(camera.stream_key, camera.site_id);
        results.push(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(
          { cameraId: camera.id, streamKey: camera.stream_key, error: message },
          'Door check failed for camera',
        );
      }
    }

    const openCount = results.filter((r) => r.doorState === 'OPEN').length;
    const alertCount = results.filter((r) => r.alertEmitted).length;

    logger.info(
      { total: results.length, open: openCount, alerts: alertCount },
      'Door validation cycle complete',
    );
  }

  // ── Private: Frame capture ────────────────────────────────────────────────

  private async captureFrame(streamKey: string): Promise<Buffer> {
    const url = `${GO2RTC_URL}/api/frame.jpeg?src=${encodeURIComponent(streamKey)}`;
    logger.debug({ streamKey, url }, 'Capturing frame for door check');

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

      logger.debug({ streamKey, bytes: buffer.length }, 'Frame captured for door check');
      return buffer;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Private: AI door state analysis ───────────────────────────────────────

  private async analyzeDoorState(imageBuffer: Buffer): Promise<DoorState> {
    const base64Image = imageBuffer.toString('base64');

    const payload = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system' as const,
          content:
            'Analyze this security camera image. Is the vehicular gate/door in the image OPEN or CLOSED? ' +
            'Respond with ONLY one word: OPEN or CLOSED',
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
      logger.debug({ rawResponse }, 'Door state AI response');

      if (rawResponse.includes('OPEN')) return 'OPEN';
      if (rawResponse.includes('CLOSED')) return 'CLOSED';

      logger.warn({ rawResponse }, 'Ambiguous door state response from AI');
      return 'UNKNOWN';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ error: message }, 'Door state AI analysis failed');
      return 'UNKNOWN';
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Private: AI vehicle detection ─────────────────────────────────────────

  private async detectVehicle(imageBuffer: Buffer): Promise<boolean> {
    const base64Image = imageBuffer.toString('base64');

    const payload = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system' as const,
          content:
            'Analyze this security camera image of a vehicular gate/entrance. ' +
            'Is there a vehicle (car, truck, motorcycle, or any motor vehicle) currently in the gate area or actively passing through? ' +
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
      logger.debug({ rawResponse }, 'Vehicle detection AI response');

      return rawResponse.includes('YES');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ error: message }, 'Vehicle detection AI analysis failed');
      // Default to false (no vehicle) — this means we will emit alert on failure,
      // which is the safer option for security
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const doorValidator = new DoorValidatorService();
