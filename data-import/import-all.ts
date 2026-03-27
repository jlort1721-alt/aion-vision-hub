#!/usr/bin/env npx tsx
/**
 * Bulk Data Import Script — Clave Seguridad Platform
 *
 * Imports operational data from CSV templates into the database.
 * Encrypts device credentials automatically.
 *
 * Usage:
 *   cd backend/apps/backend-api
 *   npx tsx ../../../data-import/import-all.ts [--tenant-id <uuid>] [--dry-run] [--only <step>]
 *
 * Steps: sites, sections, devices-ip, devices-p2p, residents, vehicles, contacts, shifts, contracts
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ─── Encryption (mirrors backend encrypt/decrypt) ─────────────────────────
function encrypt(plainText: string, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex').subarray(0, 32), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

// ─── CSV Parser ───────────────────────────────────────────────────────────
function loadCSV<T>(filename: string): T[] {
  const templatesDir = path.join(import.meta.dirname ?? __dirname, 'templates');
  const filePath = path.join(templatesDir, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⏭  Skipping ${filename} (file not found)`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    cast: (value: string, context: { column: string | number }) => {
      if (value === '') return null;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    },
  }) as T[];
}

// ─── CLI Args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tenantIdArg = args.includes('--tenant-id') ? args[args.indexOf('--tenant-id') + 1] : null;
const onlyStep = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

// ─── Database ─────────────────────────────────────────────────────────────
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL not set. Run from backend/apps/backend-api with .env loaded.');
  process.exit(1);
}

const encKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
const sql = postgres(dbUrl, { max: 5 });

// ─── Helpers ──────────────────────────────────────────────────────────────
function encryptIfKey(value: string | null): string | null {
  if (!value || !encKey) return value;
  return encrypt(value, encKey);
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Maps for resolving references (name → id)
const siteMap = new Map<string, string>();   // siteName → siteId
const sectionMap = new Map<string, string>(); // siteName:sectionName → sectionId
const personMap = new Map<string, string>();  // documentId → personId

// ─── Import Steps ─────────────────────────────────────────────────────────

async function getTenantId(): Promise<string> {
  if (tenantIdArg) return tenantIdArg;
  const rows = await sql`SELECT id, name FROM tenants LIMIT 5`;
  if (rows.length === 0) {
    console.error('❌ No tenants found. Create a tenant first.');
    process.exit(1);
  }
  if (rows.length === 1) {
    console.log(`  Using tenant: ${rows[0].name} (${rows[0].id})`);
    return rows[0].id;
  }
  console.log('Multiple tenants found. Use --tenant-id <uuid>:');
  rows.forEach((r) => console.log(`  ${r.id}  ${r.name}`));
  process.exit(1);
}

async function importSites(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('01_sites.csv');
  if (!rows.length) return;
  console.log(`\n📍 Importing ${rows.length} sites...`);

  for (const row of rows) {
    const id = randomUUID();
    const slug = slugify(row.name);

    if (dryRun) {
      console.log(`  [DRY] Site: ${row.name} (${row.wanIp})`);
      siteMap.set(row.name, id);
      continue;
    }

    // Check if exists
    const existing = await sql`SELECT id FROM sites WHERE tenant_id = ${tenantId} AND name = ${row.name} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`  ✓ Site already exists: ${row.name}`);
      siteMap.set(row.name, existing[0].id);
      continue;
    }

    await sql`INSERT INTO sites (id, tenant_id, name, slug, site_sheet, address, latitude, longitude, timezone, wan_ip, status)
              VALUES (${id}, ${tenantId}, ${row.name}, ${slug}, ${row.siteSheet}, ${row.address},
                      ${row.latitude}, ${row.longitude}, ${row.timezone || 'America/Bogota'},
                      ${row.wanIp}, ${row.status || 'active'})`;
    siteMap.set(row.name, id);
    console.log(`  ✅ ${row.name} (WAN: ${row.wanIp})`);
  }
}

async function importSections(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('02_sections.csv');
  if (!rows.length) return;
  console.log(`\n🏢 Importing ${rows.length} sections...`);

  for (const row of rows) {
    const siteId = siteMap.get(row.siteName);
    if (!siteId) {
      console.log(`  ⚠ Site not found for section: ${row.siteName} → ${row.name}`);
      continue;
    }

    const id = randomUUID();
    const key = `${row.siteName}:${row.name}`;

    if (dryRun) {
      console.log(`  [DRY] Section: ${row.name} @ ${row.siteName}`);
      sectionMap.set(key, id);
      continue;
    }

    const existing = await sql`SELECT id FROM sections WHERE tenant_id = ${tenantId} AND site_id = ${siteId} AND name = ${row.name} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`  ✓ Section already exists: ${row.name}`);
      sectionMap.set(key, existing[0].id);
      continue;
    }

    await sql`INSERT INTO sections (id, tenant_id, site_id, name, type, description, order_index, is_active)
              VALUES (${id}, ${tenantId}, ${siteId}, ${row.name}, ${row.type || 'post'},
                      ${row.description}, ${parseInt(row.orderIndex) || 0}, ${row.isActive !== false})`;
    sectionMap.set(key, id);
    console.log(`  ✅ ${row.name} → ${row.siteName}`);
  }
}

async function importDevicesIP(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('03_devices_ip.csv');
  if (!rows.length) return;
  console.log(`\n📹 Importing ${rows.length} IP devices...`);

  for (const row of rows) {
    const siteId = siteMap.get(row.siteName);
    if (!siteId) {
      console.log(`  ⚠ Site not found: ${row.siteName} for device ${row.name}`);
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY] Device: ${row.name} (${row.ipAddress}) @ ${row.siteName}`);
      continue;
    }

    const existing = await sql`SELECT id FROM devices WHERE tenant_id = ${tenantId} AND site_id = ${siteId} AND name = ${row.name} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`  ✓ Device already exists: ${row.name}`);
      continue;
    }

    const id = randomUUID();
    const encUser = encryptIfKey(row.username);
    const encPass = encryptIfKey(row.password);

    await sql`INSERT INTO devices (id, tenant_id, site_id, name, device_slug, type, brand, model,
              connection_type, ip_address, port, http_port, rtsp_port, onvif_port,
              username, password, credentials_encrypted, channels, serial_number,
              mac_address, firmware_version, notes, status)
              VALUES (${id}, ${tenantId}, ${siteId}, ${row.name}, ${slugify(row.name)},
                      ${row.type || 'camera'}, ${row.brand}, ${row.model},
                      ${row.connectionType || 'ip_directa'}, ${row.ipAddress},
                      ${row.port ? parseInt(row.port) : null},
                      ${row.httpPort ? parseInt(row.httpPort) : null},
                      ${row.rtspPort ? parseInt(row.rtspPort) : 554},
                      ${row.onvifPort ? parseInt(row.onvifPort) : 80},
                      ${encUser}, ${encPass}, ${!!encKey},
                      ${row.channels ? parseInt(row.channels) : 1},
                      ${row.serialNumber}, ${row.macAddress}, ${row.firmwareVersion},
                      ${row.notes}, 'unknown')`;
    console.log(`  ✅ ${row.name} (${row.ipAddress}:${row.port}) [${row.brand}/${row.model}]`);
  }
}

async function importDevicesP2P(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('04_devices_p2p.csv');
  if (!rows.length) return;
  console.log(`\n📡 Importing ${rows.length} P2P devices...`);

  for (const row of rows) {
    const siteId = siteMap.get(row.siteName);
    if (!siteId) {
      console.log(`  ⚠ Site not found: ${row.siteName} for device ${row.name}`);
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY] P2P Device: ${row.name} (SN: ${row.serialNumber}) @ ${row.siteName}`);
      continue;
    }

    const existing = await sql`SELECT id FROM devices WHERE tenant_id = ${tenantId} AND serial_number = ${row.serialNumber} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`  ✓ P2P Device already exists: ${row.name} (SN: ${row.serialNumber})`);
      continue;
    }

    const id = randomUUID();
    const encUser = encryptIfKey(row.username);
    const encPass = encryptIfKey(row.password);

    await sql`INSERT INTO devices (id, tenant_id, site_id, name, device_slug, type, brand, model,
              connection_type, serial_number, username, password, credentials_encrypted,
              channels, notes, status)
              VALUES (${id}, ${tenantId}, ${siteId}, ${row.name}, ${slugify(row.name)},
                      ${row.type || 'camera'}, ${row.brand}, ${row.model},
                      ${row.connectionType}, ${row.serialNumber},
                      ${encUser}, ${encPass}, ${!!encKey},
                      ${row.channels ? parseInt(row.channels) : 1},
                      ${row.notes}, 'unknown')`;
    console.log(`  ✅ ${row.name} (${row.connectionType}: ${row.serialNumber})`);
  }
}

async function importResidents(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('06_residents.csv');
  if (!rows.length) return;
  console.log(`\n👥 Importing ${rows.length} residents/people...`);

  for (const row of rows) {
    const sectionKey = `${row.siteName}:${row.sectionName}`;
    const sectionId = sectionMap.get(sectionKey);

    if (dryRun) {
      const id = randomUUID();
      console.log(`  [DRY] Person: ${row.fullName} (${row.documentId}) → ${row.unit}`);
      if (row.documentId) personMap.set(row.documentId, id);
      continue;
    }

    const existing = row.documentId
      ? await sql`SELECT id FROM access_people WHERE tenant_id = ${tenantId} AND document_id = ${row.documentId} LIMIT 1`
      : [];
    if (existing.length > 0) {
      console.log(`  ✓ Person already exists: ${row.fullName}`);
      personMap.set(row.documentId, existing[0].id);
      continue;
    }

    const id = randomUUID();
    await sql`INSERT INTO access_people (id, tenant_id, section_id, type, full_name, document_id, phone, email, unit, notes, status)
              VALUES (${id}, ${tenantId}, ${sectionId || null}, ${row.type || 'resident'},
                      ${row.fullName}, ${row.documentId}, ${row.phone}, ${row.email},
                      ${row.unit}, ${row.notes}, ${row.status || 'active'})`;
    if (row.documentId) personMap.set(row.documentId, id);
    console.log(`  ✅ ${row.fullName} (${row.type}) → ${row.unit}`);
  }
}

async function importVehicles(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('07_vehicles.csv');
  if (!rows.length) return;
  console.log(`\n🚗 Importing ${rows.length} vehicles...`);

  for (const row of rows) {
    const personId = personMap.get(row.residentDocumentId);
    if (!personId) {
      console.log(`  ⚠ Person not found for vehicle ${row.plate} (doc: ${row.residentDocumentId})`);
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY] Vehicle: ${row.plate} (${row.brand} ${row.model})`);
      continue;
    }

    const existing = await sql`SELECT id FROM access_vehicles WHERE tenant_id = ${tenantId} AND plate = ${row.plate} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`  ✓ Vehicle already exists: ${row.plate}`);
      continue;
    }

    await sql`INSERT INTO access_vehicles (id, tenant_id, person_id, plate, brand, model, color, type, status)
              VALUES (${randomUUID()}, ${tenantId}, ${personId}, ${row.plate},
                      ${row.brand}, ${row.model}, ${row.color}, ${row.type || 'car'}, ${row.status || 'active'})`;
    console.log(`  ✅ ${row.plate} (${row.brand} ${row.model} ${row.color})`);
  }
}

async function importEmergencyContacts(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('08_emergency_contacts.csv');
  if (!rows.length) return;
  console.log(`\n🚨 Importing ${rows.length} emergency contacts...`);

  for (const row of rows) {
    const siteId = siteMap.get(row.siteName);

    if (dryRun) {
      console.log(`  [DRY] Contact: ${row.name} (${row.role}) → ${row.phone}`);
      continue;
    }

    const existing = await sql`SELECT id FROM emergency_contacts WHERE tenant_id = ${tenantId} AND phone = ${row.phone} AND name = ${row.name} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`  ✓ Contact already exists: ${row.name}`);
      continue;
    }

    const availableHours = row.availableHours
      ? (() => { const [s, e] = row.availableHours.split('-'); return JSON.stringify({ start: s, end: e }); })()
      : null;

    await sql`INSERT INTO emergency_contacts (id, tenant_id, site_id, name, role, phone, email, priority, available_hours, is_active)
              VALUES (${randomUUID()}, ${tenantId}, ${siteId || null}, ${row.name}, ${row.role},
                      ${row.phone}, ${row.email}, ${parseInt(row.priority) || 1},
                      ${availableHours ? sql`${availableHours}::jsonb` : null}, true)`;
    console.log(`  ✅ ${row.name} (${row.role}) — ${row.phone}`);
  }
}

async function importShifts(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('09_shifts.csv');
  if (!rows.length) return;
  console.log(`\n⏰ Importing ${rows.length} shifts...`);

  for (const row of rows) {
    const siteId = siteMap.get(row.siteName);
    if (!siteId) {
      console.log(`  ⚠ Site not found: ${row.siteName} for shift ${row.name}`);
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY] Shift: ${row.name} (${row.startTime}-${row.endTime}) @ ${row.siteName}`);
      continue;
    }

    const existing = await sql`SELECT id FROM shifts WHERE tenant_id = ${tenantId} AND site_id = ${siteId} AND name = ${row.name} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`  ✓ Shift already exists: ${row.name}`);
      continue;
    }

    const daysOfWeek = JSON.stringify(row.daysOfWeek.split(',').map(Number));

    await sql`INSERT INTO shifts (id, tenant_id, site_id, name, start_time, end_time, days_of_week, max_guards, description, is_active)
              VALUES (${randomUUID()}, ${tenantId}, ${siteId}, ${row.name},
                      ${row.startTime}::time, ${row.endTime}::time,
                      ${daysOfWeek}::jsonb, ${parseInt(row.maxGuards) || 1},
                      ${row.description}, true)`;
    console.log(`  ✅ ${row.name} (${row.startTime}—${row.endTime}) @ ${row.siteName}`);
  }
}

async function importContracts(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('10_contracts.csv');
  if (!rows.length) return;
  console.log(`\n📋 Importing ${rows.length} contracts...`);

  for (const row of rows) {
    const siteId = siteMap.get(row.siteName);

    if (dryRun) {
      console.log(`  [DRY] Contract: ${row.contractNumber} — ${row.clientName} ($${row.monthlyAmount})`);
      continue;
    }

    const existing = await sql`SELECT id FROM contracts WHERE tenant_id = ${tenantId} AND contract_number = ${row.contractNumber} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`  ✓ Contract already exists: ${row.contractNumber}`);
      continue;
    }

    const services = JSON.stringify(row.services?.split(';').map((s: string) => s.trim()).filter(Boolean) || []);

    // We need a createdBy user — use the first profile in the tenant
    const profiles = await sql`SELECT id FROM profiles WHERE tenant_id = ${tenantId} LIMIT 1`;
    const createdBy = profiles[0]?.id || '00000000-0000-0000-0000-000000000000';

    await sql`INSERT INTO contracts (id, tenant_id, site_id, contract_number, client_name, client_document,
              client_email, client_phone, type, status, start_date, end_date, monthly_amount,
              currency, services, payment_terms, auto_renew, notes, created_by)
              VALUES (${randomUUID()}, ${tenantId}, ${siteId || null}, ${row.contractNumber},
                      ${row.clientName}, ${row.clientDocument}, ${row.clientEmail}, ${row.clientPhone},
                      ${row.type || 'monthly'}, ${row.status || 'active'},
                      ${row.startDate}::date, ${row.endDate ? sql`${row.endDate}::date` : null},
                      ${parseFloat(row.monthlyAmount) || 0}, ${row.currency || 'COP'},
                      ${services}::jsonb, ${row.paymentTerms || 'net_30'},
                      ${!!row.autoRenew},
                      ${row.notes}, ${createdBy})`;
    console.log(`  ✅ ${row.contractNumber} — ${row.clientName} ($${Number(row.monthlyAmount).toLocaleString()} ${row.currency})`);
  }
}

// ─── Additional Import Steps (Templates 12-25) ───────────────────────────

const patrolRouteMap = new Map<string, string>(); // siteName:routeName → routeId

async function importPatrolRoutes(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('12_patrol_routes.csv');
  if (!rows.length) return;
  console.log(`\n🚶 Importing ${rows.length} patrol routes...`);

  for (const row of rows) {
    const siteId = siteMap.get(row.siteName);
    if (!siteId) { console.log(`  ⚠ Site not found: ${row.siteName}`); continue; }
    const key = `${row.siteName}:${row.routeName}`;
    const id = randomUUID();

    if (dryRun) { console.log(`  [DRY] Route: ${row.routeName} @ ${row.siteName}`); patrolRouteMap.set(key, id); continue; }

    const existing = await sql`SELECT id FROM patrol_routes WHERE tenant_id = ${tenantId} AND site_id = ${siteId} AND name = ${row.routeName} LIMIT 1`;
    if (existing.length > 0) { console.log(`  ✓ Route exists: ${row.routeName}`); patrolRouteMap.set(key, existing[0].id); continue; }

    await sql`INSERT INTO patrol_routes (id, tenant_id, site_id, name, description, estimated_minutes, frequency_minutes, is_active)
              VALUES (${id}, ${tenantId}, ${siteId}, ${row.routeName}, ${row.description},
                      ${parseInt(row.estimatedMinutes) || 30}, ${parseInt(row.frequencyMinutes) || 60}, true)`;
    patrolRouteMap.set(key, id);
    console.log(`  ✅ ${row.routeName} @ ${row.siteName} (cada ${row.frequencyMinutes}min)`);
  }
}

async function importPatrolCheckpoints(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('13_patrol_checkpoints.csv');
  if (!rows.length) return;
  console.log(`\n📍 Importing ${rows.length} patrol checkpoints...`);

  for (const row of rows) {
    const routeKey = `${row.siteName}:${row.routeName}`;
    const routeId = patrolRouteMap.get(routeKey);
    if (!routeId) { console.log(`  ⚠ Route not found: ${routeKey}`); continue; }

    if (dryRun) { console.log(`  [DRY] Checkpoint: ${row.checkpointName} (#${row.order})`); continue; }

    const existing = await sql`SELECT id FROM patrol_checkpoints WHERE tenant_id = ${tenantId} AND route_id = ${routeId} AND name = ${row.checkpointName} LIMIT 1`;
    if (existing.length > 0) { console.log(`  ✓ Checkpoint exists: ${row.checkpointName}`); continue; }

    await sql`INSERT INTO patrol_checkpoints (id, tenant_id, route_id, name, description, "order", required_photo, qr_code)
              VALUES (${randomUUID()}, ${tenantId}, ${routeId}, ${row.checkpointName}, ${row.description},
                      ${parseInt(row.order) || 0}, ${!!row.requiredPhoto}, ${row.qrCode})`;
    console.log(`  ✅ ${row.checkpointName} (#${row.order}) [${row.requiredPhoto ? 'foto requerida' : ''}]`);
  }
}

async function importSLADefinitions(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('14_sla_definitions.csv');
  if (!rows.length) return;
  console.log(`\n📊 Importing ${rows.length} SLA definitions...`);

  for (const row of rows) {
    if (dryRun) { console.log(`  [DRY] SLA: ${row.name} (${row.severity})`); continue; }

    const existing = await sql`SELECT id FROM sla_definitions WHERE tenant_id = ${tenantId} AND name = ${row.name} LIMIT 1`;
    if (existing.length > 0) { console.log(`  ✓ SLA exists: ${row.name}`); continue; }

    await sql`INSERT INTO sla_definitions (id, tenant_id, name, description, severity, response_time_minutes, resolution_time_minutes, business_hours_only, is_active)
              VALUES (${randomUUID()}, ${tenantId}, ${row.name}, ${row.description}, ${row.severity},
                      ${parseInt(row.responseTimeMinutes)}, ${parseInt(row.resolutionTimeMinutes)},
                      ${!!row.businessHoursOnly}, true)`;
    console.log(`  ✅ ${row.name} (${row.severity}: resp ${row.responseTimeMinutes}min / res ${row.resolutionTimeMinutes}min)`);
  }
}

async function importEmergencyProtocols(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('15_emergency_protocols.csv');
  if (!rows.length) return;
  console.log(`\n🆘 Importing ${rows.length} emergency protocols...`);

  for (const row of rows) {
    if (dryRun) { console.log(`  [DRY] Protocol: ${row.name} (${row.type})`); continue; }

    const existing = await sql`SELECT id FROM emergency_protocols WHERE tenant_id = ${tenantId} AND name = ${row.name} LIMIT 1`;
    if (existing.length > 0) { console.log(`  ✓ Protocol exists: ${row.name}`); continue; }

    const steps = JSON.stringify(row.steps?.split(';').map((s: string) => s.trim()).filter(Boolean) || []);

    await sql`INSERT INTO emergency_protocols (id, tenant_id, name, type, description, steps, priority, is_active)
              VALUES (${randomUUID()}, ${tenantId}, ${row.name}, ${row.type}, ${row.description},
                      ${steps}::jsonb, ${parseInt(row.priority) || 1}, true)`;
    console.log(`  ✅ ${row.name} (${row.type})`);
  }
}

async function importAlertRules(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('16_alert_rules.csv');
  if (!rows.length) return;
  console.log(`\n🔔 Importing ${rows.length} alert rules...`);

  const profiles = await sql`SELECT id FROM profiles WHERE tenant_id = ${tenantId} LIMIT 1`;
  const createdBy = profiles[0]?.id || '00000000-0000-0000-0000-000000000000';

  for (const row of rows) {
    if (dryRun) { console.log(`  [DRY] Alert: ${row.name} (${row.severity})`); continue; }

    const existing = await sql`SELECT id FROM alert_rules WHERE tenant_id = ${tenantId} AND name = ${row.name} LIMIT 1`;
    if (existing.length > 0) { console.log(`  ✓ Alert rule exists: ${row.name}`); continue; }

    const conditions = JSON.stringify({ type: row.conditionType, value: row.conditionValue });
    const actions = JSON.stringify({ notify: true });

    await sql`INSERT INTO alert_rules (id, tenant_id, name, description, conditions, actions, severity, cooldown_minutes, is_active, created_by)
              VALUES (${randomUUID()}, ${tenantId}, ${row.name}, ${row.description},
                      ${conditions}::jsonb, ${actions}::jsonb, ${row.severity},
                      ${parseInt(row.cooldownMinutes) || 5}, true, ${createdBy})`;
    console.log(`  ✅ ${row.name} (${row.severity})`);
  }
}

async function importNotificationChannels(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('17_notification_channels.csv');
  if (!rows.length) return;
  console.log(`\n📢 Importing ${rows.length} notification channels...`);

  for (const row of rows) {
    if (dryRun) { console.log(`  [DRY] Channel: ${row.name} (${row.type})`); continue; }

    const existing = await sql`SELECT id FROM notification_channels WHERE tenant_id = ${tenantId} AND name = ${row.name} LIMIT 1`;
    if (existing.length > 0) { console.log(`  ✓ Channel exists: ${row.name}`); continue; }

    await sql`INSERT INTO notification_channels (id, tenant_id, name, type, config, is_active)
              VALUES (${randomUUID()}, ${tenantId}, ${row.name}, ${row.type},
                      ${row.config}::jsonb, ${!!row.isActive})`;
    console.log(`  ✅ ${row.name} (${row.type})`);
  }
}

async function importAutomationRules(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('18_automation_rules.csv');
  if (!rows.length) return;
  console.log(`\n⚡ Importing ${rows.length} automation rules...`);

  const profiles = await sql`SELECT id FROM profiles WHERE tenant_id = ${tenantId} LIMIT 1`;
  const createdBy = profiles[0]?.id || '00000000-0000-0000-0000-000000000000';

  for (const row of rows) {
    if (dryRun) { console.log(`  [DRY] Automation: ${row.name}`); continue; }

    const existing = await sql`SELECT id FROM automation_rules WHERE tenant_id = ${tenantId} AND name = ${row.name} LIMIT 1`;
    if (existing.length > 0) { console.log(`  ✓ Rule exists: ${row.name}`); continue; }

    const trigger = JSON.stringify({ type: row.triggerType, value: row.triggerValue });
    const actions = JSON.stringify([{ type: row.actionType, value: row.actionValue }]);

    await sql`INSERT INTO automation_rules (id, tenant_id, name, description, "trigger", actions, cooldown_minutes, priority, is_active, created_by)
              VALUES (${randomUUID()}, ${tenantId}, ${row.name}, ${row.description},
                      ${trigger}::jsonb, ${actions}::jsonb,
                      ${parseInt(row.cooldownMinutes) || 5}, ${parseInt(row.priority) || 1}, true, ${createdBy})`;
    console.log(`  ✅ ${row.name}`);
  }
}

async function importKeyInventory(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('19_key_inventory.csv');
  if (!rows.length) return;
  console.log(`\n🔑 Importing ${rows.length} keys...`);

  for (const row of rows) {
    const siteId = siteMap.get(row.siteName);

    if (dryRun) { console.log(`  [DRY] Key: ${row.keyCode} — ${row.label}`); continue; }

    const existing = await sql`SELECT id FROM key_inventory WHERE tenant_id = ${tenantId} AND key_code = ${row.keyCode} LIMIT 1`;
    if (existing.length > 0) { console.log(`  ✓ Key exists: ${row.keyCode}`); continue; }

    await sql`INSERT INTO key_inventory (id, tenant_id, site_id, key_code, label, description, key_type, status, current_holder, location, copies)
              VALUES (${randomUUID()}, ${tenantId}, ${siteId || null}, ${row.keyCode}, ${row.label},
                      ${row.description}, ${row.keyType || 'access'}, ${row.status || 'available'},
                      ${row.currentHolder}, ${row.location}, ${parseInt(row.copies) || 1})`;
    console.log(`  ✅ ${row.keyCode} — ${row.label} (${row.status})`);
  }
}

async function importComplianceTemplates(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('20_compliance_templates.csv');
  if (!rows.length) return;
  console.log(`\n📜 Importing ${rows.length} compliance templates...`);

  const profiles = await sql`SELECT id FROM profiles WHERE tenant_id = ${tenantId} LIMIT 1`;
  const createdBy = profiles[0]?.id || '00000000-0000-0000-0000-000000000000';

  for (const row of rows) {
    if (dryRun) { console.log(`  [DRY] Template: ${row.name} (${row.type})`); continue; }

    const existing = await sql`SELECT id FROM compliance_templates WHERE tenant_id = ${tenantId} AND name = ${row.name} LIMIT 1`;
    if (existing.length > 0) { console.log(`  ✓ Template exists: ${row.name}`); continue; }

    await sql`INSERT INTO compliance_templates (id, tenant_id, name, type, content, version, is_active, created_by)
              VALUES (${randomUUID()}, ${tenantId}, ${row.name}, ${row.type}, ${row.content},
                      ${parseInt(row.version) || 1}, true, ${createdBy})`;
    console.log(`  ✅ ${row.name} (${row.type} v${row.version})`);
  }
}

async function importDataRetentionPolicies(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('21_data_retention_policies.csv');
  if (!rows.length) return;
  console.log(`\n🗄️ Importing ${rows.length} data retention policies...`);

  const profiles = await sql`SELECT id FROM profiles WHERE tenant_id = ${tenantId} LIMIT 1`;
  const createdBy = profiles[0]?.id || '00000000-0000-0000-0000-000000000000';

  for (const row of rows) {
    if (dryRun) { console.log(`  [DRY] Retention: ${row.name} (${row.retentionDays} days → ${row.action})`); continue; }

    const existing = await sql`SELECT id FROM data_retention_policies WHERE tenant_id = ${tenantId} AND name = ${row.name} LIMIT 1`;
    if (existing.length > 0) { console.log(`  ✓ Policy exists: ${row.name}`); continue; }

    await sql`INSERT INTO data_retention_policies (id, tenant_id, name, data_type, retention_days, action, is_active, created_by)
              VALUES (${randomUUID()}, ${tenantId}, ${row.name}, ${row.dataType},
                      ${parseInt(row.retentionDays)}, ${row.action || 'delete'}, true, ${createdBy})`;
    console.log(`  ✅ ${row.name} (${row.retentionDays} días → ${row.action})`);
  }
}

async function importTrainingPrograms(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('22_training_programs.csv');
  if (!rows.length) return;
  console.log(`\n🎓 Importing ${rows.length} training programs...`);

  const profiles = await sql`SELECT id FROM profiles WHERE tenant_id = ${tenantId} LIMIT 1`;
  const createdBy = profiles[0]?.id || '00000000-0000-0000-0000-000000000000';

  for (const row of rows) {
    if (dryRun) { console.log(`  [DRY] Training: ${row.name} (${row.category})`); continue; }

    const existing = await sql`SELECT id FROM training_programs WHERE tenant_id = ${tenantId} AND name = ${row.name} LIMIT 1`;
    if (existing.length > 0) { console.log(`  ✓ Program exists: ${row.name}`); continue; }

    await sql`INSERT INTO training_programs (id, tenant_id, name, description, category, duration_hours, is_required, validity_months, passing_score, is_active, created_by)
              VALUES (${randomUUID()}, ${tenantId}, ${row.name}, ${row.description}, ${row.category},
                      ${parseInt(row.durationHours)}, ${!!row.isRequired},
                      ${parseInt(row.validityMonths) || 12}, ${parseInt(row.passingScore) || 70}, true, ${createdBy})`;
    console.log(`  ✅ ${row.name} (${row.category}, ${row.durationHours}h)`);
  }
}

async function importIntercomDevices(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('24_intercom_devices.csv');
  if (!rows.length) return;
  console.log(`\n📞 Importing ${rows.length} intercom devices...`);

  for (const row of rows) {
    const sectionKey = `${row.siteName}:${row.sectionName}`;
    const sectionId = sectionMap.get(sectionKey);

    if (dryRun) { console.log(`  [DRY] Intercom: ${row.name} (${row.ipAddress})`); continue; }

    const existing = await sql`SELECT id FROM intercom_devices WHERE tenant_id = ${tenantId} AND name = ${row.name} LIMIT 1`;
    if (existing.length > 0) { console.log(`  ✓ Intercom exists: ${row.name}`); continue; }

    await sql`INSERT INTO intercom_devices (id, tenant_id, section_id, name, brand, model, ip_address, sip_uri, status)
              VALUES (${randomUUID()}, ${tenantId}, ${sectionId || null}, ${row.name},
                      ${row.brand || 'Fanvil'}, ${row.model}, ${row.ipAddress}, ${row.sipUri}, ${row.status || 'offline'})`;
    console.log(`  ✅ ${row.name} (${row.brand} ${row.model} @ ${row.ipAddress})`);
  }
}

async function importDomoticDevices(tenantId: string) {
  const rows = loadCSV<Record<string, string>>('25_domotic_devices.csv');
  if (!rows.length) return;
  console.log(`\n🏠 Importing ${rows.length} domotic devices...`);

  for (const row of rows) {
    const sectionKey = `${row.siteName}:${row.sectionName}`;
    const sectionId = sectionMap.get(sectionKey);

    if (dryRun) { console.log(`  [DRY] Domotic: ${row.name} (${row.type})`); continue; }

    const existing = await sql`SELECT id FROM domotic_devices WHERE tenant_id = ${tenantId} AND name = ${row.name} LIMIT 1`;
    if (existing.length > 0) { console.log(`  ✓ Domotic device exists: ${row.name}`); continue; }

    await sql`INSERT INTO domotic_devices (id, tenant_id, section_id, name, type, brand, model, status)
              VALUES (${randomUUID()}, ${tenantId}, ${sectionId || null}, ${row.name},
                      ${row.type || 'relay'}, ${row.brand || 'Sonoff'}, ${row.model}, ${row.status || 'offline'})`;
    console.log(`  ✅ ${row.name} (${row.brand} ${row.model})`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Clave Seguridad — Bulk Data Import');
  console.log('═══════════════════════════════════════════════════════════');
  if (dryRun) console.log('  🔍 DRY RUN MODE — no data will be written');
  if (encKey) console.log('  🔐 Credential encryption: ENABLED');
  else console.log('  ⚠  Credential encryption: DISABLED (no CREDENTIAL_ENCRYPTION_KEY)');

  const tenantId = await getTenantId();
  console.log(`  Tenant ID: ${tenantId}`);

  // Load existing sites into map
  const existingSites = await sql`SELECT id, name FROM sites WHERE tenant_id = ${tenantId}`;
  existingSites.forEach((s) => siteMap.set(s.name, s.id));

  // Load existing sections into map
  const existingSections = await sql`
    SELECT s.id, s.name, si.name as site_name
    FROM sections s JOIN sites si ON s.site_id = si.id
    WHERE s.tenant_id = ${tenantId}`;
  existingSections.forEach((s) => sectionMap.set(`${s.site_name}:${s.name}`, s.id));

  // Load existing people into map
  const existingPeople = await sql`SELECT id, document_id FROM access_people WHERE tenant_id = ${tenantId} AND document_id IS NOT NULL`;
  existingPeople.forEach((p) => personMap.set(p.document_id, p.id));

  const steps: Record<string, () => Promise<void>> = {
    sites: () => importSites(tenantId),
    sections: () => importSections(tenantId),
    'devices-ip': () => importDevicesIP(tenantId),
    'devices-p2p': () => importDevicesP2P(tenantId),
    residents: () => importResidents(tenantId),
    vehicles: () => importVehicles(tenantId),
    contacts: () => importEmergencyContacts(tenantId),
    shifts: () => importShifts(tenantId),
    contracts: () => importContracts(tenantId),
    patrols: () => importPatrolRoutes(tenantId),
    checkpoints: () => importPatrolCheckpoints(tenantId),
    sla: () => importSLADefinitions(tenantId),
    protocols: () => importEmergencyProtocols(tenantId),
    alerts: () => importAlertRules(tenantId),
    notifications: () => importNotificationChannels(tenantId),
    automation: () => importAutomationRules(tenantId),
    keys: () => importKeyInventory(tenantId),
    compliance: () => importComplianceTemplates(tenantId),
    retention: () => importDataRetentionPolicies(tenantId),
    training: () => importTrainingPrograms(tenantId),
    intercom: () => importIntercomDevices(tenantId),
    domotics: () => importDomoticDevices(tenantId),
  };

  if (onlyStep) {
    if (!steps[onlyStep]) {
      console.error(`❌ Unknown step: ${onlyStep}. Available: ${Object.keys(steps).join(', ')}`);
      process.exit(1);
    }
    await steps[onlyStep]();
  } else {
    for (const [name, fn] of Object.entries(steps)) {
      await fn();
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ Import complete!');
  console.log('═══════════════════════════════════════════════════════════');

  // Print cloud account instructions
  const cloudAccounts = loadCSV<Record<string, string>>('05_cloud_accounts.csv');
  if (cloudAccounts.length > 0) {
    console.log('\n📡 Cloud Accounts (HikConnect/DMSS):');
    console.log('  These must be configured via the UI or API:');
    for (const acc of cloudAccounts) {
      console.log(`  • ${acc.platform}: ${acc.accountName} (${acc.username})`);
      if (acc.platform === 'hikconnect') {
        console.log(`    → POST /cloud/ezviz/login { username, password }`);
      } else if (acc.platform === 'dmss') {
        console.log(`    → POST /cloud/imou/login { username, password }`);
      }
    }
  }

  // Print email config instructions
  const emailAccounts = loadCSV<Record<string, string>>('11_email_accounts.csv');
  if (emailAccounts.length > 0) {
    console.log('\n📧 Email Accounts:');
    console.log('  Configure in backend/.env:');
    const primary = emailAccounts[0];
    console.log(`  SMTP_HOST=${primary.smtpHost}`);
    console.log(`  SMTP_PORT=${primary.smtpPort}`);
    console.log(`  SMTP_USER=${primary.email}`);
    console.log(`  SMTP_PASS=<your-app-password>`);
    console.log(`  EMAIL_FROM_ADDRESS=${primary.email}`);
    console.log(`  EMAIL_FROM_NAME=Clave Seguridad`);
  }

  await sql.end();
}

main().catch((err) => {
  console.error('❌ Import failed:', err.message);
  process.exit(1);
});
