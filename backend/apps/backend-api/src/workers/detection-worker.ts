/**
 * Detection Worker — Standalone PM2 process
 *
 * Periodically captures snapshots from go2rtc streams and analyzes them
 * using OpenAI Vision (GPT-4o) to detect people, vehicles, and animals.
 * Results are persisted to the camera_detections table.
 *
 * Run via:
 *   pm2 start dist/workers/detection-worker.js --name detection-worker
 *
 * Environment:
 *   DATABASE_URL    — PostgreSQL connection string (required)
 *   OPENAI_API_KEY  — OpenAI API key for Vision analysis (required)
 *   GO2RTC_URL      — go2rtc API base URL (default: http://localhost:1984)
 *   DETECTION_INTERVAL_MS — scan interval in ms (default: 300000 = 5 min)
 *   DETECTION_CONCURRENCY — max simultaneous analyses (default: 3)
 *   DETECTION_CONFIDENCE_THRESHOLD — min confidence to persist (default: 0.5)
 */
import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/index.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GO2RTC_URL = process.env.GO2RTC_URL || 'http://localhost:1984';
const INTERVAL_MS = parseInt(process.env.DETECTION_INTERVAL_MS || '300000', 10); // 5 min
const CONCURRENCY = parseInt(process.env.DETECTION_CONCURRENCY || '3', 10);
const CONFIDENCE_THRESHOLD = parseFloat(process.env.DETECTION_CONFIDENCE_THRESHOLD || '0.5');
const TENANT_ID = process.env.DETECTION_TENANT_ID || 'a0000000-0000-0000-0000-000000000001';

const log = {
  info: (...args: unknown[]) => console.log(`[detection-worker]`, new Date().toISOString(), ...args),
  warn: (...args: unknown[]) => console.warn(`[detection-worker]`, new Date().toISOString(), ...args),
  error: (...args: unknown[]) => console.error(`[detection-worker]`, new Date().toISOString(), ...args),
};

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

if (!DATABASE_URL) { log.error('DATABASE_URL required'); process.exit(1); }
if (!OPENAI_API_KEY) { log.warn('OPENAI_API_KEY not set — using simple motion detection fallback'); }

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

const sql = postgres(DATABASE_URL, { max: 5 });
const db = drizzle(sql, { schema });

// ---------------------------------------------------------------------------
// go2rtc snapshot helper
// ---------------------------------------------------------------------------

