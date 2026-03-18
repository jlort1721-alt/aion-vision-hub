/**
 * AION Vision Hub — Monitoring Import Validation Test
 * Runs assertions against the database to verify import integrity.
 *
 * Usage: npx tsx scripts/monitoring-import-test.ts
 */
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const sql = postgres(process.env.DATABASE_URL!, { max: 3, idle_timeout: 10 });
const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

async function run() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  Monitoring Import — Validation Test Suite     ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  // ── Sites ──
  console.log('Sites:');
  const sites = await sql`SELECT COUNT(*) as c FROM public.sites WHERE tenant_id = ${TENANT_ID} AND slug IS NOT NULL`;
  assert(Number(sites[0].c) >= 23, `At least 23 sites with slug (got ${sites[0].c})`);

  const apartaCasas = await sql`SELECT status FROM public.sites WHERE tenant_id = ${TENANT_ID} AND slug = 'aparta-casas'`;
  assert(apartaCasas.length === 1, 'Aparta Casas exists');
  assert(apartaCasas[0]?.status === 'pending_configuration', 'Aparta Casas is pending_configuration');

  const activeSites = await sql`SELECT COUNT(*) as c FROM public.sites WHERE tenant_id = ${TENANT_ID} AND slug IS NOT NULL AND status = 'active'`;
  assert(Number(activeSites[0].c) >= 22, `At least 22 active sites (got ${activeSites[0].c})`);

  // ── Devices total ──
  console.log('\nDevices:');
  const totalDevices = await sql`SELECT COUNT(*) as c FROM public.devices WHERE tenant_id = ${TENANT_ID}`;
  assert(Number(totalDevices[0].c) === 292, `Total devices = 292 (got ${totalDevices[0].c})`);

  const activeDevices = await sql`SELECT COUNT(*) as c FROM public.devices WHERE tenant_id = ${TENANT_ID} AND status = 'active'`;
  assert(Number(activeDevices[0].c) === 269, `Active devices = 269 (got ${activeDevices[0].c})`);

  const pendingDevices = await sql`SELECT COUNT(*) as c FROM public.devices WHERE tenant_id = ${TENANT_ID} AND status = 'pending_configuration'`;
  assert(Number(pendingDevices[0].c) === 23, `Pending devices = 23 (got ${pendingDevices[0].c})`);

  // ── No duplicates ──
  console.log('\nDuplicates:');
  const dupes = await sql`SELECT site_id, device_slug, COUNT(*) as cnt FROM public.devices WHERE tenant_id = ${TENANT_ID} AND device_slug IS NOT NULL GROUP BY site_id, device_slug HAVING COUNT(*) > 1`;
  assert(dupes.length === 0, `No duplicate device keys (found ${dupes.length})`);

  // ── Device counts per site ──
  console.log('\nPer-site counts:');
  const expected: Record<string, { total: number; pending: number }> = {
    'torre-lucia': { total: 36, pending: 0 },
    'san-nicolas': { total: 8, pending: 0 },
    'alborada': { total: 9, pending: 1 },
    'brescia': { total: 28, pending: 0 },
    'patio-bonito': { total: 11, pending: 3 },
    'pisquines': { total: 20, pending: 0 },
    'san-sebastian': { total: 21, pending: 0 },
    'terrabamba': { total: 7, pending: 2 },
    'senderos': { total: 7, pending: 1 },
    'altos': { total: 7, pending: 1 },
    'los-danubios': { total: 16, pending: 1 },
    'terrazzino': { total: 10, pending: 1 },
    'portal-plaza': { total: 20, pending: 0 },
    'portalegre': { total: 18, pending: 0 },
    'altagracia': { total: 17, pending: 0 },
    'lubeck': { total: 9, pending: 4 },
    'aparta-casas': { total: 0, pending: 0 },
    'quintas-sm': { total: 8, pending: 3 },
    'hospital-san-jeronimo': { total: 5, pending: 1 },
    'factory': { total: 7, pending: 3 },
    'santana': { total: 6, pending: 1 },
    'la-palencia': { total: 7, pending: 0 },
    'monitoreo': { total: 15, pending: 1 },
  };

  for (const [slug, exp] of Object.entries(expected)) {
    const row = await sql`
      SELECT COUNT(d.id) as total,
        COUNT(CASE WHEN d.status = 'pending_configuration' THEN 1 END) as pending
      FROM public.sites s
      LEFT JOIN public.devices d ON d.site_id = s.id
      WHERE s.tenant_id = ${TENANT_ID} AND s.slug = ${slug}
      GROUP BY s.id`;

    if (row.length === 0 && exp.total === 0) {
      assert(true, `${slug}: 0 devices (expected 0)`);
      continue;
    }
    const t = Number(row[0]?.total ?? 0);
    const p = Number(row[0]?.pending ?? 0);
    assert(t === exp.total, `${slug}: ${t} devices (expected ${exp.total})`);
    assert(p === exp.pending, `${slug}: ${p} pending (expected ${exp.pending})`);
  }

  // ── Credentials integrity spot checks ──
  console.log('\nCredentials spot checks:');
  const torreRouter = await sql`
    SELECT d.username, d.password, d.serial_number, d.aps_count
    FROM public.devices d JOIN public.sites s ON d.site_id = s.id
    WHERE s.slug = 'torre-lucia' AND d.device_slug = 'router-ppal-linksys'`;
  assert(torreRouter[0]?.username === 'admin', 'Torre Lucia router username = admin');
  assert(torreRouter[0]?.password === 'Seg12345', 'Torre Lucia router password = Seg12345');
  assert(torreRouter[0]?.serial_number === '37A10M2C900553', 'Torre Lucia router serial correct');
  assert(Number(torreRouter[0]?.aps_count) === 3, 'Torre Lucia router aps = 3');

  const bresciaEwelink = await sql`
    SELECT d.username, d.password
    FROM public.devices d JOIN public.sites s ON d.site_id = s.id
    WHERE s.slug = 'brescia' AND d.device_slug = 'ewelink'`;
  assert(bresciaEwelink[0]?.username === 'clavemonitoreo@gmail.com', 'Brescia ewelink username correct');
  assert(bresciaEwelink[0]?.password === 'Clave.seg2023', 'Brescia ewelink password correct');

  const monitoreoServer = await sql`
    SELECT d.ip_address, d.type
    FROM public.devices d JOIN public.sites s ON d.site_id = s.id
    WHERE s.slug = 'monitoreo' AND d.device_slug = 'equipo-servidor'`;
  assert(monitoreoServer[0]?.ip_address === '192.168.88.242', 'Monitoreo server IP correct');
  assert(monitoreoServer[0]?.type === 'server', 'Monitoreo server type correct');

  // ── Device types coverage ──
  console.log('\nDevice type coverage:');
  const types = await sql`SELECT DISTINCT type FROM public.devices WHERE tenant_id = ${TENANT_ID} ORDER BY type`;
  const typeList = types.map(t => t.type);
  for (const requiredType of ['network_wan', 'network_lan', 'router', 'xvr', 'dvr', 'nvr', 'camera', 'access_control', 'intercom', 'domotic', 'cloud_account_ewelink', 'cloud_account_hik', 'server', 'other', 'access_point']) {
    assert(typeList.includes(requiredType), `Type '${requiredType}' present`);
  }

  // ── Summary ──
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(50)}`);

  await sql.end();
  process.exit(failed > 0 ? 1 : 0);
}

run();
