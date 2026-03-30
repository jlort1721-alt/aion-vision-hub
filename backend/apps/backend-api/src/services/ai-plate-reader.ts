/**
 * AI Plate Reader Service — AI-powered license plate reading using GPT-4o Vision
 *
 * Captures snapshots from vehicular cameras via go2rtc and sends them to
 * OpenAI GPT-4o Vision API to read license plates. Used when cameras lack
 * built-in LPR (License Plate Recognition).
 *
 * Flow: captureFrame → extractPlateWithAI → lookupPlate → emit event
 */
import { createLogger } from '@aion/common-utils';
import { db } from '../db/client.js';
import { accessVehicles, accessPeople } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

const logger = createLogger({ name: 'ai-plate-reader' });

const GO2RTC_URL = process.env.GO2RTC_URL || 'http://localhost:1984';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const FRAME_CAPTURE_TIMEOUT_MS = 5_000;
const AI_REQUEST_TIMEOUT_MS = 15_000;

// ── Types ───────────────────────────────────────────────────────────────────

export interface PlateReadResult {
  plate: string | null;
  raw: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface VehicleLookupResult {
  found: boolean;
  vehicle?: {
    id: string;
    plate: string;
    brand: string | null;
    model: string | null;
    color: string | null;
    type: string;
  };
  person?: {
    id: string;
    fullName: string;
    unit: string | null;
    phone: string | null;
  };
  tenantId?: string;
}

export interface VehicularAccessResult {
  plate: string | null;
  eventType: string;
  plateFoundInDb: boolean;
  vehicle?: VehicleLookupResult['vehicle'];
  person?: VehicleLookupResult['person'];
  timestamp: string;
}

// ── Lazy event bus import ───────────────────────────────────────────────────
// The event bus may not exist yet; import it lazily and handle gracefully.

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

// ── Service ─────────────────────────────────────────────────────────────────

class AIPlateReaderService {

  /**
   * Capture a single JPEG frame from a go2rtc stream.
   */
  async captureFrame(streamKey: string): Promise<Buffer> {
    const url = `${GO2RTC_URL}/api/frame.jpeg?src=${encodeURIComponent(streamKey)}`;
    logger.debug({ streamKey, url }, 'Capturing frame from go2rtc');

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

      logger.debug({ streamKey, bytes: buffer.length }, 'Frame captured');
      return buffer;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Send a captured frame to OpenAI GPT-4o Vision API to extract a license plate.
   * Colombian plates follow formats: ABC-123 or ABC-12D.
   */
  async extractPlateWithAI(imageBuffer: Buffer): Promise<PlateReadResult> {
    if (!OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY not configured — cannot read plates with AI');
      return { plate: null, raw: 'NO_API_KEY', confidence: 'low' };
    }

    const base64Image = imageBuffer.toString('base64');
    const mimeType = 'image/jpeg';

    const payload = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system' as const,
          content:
            'You are a Colombian license plate reader. Extract the vehicle license plate number from this image. ' +
            'Colombian plates are format ABC-123 or ABC-12D. Return ONLY the plate number in format ABC123 ' +
            '(no dashes, uppercase). If no plate is visible, return NONE.',
        },
        {
          role: 'user' as const,
          content: [
            {
              type: 'image_url' as const,
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: 'high' as const,
              },
            },
          ],
        },
      ],
      max_tokens: 20,
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

      const rawResponse = data.choices?.[0]?.message?.content?.trim() ?? '';
      logger.debug({ rawResponse }, 'OpenAI plate extraction response');

      const plate = this.normalizePlateResponse(rawResponse);

