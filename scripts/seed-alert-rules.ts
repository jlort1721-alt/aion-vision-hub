/**
 * AION Vision Hub — Seed Default Alert Rules
 * Idempotent: checks by name before inserting, safe to run multiple times.
 *
 * Usage: cd backend/apps/backend-api && npx tsx ../../../scripts/seed-alert-rules.ts
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
// System user UUID used as created_by for seeded rules
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// ── Alert Rule Definitions ──────────────────────────────────
interface AlertRuleSeed {
  name: string;
  description: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>[];
  severity: string;
  cooldown_minutes: number;
  is_active: boolean;
}

const ALERT_RULES: AlertRuleSeed[] = [
  {
    name: 'Dispositivo Offline > 5 min',
    description: 'Alerta cuando un dispositivo pierde conexión por más de 5 minutos',
    conditions: { eventType: 'device_offline', durationMinutes: 5 },
    actions: [
      { type: 'email', template: 'device_offline' },
      { type: 'push', title: 'Dispositivo desconectado' },
    ],
    severity: 'high',
    cooldown_minutes: 30,
    is_active: true,
  },
  {
    name: 'Movimiento fuera de horario',
    description: 'Detecta movimiento en horario nocturno (22:00–06:00)',
    conditions: { eventType: 'motion_detected', timeRange: { start: '22:00', end: '06:00' } },
    actions: [
      { type: 'whatsapp', template: 'motion_alert' },
      { type: 'push', title: 'Movimiento detectado' },
      { type: 'create_incident', priority: 'high' },
    ],
    severity: 'critical',
    cooldown_minutes: 15,
    is_active: true,
  },
  {
    name: 'Acceso denegado múltiple',
    description: 'Múltiples intentos de acceso denegado en ventana de tiempo',
    conditions: { eventType: 'access_denied', threshold: 3, windowMinutes: 10 },
    actions: [
      { type: 'whatsapp', template: 'access_alert' },
      { type: 'email', template: 'access_alert' },
      { type: 'escalation' },
    ],
    severity: 'critical',
    cooldown_minutes: 10,
    is_active: true,
  },
  {
    name: 'Salud de dispositivo degradada',
    description: 'Latencia del dispositivo supera el umbral permitido',
    conditions: { eventType: 'device_health_degraded', latencyMs: 5000 },
    actions: [
      { type: 'email', template: 'health_degraded' },
    ],
    severity: 'medium',
    cooldown_minutes: 60,
    is_active: true,
  },
  {
    name: 'Pérdida de video',
    description: 'Señal de video perdida por más de 2 minutos',
    conditions: { eventType: 'video_loss', durationMinutes: 2 },
    actions: [
      { type: 'whatsapp', template: 'video_loss' },
      { type: 'push', title: 'Pérdida de video' },
      { type: 'create_incident', priority: 'critical' },
    ],
    severity: 'critical',
    cooldown_minutes: 15,
    is_active: true,
  },
  {
    name: 'Puerta forzada',
    description: 'Detección de apertura forzada de puerta',
    conditions: { eventType: 'door_forced', immediate: true },
    actions: [
      { type: 'whatsapp', template: 'door_forced' },
      { type: 'push', title: 'ALERTA: Puerta forzada' },
      { type: 'create_incident', priority: 'critical' },
      { type: 'escalation' },
    ],
    severity: 'critical',
    cooldown_minutes: 5,
    is_active: true,
  },
  {
    name: 'Pánico / Emergencia',
    description: 'Botón de pánico activado — protocolo de emergencia',
    conditions: { eventType: 'panic_button', immediate: true },
    actions: [
      { type: 'whatsapp', template: 'emergency' },
      { type: 'email', template: 'emergency' },
      { type: 'push', title: 'EMERGENCIA ACTIVADA' },
      { type: 'create_incident', priority: 'critical' },
      { type: 'escalation' },
      { type: 'activate_protocol', protocolType: 'intrusion' },
    ],
    severity: 'critical',
    cooldown_minutes: 5,
    is_active: true,
  },
  {
    name: 'Batería baja dispositivo',
    description: 'Nivel de batería del dispositivo por debajo del 20%',
    conditions: { eventType: 'low_battery', thresholdPct: 20 },
    actions: [
      { type: 'email', template: 'low_battery' },
    ],
    severity: 'low',
    cooldown_minutes: 1440,
    is_active: true,
  },
];

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  AION Vision Hub — Seed Alert Rules         ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`Tenant: ${TENANT_ID}\n`);

  let inserted = 0;
  let skipped = 0;

  for (const rule of ALERT_RULES) {
    // Idempotent check: skip if rule with same name already exists for this tenant
    const existing = await sql`
      SELECT id FROM alert_rules
      WHERE tenant_id = ${TENANT_ID} AND name = ${rule.name}
      LIMIT 1
    `;

    if (existing.length > 0) {
      console.log(`  ⏭  SKIP (exists): ${rule.name}`);
      skipped++;
      continue;
    }

    await sql`
      INSERT INTO alert_rules (
        tenant_id, name, description, conditions, actions,
        severity, cooldown_minutes, is_active, created_by,
        trigger_count, created_at, updated_at
      ) VALUES (
        ${TENANT_ID},
        ${rule.name},
        ${rule.description},
        ${JSON.stringify(rule.conditions)}::jsonb,
        ${JSON.stringify(rule.actions)}::jsonb,
        ${rule.severity},
        ${rule.cooldown_minutes},
        ${rule.is_active},
        ${SYSTEM_USER_ID},
        0,
        NOW(),
        NOW()
      )
    `;

    console.log(`  ✅ INSERT: ${rule.name} [${rule.severity}]`);
    inserted++;
  }

  console.log(`\n── Summary ──`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Total:    ${ALERT_RULES.length}`);

  await sql.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