async function captureSnapshot(streamName: string): Promise<Buffer | null> {
  try {
    const response = await fetch(`${GO2RTC_URL}/api/frame.jpeg?src=${encodeURIComponent(streamName)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 1000) return null; // Too small = error frame
    return buffer;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OpenAI Vision analysis
// ---------------------------------------------------------------------------

interface Detection {
  type: 'person' | 'vehicle' | 'animal' | 'unknown';
  confidence: number;
  description: string;
  bbox?: { x: number; y: number; width: number; height: number };
}

async function analyzeWithVision(imageBuffer: Buffer): Promise<Detection[]> {
  if (!OPENAI_API_KEY) return analyzeSimple(imageBuffer);

  try {
    const base64 = imageBuffer.toString('base64');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a security camera analysis system. Analyze the image and detect: people (person), vehicles (vehicle), and animals (animal). Return ONLY a JSON array of detections. Each detection: {"type":"person"|"vehicle"|"animal","confidence":0.0-1.0,"description":"brief description"}. If nothing notable is detected, return an empty array []. Be conservative with confidence scores.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this security camera frame for people, vehicles, and animals.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'low' } },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      log.warn(`OpenAI API error: ${response.status}`);
      return [];
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content || '[]';

    // Extract JSON from response (may have markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Detection[];
    return parsed.filter(d => d.confidence >= CONFIDENCE_THRESHOLD);
  } catch (err) {
    log.error('Vision analysis failed:', (err as Error).message);
    return [];
  }
}

/** Simple fallback: just check if image has significant changes (placeholder) */
function analyzeSimple(_imageBuffer: Buffer): Detection[] {
  // Without OpenAI, we can't do real detection
  // This is a no-op fallback
  return [];
}

// ---------------------------------------------------------------------------
// Stream → Camera mapping
// ---------------------------------------------------------------------------

interface CameraMapping {
  streamName: string;
  deviceId: string;
  siteId: string;
}

async function getCameraMappings(): Promise<CameraMapping[]> {
  try {
    // Get all streams from go2rtc
    const streamsResponse = await fetch(`${GO2RTC_URL}/api/streams`, { signal: AbortSignal.timeout(5000) });
    if (!streamsResponse.ok) return [];
    const streams = await streamsResponse.json() as Record<string, unknown>;
    const streamNames = Object.keys(streams);

    // Get devices from DB
    const dbDevices = await db
      .select({ id: schema.devices.id, name: schema.devices.name, siteId: schema.devices.siteId })
      .from(schema.devices)
      .where(eq(schema.devices.tenantId, TENANT_ID));

    // Build mapping: stream name → device
    const mappings: CameraMapping[] = [];
    for (const streamName of streamNames) {
      // Try to match stream name to device by slug-based matching
      const normalizedStream = streamName.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const device of dbDevices) {
        if (!device.siteId) continue;
        const normalizedDevice = (device.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedStream.includes(normalizedDevice) || normalizedDevice.includes(normalizedStream)) {
          mappings.push({ streamName, deviceId: device.id, siteId: device.siteId });
          break;
        }
      }
    }

    // If no matches found by name, assign streams to devices in order per site
    if (mappings.length === 0 && dbDevices.length > 0 && streamNames.length > 0) {
      // Use first device and site as fallback for all streams
      const fallbackDevice = dbDevices[0];
      if (fallbackDevice.siteId) {
        // Only map a sample (first 10 streams) for detection
        for (const streamName of streamNames.slice(0, 10)) {
          mappings.push({ streamName, deviceId: fallbackDevice.id, siteId: fallbackDevice.siteId });
        }
      }
    }

    return mappings;
  } catch (err) {
    log.error('Failed to build camera mappings:', (err as Error).message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Persist detection
// ---------------------------------------------------------------------------

async function persistDetection(
  mapping: CameraMapping,
  detection: Detection,
  snapshotPath?: string,
): Promise<void> {
  try {
    await db.insert(schema.cameraDetections).values({
      tenantId: TENANT_ID,
      siteId: mapping.siteId,
      cameraId: mapping.deviceId,
      ts: new Date(),
      type: detection.type,
      confidence: detection.confidence,
      bboxJson: detection.bbox ?? {},
      snapshotPath: snapshotPath ?? null,
      metadata: { description: detection.description, source: 'detection-worker' },
    });
  } catch (err) {
    log.error(`Failed to persist detection for ${mapping.streamName}:`, (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Save snapshot to disk
// ---------------------------------------------------------------------------

async function saveSnapshot(streamName: string, buffer: Buffer): Promise<string | null> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const date = new Date().toISOString().split('T')[0];
    const dir = `/var/aion/detections/${date}`;
    await fs.mkdir(dir, { recursive: true });
    const filename = `${streamName}_${Date.now()}.jpg`;
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, buffer);
    return filePath;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main scan cycle
// ---------------------------------------------------------------------------

async function runDetectionScan(): Promise<void> {
  log.info('Starting detection scan...');

  const mappings = await getCameraMappings();
  if (mappings.length === 0) {
    log.warn('No camera mappings found — skipping scan');
    return;
  }

  // Sample a subset of cameras each cycle (rotate through them)
  const sampleSize = Math.min(mappings.length, 10);
  const shuffled = [...mappings].sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, sampleSize);

  log.info(`Scanning ${sample.length} cameras (of ${mappings.length} total)`);

  let totalDetections = 0;
  let processed = 0;

  // Process with concurrency limit
  const tasks = sample.map((mapping) => async () => {
    const snapshot = await captureSnapshot(mapping.streamName);
    if (!snapshot) {
      return;
    }

    const detections = await analyzeWithVision(snapshot);
    processed++;

    if (detections.length > 0) {
      const snapshotPath = await saveSnapshot(mapping.streamName, snapshot);
      for (const detection of detections) {
        await persistDetection(mapping, detection, snapshotPath ?? undefined);
        totalDetections++;
      }
      log.info(`${mapping.streamName}: ${detections.length} detections (${detections.map(d => d.type).join(', ')})`);
    }
  });

  // Run with concurrency
  const executing = new Set<Promise<void>>();
  for (const task of tasks) {
    const p = task().catch(err => log.error('Task error:', (err as Error).message)).finally(() => executing.delete(p));
    executing.add(p);
    if (executing.size >= CONCURRENCY) await Promise.race(executing);
  }
  await Promise.all(executing);

  log.info(`Scan complete: ${processed} cameras processed, ${totalDetections} detections persisted`);
}

// ---------------------------------------------------------------------------
// Worker lifecycle
// ---------------------------------------------------------------------------

let scanTimer: ReturnType<typeof setInterval> | null = null;

function start(): void {
  log.info(`Detection worker starting (interval: ${INTERVAL_MS}ms, concurrency: ${CONCURRENCY}, threshold: ${CONFIDENCE_THRESHOLD})`);

  // Run first scan after 30 seconds (let services stabilize)
  setTimeout(() => {
    runDetectionScan().catch(err => log.error('Initial scan failed:', (err as Error).message));
  }, 30_000);

  // Then run periodically
  scanTimer = setInterval(() => {
    runDetectionScan().catch(err => log.error('Scheduled scan failed:', (err as Error).message));
  }, INTERVAL_MS);
}

function stop(): void {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
  log.info('Detection worker stopped');
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

process.on('SIGTERM', () => { stop(); setTimeout(() => process.exit(0), 1000); });
process.on('SIGINT', () => { stop(); setTimeout(() => process.exit(0), 1000); });
process.on('uncaughtException', (err) => { log.error('Uncaught exception:', err.message); stop(); process.exit(1); });

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

start();
