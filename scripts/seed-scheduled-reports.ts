/**
 * AION Vision Hub — Seed Default Scheduled Report
 * Idempotent: checks by name before inserting, safe to run multiple times.
 *
 * Usage: cd backend/apps/backend-api && npx tsx ../../../scripts/seed-scheduled-reports.ts
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
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// ── Compute next Monday at 8:00 AM Colombia time (UTC-5) ──
function getNextMondayAt8AMColombia(): Date {
  const now = new Date();
  // Colombia is UTC-5
  const colombiaOffset = -5;
  const utcNow = new Date(now.getTime() + now.getTimezoneOffset() * 60_000);
  const colombiaNow = new Date(utcNow.getTime() + colombiaOffset * 3600_000);

  // Find next Monday
  const dayOfWeek = colombiaNow.getDay(); // 0=Sun, 1=Mon
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;

  const nextMonday = new Date(colombiaNow);
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(8, 0, 0, 0);

  // Convert back to UTC: 8:00 Colombia = 13:00 UTC
  const nextMondayUTC = new Date(nextMonday.getTime() - colombiaOffset * 3600_000);
  return nextMondayUTC;
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log('══════════════════════════════════════════════════');
  console.log('  AION Vision Hub — Seed Scheduled Reports');
  console.log('══════════════════════════════════════════════════');
  console.log(`Tenant: ${TENANT_ID}\n`);

  const reportName = 'Informe Operativo Semanal';

  // Idempotent check
  const existing = await sql`
    SELECT id FROM scheduled_reports
    WHERE tenant_id = ${TENANT_ID} AND name = ${reportName}
    LIMIT 1
  `;

  if (existing.length > 0) {
    console.log(`  SKIP (exists): ${reportName} [${existing[0].id}]`);
    console.log('\nDone (no changes).');
    await sql.end();
    return;
  }

  const nextRunAt = getNextMondayAt8AMColombia();

  const schedule = {
    cron: '0 8 * * 1', // Every Monday at 8:00 AM
    timezone: 'America/Bogota',
  };

  const recipients = {
    email: ['clavemonitoreo@gmail.com'],
  };

  const filters = {
    includeEvents: true,
    includeIncidents: true,
    includeDeviceHealth: true,
  };

  await sql`
    INSERT INTO scheduled_reports (
      tenant_id, name, type, schedule, recipients, format,
      filters, is_active, next_run_at, created_by,
      created_at, updated_at
    ) VALUES (
      ${TENANT_ID},
      ${reportName},
      'weekly_incidents',
      ${JSON.stringify(schedule)}::jsonb,
      ${JSON.stringify(recipients)}::jsonb,
      'pdf',
      ${JSON.stringify(filters)}::jsonb,
      true,
      ${nextRunAt.toISOString()}::timestamptz,
      ${SYSTEM_USER_ID},
      NOW(),
      NOW()
    )
  `;

  console.log(`  INSERT: ${reportName}`);
  console.log(`    Type:       weekly_incidents`);
  console.log(`    Recipients: clavemonitoreo@gmail.com`);
  console.log(`    Next run:   ${nextRunAt.toISOString()} (next Monday 8:00 AM COT)`);

  console.log('\nDone.');
  await sql.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
