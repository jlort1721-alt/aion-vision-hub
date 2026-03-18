/**
 * AION Vision Hub — Stream Registration Script
 * Registers RTSP stream entries for all NVR/XVR/DVR/Camera devices.
 * Idempotent: safe to run multiple times without duplicating data.
 *
 * Usage: cd backend/apps/backend-api && npx tsx ../../../scripts/register-streams.ts
 */
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Load .env from backend directory ──
const envPath = path.resolve(__dirname, '../backend/.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx);
    const val = trimmed.substring(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set. Check backend/.env');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 5, idle_timeout: 30 });
const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';

// ════════════════════════════════════════════════════════════
// STREAM URL TEMPLATES
// ════════════════════════════════════════════════════════════

/** Hikvision RTSP path templates */
const HIKVISION_MAIN = '/Streaming/Channels/{channel}01';
const HIKVISION_SUB  = '/Streaming/Channels/{channel}02';

/** Dahua RTSP path templates */
const DAHUA_MAIN = '/cam/realmonitor?channel={channel}&subtype=0';
const DAHUA_SUB  = '/cam/realmonitor?channel={channel}&subtype=1';

// ════════════════════════════════════════════════════════════
// BRAND DETECTION
// ════════════════════════════════════════════════════════════

type Brand = 'hikvision' | 'dahua';

interface DeviceRow {
  id: string;
  name: string;
  type: string;
  ip_address: string;
  rtsp_port: number | null;
  username: string | null;
  password: string | null;
  serial_number: string | null;
  cameras_count: number | null;
  brand: string | null;
}

function detectBrand(device: DeviceRow): Brand {
  const serial = (device.serial_number ?? '').toUpperCase();
  const brand = (device.brand ?? '').toLowerCase();

  // Dahua indicators
  if (device.type === 'xvr') return 'dahua';
  if (brand.includes('dahua')) return 'dahua';
  if (serial.startsWith('9B') || serial.startsWith('AK01') || serial.startsWith('AH03')) return 'dahua';

  // Default to Hikvision for NVR, DVR, and camera
  return 'hikvision';
}

function getUrlTemplates(brand: Brand): { main: string; sub: string } {
  if (brand === 'dahua') {
    return { main: DAHUA_MAIN, sub: DAHUA_SUB };
  }
  return { main: HIKVISION_MAIN, sub: HIKVISION_SUB };
}

// ════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  AION Vision Hub — Stream Registration          ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // 1. Fetch devices that need streams
  const devices = await sql<DeviceRow[]>`
    SELECT id, name, type, ip_address, rtsp_port, username, password,
           serial_number, cameras_count, brand
    FROM devices
    WHERE tenant_id = ${TENANT_ID}
      AND type IN ('nvr', 'xvr', 'dvr', 'camera')
      AND ip_address IS NOT NULL
    ORDER BY type, name
  `;

  console.log(`Found ${devices.length} devices with IP addresses.\n`);

  if (devices.length === 0) {
    console.log('No devices to process. Exiting.');
    await sql.end();
    return;
  }

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalDevices = 0;

  for (const device of devices) {
    totalDevices++;
    const brand = detectBrand(device);
    const templates = getUrlTemplates(brand);

    // Determine channel count
    const isMultiChannel = ['nvr', 'xvr', 'dvr'].includes(device.type);
    const channelCount = isMultiChannel ? (device.cameras_count ?? 1) : 1;

    console.log(`  [${device.type.toUpperCase()}] ${device.name} (${device.ip_address}) — ${brand}, ${channelCount} ch`);

    for (let ch = 1; ch <= channelCount; ch++) {
      const mainTemplate = templates.main.replace('{channel}', String(ch));
      const subTemplate = templates.sub.replace('{channel}', String(ch));

      for (const streamDef of [
        { type: 'main', urlTemplate: mainTemplate, resolution: '1920x1080', fps: 25 },
        { type: 'sub', urlTemplate: subTemplate, resolution: '704x576', fps: 15 },
      ] as const) {
        // Check if stream already exists (idempotent)
        const existing = await sql`
          SELECT id FROM streams
          WHERE device_id = ${device.id}
            AND channel = ${ch}
            AND type = ${streamDef.type}
          LIMIT 1
        `;

        if (existing.length > 0) {
          totalSkipped++;
          continue;
        }

        await sql`
          INSERT INTO streams (device_id, channel, type, codec, resolution, fps, url_template, protocol, is_active)
          VALUES (
            ${device.id},
            ${ch},
            ${streamDef.type},
            ${'H.264'},
            ${streamDef.resolution},
            ${streamDef.fps},
            ${streamDef.urlTemplate},
            ${'rtsp'},
            ${true}
          )
        `;
        totalCreated++;
      }
    }
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log(`  Devices processed : ${totalDevices}`);
  console.log(`  Streams created   : ${totalCreated}`);
  console.log(`  Streams skipped   : ${totalSkipped} (already exist)`);
  console.log('══════════════════════════════════════════════════\n');

  await sql.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  sql.end().finally(() => process.exit(1));
});
