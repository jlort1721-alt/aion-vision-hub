#!/usr/bin/env tsx
/**
 * AION Vision Hub — Intercom & Phone Device Seed Script
 *
 * Populates the database with:
 * - 18 IP phones for security posts (ext 200-217, Fanvil X3SG)
 * - 18 intercoms/door phones (ext 300-317, Fanvil i30)
 * - 1 voip_config record for the tenant
 *
 * Idempotent: skips devices that already exist (by sip_uri).
 *
 * Usage:
 *   cd backend && npx tsx ../scripts/seed-intercom-devices.ts
 */
import "dotenv/config";
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("ERROR: DATABASE_URL not set");
  process.exit(1);
}

const sql = postgres(DB_URL, { max: 5, idle_timeout: 30 });

const SIP_SERVER = "18.230.40.6";
const SIP_PORT = 5060;

// ══════════════════════════════════════════════════════════════
// PUESTOS DE SEGURIDAD — Telefonos IP (ext 200-217)
// ══════════════════════════════════════════════════════════════

interface PostDevice {
  extension: number;
  siteName: string;
  deviceType: "phone" | "intercom";
  model: string;
  brand: string;
}

const PHONES: PostDevice[] = [
  {
    extension: 200,
    siteName: "San Nicolas",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 201,
    siteName: "Portalegre",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 202,
    siteName: "La Palencia",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 203,
    siteName: "Brescia",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 204,
    siteName: "Hospital San Jeronimo",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 205,
    siteName: "Danubios",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 206,
    siteName: "Terrabamba",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 207,
    siteName: "Santana",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 208,
    siteName: "Quintas",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 209,
    siteName: "Patio Bonito",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 210,
    siteName: "Terrazzino",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 211,
    siteName: "Alborada",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 212,
    siteName: "San Sebastian",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 213,
    siteName: "Altagracia",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 214,
    siteName: "Pisquines",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 215,
    siteName: "Torre Lucia",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 216,
    siteName: "Senderos",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
  {
    extension: 217,
    siteName: "Altos del Rosario",
    deviceType: "phone",
    model: "X3SG",
    brand: "Fanvil",
  },
];

// ══════════════════════════════════════════════════════════════
// INTERCOMUNICADORES / CITÓFONOS (ext 300-317)
// ══════════════════════════════════════════════════════════════

const INTERCOMS: PostDevice[] = [
  {
    extension: 300,
    siteName: "San Nicolas",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 301,
    siteName: "Portalegre",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 302,
    siteName: "La Palencia",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 303,
    siteName: "Brescia",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 304,
    siteName: "Hospital San Jeronimo",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 305,
    siteName: "Danubios",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 306,
    siteName: "Terrabamba",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 307,
    siteName: "Santana",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 308,
    siteName: "Quintas",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 309,
    siteName: "Patio Bonito",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 310,
    siteName: "Terrazzino",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 311,
    siteName: "Alborada",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 312,
    siteName: "San Sebastian",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 313,
    siteName: "Altagracia",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 314,
    siteName: "Pisquines",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 315,
    siteName: "Torre Lucia",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 316,
    siteName: "Senderos",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
  {
    extension: 317,
    siteName: "Altos del Rosario",
    deviceType: "intercom",
    model: "i30",
    brand: "Fanvil",
  },
];

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  AION — Intercom & Phone Device Seed            ║");
  console.log("║  36 devices + voip_config                       ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // 1. Get tenant ID
  const tenants = await sql`SELECT id FROM tenants ORDER BY created_at LIMIT 1`;
  if (tenants.length === 0) {
    console.error("ERROR: No tenants found");
    await sql.end();
    process.exit(1);
  }
  const tenantId = tenants[0].id;
  console.log(`Tenant: ${tenantId}\n`);

  // 2. Load sites for section matching
  const sites =
    await sql`SELECT id, name FROM sites WHERE tenant_id = ${tenantId}`;
  const siteLookup = new Map<string, string>();
  for (const site of sites) {
    siteLookup.set(String(site.name).toLowerCase(), site.id);
  }
  console.log(`Found ${sites.length} sites\n`);

  // 3. Load existing intercom devices to avoid duplicates
  const existingDevices =
    await sql`SELECT sip_uri FROM intercom_devices WHERE tenant_id = ${tenantId}`;
  const existingUris = new Set(existingDevices.map((d) => d.sip_uri));

  // 4. Seed intercom_devices table
  const allDevices = [...PHONES, ...INTERCOMS];
  let created = 0;
  let skipped = 0;

  for (const device of allDevices) {
    const sipUri = `sip:${device.extension}@${SIP_SERVER}`;

    if (existingUris.has(sipUri)) {
      skipped++;
      continue;
    }

    // Find site_id by partial match
    let sectionId: string | null = null;
    for (const [name, id] of siteLookup) {
      if (
        name.includes(device.siteName.toLowerCase()) ||
        device.siteName.toLowerCase().includes(name)
      ) {
        sectionId = id;
        break;
      }
    }

    const displayName =
      device.deviceType === "phone"
        ? `Telefono Puesto ${device.siteName}`
        : `Intercom ${device.siteName}`;

    await sql`
      INSERT INTO intercom_devices (id, tenant_id, section_id, name, brand, model, ip_address, sip_uri, status, config, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${tenantId},
        ${sectionId},
        ${displayName},
        ${device.brand},
        ${device.model},
        ${null},
        ${sipUri},
        'offline',
        ${JSON.stringify({
          extension: device.extension,
          deviceType: device.deviceType,
          sipServer: SIP_SERVER,
          sipPort: SIP_PORT,
          transport: "udp",
          codecs: ["G.711u", "G.711a", "G.722"],
          ...(device.deviceType === "intercom"
            ? {
                doorRelay: { enabled: true, duration: 5, type: "NO" },
                speedDial: { key1: "099", key2: "199" },
              }
            : {}),
        })}::jsonb,
        NOW(),
        NOW()
      )
    `;
    created++;

    const marker = sectionId ? "✓" : "⚠";
    const type = device.deviceType === "phone" ? "TEL" : "INT";
    console.log(
      `  ${marker} [${type}] ext ${device.extension} — ${displayName}`,
    );
  }

  console.log(`\n  Telefonos: ${PHONES.length}`);
  console.log(`  Intercoms: ${INTERCOMS.length}`);
  console.log(`  Creados: ${created}`);
  console.log(`  Omitidos: ${skipped} (ya existian)\n`);

  // 5. Seed voip_config (if not exists)
  const existingConfig =
    await sql`SELECT id FROM voip_config WHERE tenant_id = ${tenantId}`;

  if (existingConfig.length === 0) {
    console.log("[voip_config] Creando configuracion VoIP del tenant...");
    await sql`
      INSERT INTO voip_config (
        id, tenant_id, sip_host, sip_port, sip_transport, sip_domain,
        pbx_type, default_mode, greeting_context, greeting_language,
        ai_timeout_seconds, door_open_dtmf, auto_open_enabled,
        operator_extension, recording_enabled, auto_provision_enabled,
        fanvil_admin_user, fanvil_admin_password,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        ${tenantId},
        ${SIP_SERVER},
        ${SIP_PORT},
        'udp',
        ${SIP_SERVER},
        'asterisk',
        'mixed',
        'default',
        'es',
        15,
        '#',
        false,
        '099',
        true,
        true,
        'admin',
        'admin',
        NOW(),
        NOW()
      )
    `;
    console.log("  ✓ voip_config creado\n");
  } else {
    console.log("[voip_config] Ya existe — omitido\n");
  }

  // 6. Also register in devices table (for unified device management)
  console.log("[devices] Registrando en tabla devices (type=intercom)...");
  const existingDevicesMain = await sql`
    SELECT extension FROM devices WHERE tenant_id = ${tenantId} AND type = 'intercom'
  `;
  const existingExts = new Set(existingDevicesMain.map((d) => d.extension));
  let devicesCreated = 0;

  for (const device of allDevices) {
    const ext = String(device.extension);
    if (existingExts.has(ext)) continue;

    // Find site_id
    let siteId: string | null = null;
    for (const [name, id] of siteLookup) {
      if (
        name.includes(device.siteName.toLowerCase()) ||
        device.siteName.toLowerCase().includes(name)
      ) {
        siteId = id;
        break;
      }
    }

    const displayName =
      device.deviceType === "phone"
        ? `Telefono Puesto ${device.siteName}`
        : `Intercom ${device.siteName}`;

    await sql`
      INSERT INTO devices (
        id, tenant_id, site_id, name, type, brand, model,
        extension, status, channels, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        ${tenantId},
        ${siteId},
        ${displayName},
        'intercom',
        'fanvil',
        ${device.model},
        ${ext},
        'unknown',
        1,
        NOW(),
        NOW()
      )
    `;
    devicesCreated++;
  }
  console.log(
    `  ✓ ${devicesCreated} dispositivos registrados en tabla devices\n`,
  );

  console.log("══════════════════════════════════════════════════");
  console.log(
    `  Total: ${created + skipped} intercom_devices + ${devicesCreated} devices + voip_config`,
  );
  console.log("══════════════════════════════════════════════════\n");

  await sql.end();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