      return {
        plate,
        raw: rawResponse,
        confidence: plate ? 'high' : 'low',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ error: message }, 'AI plate extraction failed');
      return { plate: null, raw: message, confidence: 'low' };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Normalize the AI response into a clean plate string or null.
   */
  private normalizePlateResponse(response: string): string | null {
    if (!response) return null;

    const cleaned = response
      .toUpperCase()
      .replace(/[\s\-_.,:;'"()[\]{}]/g, '')
      .trim();

    if (cleaned === 'NONE' || cleaned === 'N/A' || cleaned === 'NULL' || cleaned === 'NOPLATE') {
      return null;
    }

    // Colombian plate format: 3 letters + 3 digits, or 3 letters + 2 digits + 1 letter
    const plateMatch = cleaned.match(/([A-Z]{3}\d{3}|[A-Z]{3}\d{2}[A-Z])/);
    if (plateMatch) {
      return plateMatch[1];
    }

    // If the AI returned something that looks plate-like but doesn't match exactly,
    // still return the cleaned alphanumeric string (could be a foreign plate)
    const alphanumeric = cleaned.replace(/[^A-Z0-9]/g, '');
    if (alphanumeric.length >= 5 && alphanumeric.length <= 8) {
      return alphanumeric;
    }

    return null;
  }

  /**
   * Full plate reading flow: capture frame from camera, send to AI, return plate.
   */
  async readPlate(cameraStreamKey: string): Promise<string | null> {
    try {
      const frame = await this.captureFrame(cameraStreamKey);
      const result = await this.extractPlateWithAI(frame);

      if (result.plate) {
        logger.info({ streamKey: cameraStreamKey, plate: result.plate }, 'Plate read successfully');
      } else {
        logger.debug({ streamKey: cameraStreamKey, raw: result.raw }, 'No plate detected');
      }

      return result.plate;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ streamKey: cameraStreamKey, error: message }, 'Plate read failed');
      return null;
    }
  }

  /**
   * Look up a plate number in the access_vehicles table.
   * Returns matching vehicle, owner (person), and tenant information.
   */
  async lookupPlate(plate: string): Promise<VehicleLookupResult> {
    const normalized = plate.toUpperCase().replace(/[\s\-_.]/g, '');

    try {
      const results = await db
        .select({
          vehicle: accessVehicles,
          person: accessPeople,
        })
        .from(accessVehicles)
        .leftJoin(accessPeople, eq(accessVehicles.personId, accessPeople.id))
        .where(
          and(
            eq(accessVehicles.status, 'active'),
          ),
        );

      // Exact match on normalized plates
      const match = results.find((r) => {
        const dbPlate = r.vehicle.plate.toUpperCase().replace(/[\s\-_.]/g, '');
        return dbPlate === normalized;
      });

      if (!match) {
        return { found: false };
      }

      return {
        found: true,
        vehicle: {
          id: match.vehicle.id,
          plate: match.vehicle.plate,
          brand: match.vehicle.brand,
          model: match.vehicle.model,
          color: match.vehicle.color,
          type: match.vehicle.type,
        },
        person: match.person
          ? {
              id: match.person.id,
              fullName: match.person.fullName,
              unit: match.person.unit,
              phone: match.person.phone,
            }
          : undefined,
        tenantId: match.vehicle.tenantId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ plate: normalized, error: message }, 'Plate lookup failed');
      return { found: false };
    }
  }

  /**
   * Full vehicular access processing flow:
   * 1. Capture frame from camera
   * 2. Extract plate with AI
   * 3. Look up plate in DB
   * 4. Emit appropriate event
   */
  async processVehicularAccess(
    cameraStreamKey: string,
    siteId: string,
  ): Promise<VehicularAccessResult> {
    const timestamp = new Date().toISOString();
    const bus = await getEventBus();

    try {
      // Step 1: Capture frame
      const frame = await this.captureFrame(cameraStreamKey);

      // Step 2: Extract plate
      const plateResult = await this.extractPlateWithAI(frame);

      if (!plateResult.plate) {
        // No plate visible
        const result: VehicularAccessResult = {
          plate: null,
          eventType: 'access.vehicle.unreadable',
          plateFoundInDb: false,
          timestamp,
        };

        logger.info({ streamKey: cameraStreamKey, siteId }, 'Vehicle detected but plate unreadable');

        if (bus) {
          try {
            await bus.publish({
              type: 'access.vehicle.unreadable',
              source: 'ai-plate-reader',
              severity: 'info',
              site_id: siteId,
              data: {
                cameraStreamKey,
                siteId,
                timestamp,
                aiRaw: plateResult.raw,
              },
            });
          } catch {
            // event bus emission failure is non-critical
          }
        }

        return result;
      }

      // Step 3: Look up plate in DB
      const lookup = await this.lookupPlate(plateResult.plate);

      // Step 4: Emit event
      const result: VehicularAccessResult = {
        plate: plateResult.plate,
        eventType: 'access.vehicle.plate_read',
        plateFoundInDb: lookup.found,
        vehicle: lookup.vehicle,
        person: lookup.person,
        timestamp,
      };

      if (lookup.found) {
        logger.info(
          {
            streamKey: cameraStreamKey,
            siteId,
            plate: plateResult.plate,
            person: lookup.person?.fullName,
            vehicle: `${lookup.vehicle?.brand ?? ''} ${lookup.vehicle?.model ?? ''}`.trim(),
          },
          'Vehicle plate read — match found in DB',
        );
      } else {
        logger.warn(
          { streamKey: cameraStreamKey, siteId, plate: plateResult.plate },
          'Vehicle plate read — not found in DB',
        );
      }

      if (bus) {
        try {
          await bus.publish({
            type: 'access.vehicle.plate_read',
            source: 'ai-plate-reader',
            severity: lookup.found ? 'info' : 'warning',
            site_id: siteId,
            data: {
              cameraStreamKey,
              siteId,
              plate: plateResult.plate,
              plate_found_in_db: lookup.found,
              vehicle: lookup.vehicle ?? null,
              person: lookup.person ?? null,
              timestamp,
            },
          });
        } catch {
          // event bus emission failure is non-critical
        }
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        { streamKey: cameraStreamKey, siteId, error: message },
        'Vehicular access processing failed',
      );

      return {
        plate: null,
        eventType: 'access.vehicle.unreadable',
        plateFoundInDb: false,
        timestamp,
      };
    }
  }

  /**
   * Check whether the service is properly configured (has API key).
   */
  isConfigured(): boolean {
    return !!OPENAI_API_KEY;
  }

  /**
   * Return current service status for health checks.
   */
  getStatus(): Record<string, unknown> {
    return {
      configured: this.isConfigured(),
      provider: 'openai-gpt4o-vision',
      go2rtcUrl: GO2RTC_URL,
      message: this.isConfigured()
        ? 'AI plate reader active with OpenAI GPT-4o Vision'
        : 'Set OPENAI_API_KEY to enable AI plate reading',
    };
  }
}

export const aiPlateReader = new AIPlateReaderService();
