#!/usr/bin/env tsx
/**
 * AION Vision Hub — Dahua Camera Seed Script
 *
 * Populates the `cameras` table with all 92 Dahua XVR channels (12 XVRs).
 * Links each camera to its correct site via the `sites` table.
 * Idempotent: skips cameras that already exist (by stream_key).
 *
 * Usage:
 *   cd backend && npx tsx ../scripts/seed-dahua-cameras.ts
 *
 * Prerequisites: DATABASE_URL in .env or environment
 */
import "dotenv/config";
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("ERROR: DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(DB_URL, { max: 5, idle_timeout: 30 });

// ══════════════════════════════════════════════════════════════
// DAHUA XVR DEVICE DEFINITIONS
// These match the devices in imou-stream-manager.ts and the known serials
// ══════════════════════════════════════════════════════════════

interface DahuaXVR {
  serial: string;
  name: string; // go2rtc stream prefix: da-{name}-ch{N}
  siteName: string; // Match against sites.name in DB (case-insensitive LIKE)
  user: string;
  password: string;
  channels: number;
}

const DAHUA_XVRS: DahuaXVR[] = [
  {
    serial: "AL02505PAJD40E7",
    name: "alborada",
    siteName: "Alborada",
    user: "admin",
    password: "Clave.seg2023",
    channels: 8,
  },
  {
    serial: "AK01E46PAZ0BA9C",
    name: "brescia",
    siteName: "Brescia",
    user: "admin",
    password: "Clave.seg2023",
    channels: 8,
  },
  {
    serial: "AL02505PAJDC6A4",
    name: "pbonito",
    siteName: "Patio Bonito",
    user: "admin",
    password: "Clave.seg2023",
    channels: 8,
  },
  {
    serial: "BB01B89PAJ5DDCD",
    name: "terrabamba",
    siteName: "Terrabamba",
    user: "admin",
    password: "Clave.seg2023",
    channels: 8,
  },
  {
    serial: "AJ00421PAZF2E60",
    name: "danubios",
    siteName: "Danubios",
    user: "admin",
    password: "Clave.seg2023",
    channels: 8,
  },
  {
    serial: "AH0306CPAZ5EA1A",
    name: "danubios2",
    siteName: "Danubios",
    user: "CLAVE",
    password: "Clave.seg2023",
    channels: 8,
  },
  {
    serial: "AL02505PAJ638AA",
    name: "terrazzino",
    siteName: "Terrazzino",
    user: "admin",
    password: "Clave.seg2023",
    channels: 8,
  },
  {
    serial: "AH0306CPAZ5E9FA",
    name: "terrazzino2",
    siteName: "Terrazzino",
    user: "admin",
    password: "Clave.seg2023",
    channels: 8,
  },
  {
    serial: "AH1020EPAZ39E67",
    name: "quintas",
    siteName: "Quintas",
    user: "admin",
    password: "Clave.seg2023",
    channels: 8,
  },
  {
    serial: "AB081E4PAZD6D5B",
    name: "santana",
    siteName: "Santana",
    user: "admin",
    password: "Clave.seg2023",
    channels: 8,
  },
  {
    serial: "AE01C60PAZA4D94",
    name: "hospital",
    siteName: "Hospital",
    user: "admin",
    password: "Clave.seg2023",
    channels: 8,
  },
  {
    serial: "9B02D09PAZ4C0D2",
    name: "factory",
    siteName: "Factory",
    user: "admin",
    password: "Clave.seg2023",
    channels: 4,
  },
];

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  AION — Dahua Camera Seed (92 channels)         ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // 1. Get the tenant ID (single-tenant deployment)
  const tenants = await sql`SELECT id FROM tenants ORDER BY created_at LIMIT 1`;
  if (tenants.length === 0) {
    console.error("ERROR: No tenants found in database");
    await sql.end();
    process.exit(1);
  }
  const tenantId = tenants[0].id;
  console.log(`Tenant: ${tenantId}\n`);

  // 2. Load all sites to match by name
  const sites =
    await sql`SELECT id, name FROM sites WHERE tenant_id = ${tenantId}`;
  console.log(`Found ${sites.length} sites in database.\n`);

  // Build a lookup: lowercase site name → site_id
  const siteLookup = new Map<string, string>();
  for (const site of sites) {
    siteLookup.set(String(site.name).toLowerCase(), site.id);
  }

  // 3. Load existing cameras to avoid duplicates
  const existingCams =
    await sql`SELECT stream_key FROM cameras WHERE tenant_id = ${tenantId} AND brand = 'dahua'`;
  const existingKeys = new Set(existingCams.map((c) => c.stream_key));
  console.log(`Existing Dahua cameras in DB: ${existingKeys.size}\n`);

  // 4. Also try to find device_id for each XVR from the devices table
  const devices = await sql`
    SELECT id, serial_number, name FROM devices
    WHERE tenant_id = ${tenantId} AND brand ILIKE '%dahua%'
  `;
  const deviceBySerial = new Map<string, string>();
  for (const d of devices) {
    if (d.serial_number) deviceBySerial.set(d.serial_number, d.id);
  }

  // 5. Insert cameras
  let created = 0;
  let skipped = 0;
  let siteMissing = 0;

  for (const xvr of DAHUA_XVRS) {
    // Find site_id by partial match
    let siteId: string | null = null;
    for (const [name, id] of siteLookup) {
      if (
        name.includes(xvr.siteName.toLowerCase()) ||
        xvr.siteName.toLowerCase().includes(name)
      ) {
        siteId = id;
        break;
      }
    }

    if (!siteId) {
      console.warn(
        `  ⚠ Site "${xvr.siteName}" not found in DB — cameras will have NULL site_id`,
      );
      siteMissing++;
    }

    const deviceId = deviceBySerial.get(xvr.serial) ?? null;

    for (let ch = 1; ch <= xvr.channels; ch++) {
      const streamKey = `da-${xvr.name}-ch${ch}`;
      const cameraName = `${xvr.siteName} - XVR Ch${ch}`;

      if (existingKeys.has(streamKey)) {
        skipped++;
        continue;
      }

      await sql`
        INSERT INTO cameras (id, tenant_id, device_id, site_id, name, channel_number, stream_key, brand, is_lpr, is_ptz, status, created_at, updated_at)
        VALUES (
          gen_random_uuid(),
          ${tenantId},
          ${deviceId},
          ${siteId},
          ${cameraName},
          ${ch},
          ${streamKey},
          'dahua',
          false,
          false,
          'unknown',
          NOW(),
          NOW()
        )
      `;
      created++;
    }

    const marker = siteId ? "✓" : "⚠";
    console.log(
      `  ${marker} ${xvr.siteName} (${xvr.name}) — ${xvr.channels} channels ${deviceId ? "→ device linked" : ""}`,
    );
  }

  console.log("\n══════════════════════════════════════════════════");
  console.log(`  Created: ${created} cameras`);
  console.log(`  Skipped: ${skipped} (already exist)`);
  console.log(`  Sites missing: ${siteMissing}`);
  console.log(`  Total Dahua cameras in DB: ${existingKeys.size + created}`);
  console.log("══════════════════════════════════════════════════\n");

  await sql.end();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
