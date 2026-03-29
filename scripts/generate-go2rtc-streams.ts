#!/usr/bin/env tsx
/**
 * go2rtc Stream Generator — Reads Hikvision devices from the database
 * and generates the `streams:` section for go2rtc.yaml
 *
 * Usage: npx tsx scripts/generate-go2rtc-streams.ts
 *
 * Prerequisites: DATABASE_URL must be set in environment or .env
 *
 * Output: Prints YAML streams config to stdout. Redirect to file:
 *   npx tsx scripts/generate-go2rtc-streams.ts > go2rtc-streams.yaml
 */
import 'dotenv/config';

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('ERROR: DATABASE_URL not set');
  process.exit(1);
}

interface DeviceRow {
  id: string;
  name: string;
  ip_address: string;
  port: number;
  username: string;
  password: string;
  brand: string;
  site_name: string;
  channels: number;
}

async function testISAPIConnection(ip: string, port: number, user: string, pass: string): Promise<{ online: boolean; channels: number }> {
  try {
    // Test with a simple GET to deviceInfo
    const url = `http://${ip}:${port}/ISAPI/System/deviceInfo`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/xml' },
    });
    clearTimeout(timeout);

    if (resp.status === 401) {
      // Device is reachable but needs auth — it's online
      // Try to get channel count
      try {
        const chUrl = `http://${ip}:${port}/ISAPI/System/Video/inputs/channels`;
        const chCtrl = new AbortController();
        const chTimeout = setTimeout(() => chCtrl.abort(), 5000);
        const chResp = await fetch(chUrl, { signal: chCtrl.signal });
        clearTimeout(chTimeout);
        const text = await chResp.text();
        const count = (text.match(/<VideoInputChannel>/g) || []).length;
        return { online: true, channels: count || 1 };
      } catch {
        return { online: true, channels: 1 };
      }
    }

    if (resp.ok) {
      return { online: true, channels: 1 };
    }

    return { online: false, channels: 0 };
  } catch {
    return { online: false, channels: 0 };
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

async function main() {
  // Use postgres.js to query the database
  const { default: postgres } = await import('postgres');
  const sql = postgres(DB_URL!);

  const devices = await sql<DeviceRow[]>`
    SELECT d.id, d.name, d.ip_address, d.port, d.username, d.password,
           COALESCE(d.brand, d.manufacturer, '') as brand,
           COALESCE(s.name, 'Unknown') as site_name,
           COALESCE((d.metadata->>'channels')::int, 1) as channels
    FROM devices d
    LEFT JOIN sites s ON d.site_id = s.id
    WHERE (d.brand ILIKE '%hikvision%' OR d.brand ILIKE '%hik%'
           OR d.manufacturer ILIKE '%hikvision%' OR d.type ILIKE '%dvr%'
           OR d.type ILIKE '%nvr%')
      AND d.ip_address IS NOT NULL AND d.ip_address != ''
    ORDER BY s.name, d.name
  `;

  console.log('# go2rtc streams — Auto-generated from AION database');
  console.log(`# Generated: ${new Date().toISOString()}`);
  console.log(`# Total devices found: ${devices.length}`);
  console.log('');
  console.log('streams:');

  let totalStreams = 0;
  let onlineDevices = 0;
  let currentSite = '';

  for (const dev of devices) {
    if (dev.site_name !== currentSite) {
      currentSite = dev.site_name;
      console.log(`\n  # === ${currentSite.toUpperCase()} ===`);
    }

    const ip = dev.ip_address;
    const port = dev.port || 8000;
    const user = dev.username || 'admin';
    const pass = dev.password || '';

    // Test connectivity
    const { online, channels: detectedChannels } = await testISAPIConnection(ip, port, user, pass);
    const channelCount = detectedChannels || dev.channels || 1;

    if (online) {
      onlineDevices++;
      const slug = slugify(dev.name);

      for (let ch = 1; ch <= channelCount; ch++) {
        const streamId = `${ch}02`; // substream
        const streamName = channelCount > 1 ? `${slug}_ch${ch}` : slug;
        console.log(`  ${streamName}: isapi://${user}:${pass}@${ip}:${port}/Streaming/Channels/${streamId}`);
        totalStreams++;
      }
    } else {
      console.log(`  # ${dev.name} (${ip}:${port}) — OFFLINE`);
    }
  }

  console.log('');
  console.log(`# Summary: ${onlineDevices}/${devices.length} devices online, ${totalStreams} streams generated`);

  await sql.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
