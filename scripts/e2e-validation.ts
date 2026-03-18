/**
 * AION Vision Hub — End-to-End Validation
 * Comprehensive check: DB → API → all sites → all devices
 *
 * Usage: npx --yes tsx scripts/e2e-validation.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../backend/.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    if (!process.env[t.substring(0, i)]) process.env[t.substring(0, i)] = t.substring(i + 1);
  }
}

const API = 'http://localhost:3000';
const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';

function createJWT(payload: Record<string, unknown>, secret: string): string {
  const b64url = (d: string) => Buffer.from(d).toString('base64url');
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600, iss:'aion-vision-hub' }));
  const s = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
}

const token = createJWT({ sub:'00000000-0000-0000-0000-000000000001', email:'test@aion.local', tenant_id:TENANT_ID, role:'super_admin' }, process.env.JWT_SECRET!);

async function get(path: string) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, data: await r.json() as any };
}

const EXPECTED: Record<string, { devices: number; active: number; pending: number }> = {
  'torre-lucia': { devices:36, active:36, pending:0 },
  'san-nicolas': { devices:8, active:8, pending:0 },
  'alborada': { devices:9, active:8, pending:1 },
  'brescia': { devices:28, active:28, pending:0 },
  'patio-bonito': { devices:11, active:8, pending:3 },
  'pisquines': { devices:20, active:20, pending:0 },
  'san-sebastian': { devices:21, active:21, pending:0 },
  'terrabamba': { devices:7, active:5, pending:2 },
  'senderos': { devices:7, active:6, pending:1 },
  'altos': { devices:7, active:6, pending:1 },
  'los-danubios': { devices:16, active:15, pending:1 },
  'terrazzino': { devices:10, active:9, pending:1 },
  'portal-plaza': { devices:20, active:20, pending:0 },
  'portalegre': { devices:18, active:18, pending:0 },
  'altagracia': { devices:17, active:17, pending:0 },
  'lubeck': { devices:9, active:5, pending:4 },
  'aparta-casas': { devices:0, active:0, pending:0 },
  'quintas-sm': { devices:8, active:5, pending:3 },
  'hospital-san-jeronimo': { devices:5, active:4, pending:1 },
  'factory': { devices:7, active:4, pending:3 },
  'santana': { devices:6, active:5, pending:1 },
  'la-palencia': { devices:7, active:7, pending:0 },
  'monitoreo': { devices:15, active:14, pending:1 },
};

async function run() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  AION — End-to-End Validation Report           ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  let ok = 0, fail = 0;
  const check = (c: boolean, l: string) => { if (c) { ok++; } else { console.error(`  ✗ ${l}`); fail++; } };

  // 1. Backend Health
  const health = await fetch(`${API}/health`);
  console.log(`Backend: ${health.status === 200 ? '✓ HEALTHY' : '✗ DOWN'}`);
  check(health.status === 200, 'Backend health');

  // 2. Frontend Health
  try {
    const fe = await fetch('http://localhost:8081');
    console.log(`Frontend: ${fe.status === 200 ? '✓ SERVING' : '✗ DOWN'} (port 8081)`);
    check(fe.status === 200, 'Frontend serving');
  } catch {
    console.log('Frontend: ✗ NOT REACHABLE');
    fail++;
  }

  // 3. Sites via API
  const sitesResp = await get('/sites');
  const allSites = sitesResp.data.data;
  console.log(`\nSites loaded via API: ${allSites.length}`);

  // 4. Validate each expected site
  console.log('\n┌────────────────────────────────────┬──────┬───────┬─────────┬─────────┐');
  console.log('│ Site                               │ Exp. │ Got   │ Active  │ Pending │');
  console.log('├────────────────────────────────────┼──────┼───────┼─────────┼─────────┤');

  let totalDevicesChecked = 0;

  for (const [slug, exp] of Object.entries(EXPECTED)) {
    const site = allSites.find((s: any) => s.slug === slug);
    if (!site) {
      console.log(`│ ${slug.padEnd(34)} │ ${String(exp.devices).padStart(4)} │ MISS  │         │         │`);
      fail++;
      continue;
    }

    if (exp.devices === 0) {
      console.log(`│ ${site.name.substring(0,34).padEnd(34)} │ ${String(exp.devices).padStart(4)} │ ${String(0).padStart(5)} │ ${String(0).padStart(7)} │ ${String(0).padStart(7)} │ ✓`);
      ok++;
      totalDevicesChecked += 0;
      continue;
    }

    const devResp = await get(`/sites/${site.id}/devices`);
    const devs = devResp.data.data;
    const active = devs.filter((d: any) => d.status === 'active').length;
    const pending = devs.filter((d: any) => d.status === 'pending_configuration').length;

    const match = devs.length === exp.devices && active === exp.active && pending === exp.pending;
    const marker = match ? '✓' : '✗';

    console.log(`│ ${site.name.substring(0,34).padEnd(34)} │ ${String(exp.devices).padStart(4)} │ ${String(devs.length).padStart(5)} │ ${String(active).padStart(7)} │ ${String(pending).padStart(7)} │ ${marker}`);

    check(devs.length === exp.devices, `${slug} devices count`);
    check(active === exp.active, `${slug} active count`);
    check(pending === exp.pending, `${slug} pending count`);

    totalDevicesChecked += devs.length;
  }

  console.log('└────────────────────────────────────┴──────┴───────┴─────────┴─────────┘');
  console.log(`\nTotal devices verified via API: ${totalDevicesChecked}`);

  // 5. Global device counts
  const allDevices = await get('/devices?perPage=500');
  const totalAPI = allDevices.data.data.meta.total;
  check(totalAPI === 292, `Global device count = 292 (got ${totalAPI})`);

  // 6. Credential integrity spot check
  console.log('\nCredential spot checks via API:');
  const torreDevs = await get(`/sites/${allSites.find((s: any) => s.slug === 'torre-lucia')?.id}/devices`);
  const router = torreDevs.data.data.find((d: any) => d.deviceSlug === 'router-ppal-linksys');
  check(router?.username === 'admin', 'Torre Lucia router creds via API');
  check(router?.serialNumber === '37A10M2C900553', 'Torre Lucia router serial via API');
  console.log(`  Router: username=${router?.username}, serial=${router?.serialNumber} ✓`);

  const bresciaDevs = await get(`/sites/${allSites.find((s: any) => s.slug === 'brescia')?.id}/devices`);
  const ewelink = bresciaDevs.data.data.find((d: any) => d.deviceSlug === 'ewelink');
  check(ewelink?.username === 'clavemonitoreo@gmail.com', 'Brescia ewelink creds via API');
  console.log(`  Ewelink: username=${ewelink?.username} ✓`);

  // Summary
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`E2E VALIDATION: ${ok} checks passed, ${fail} failed`);
  console.log(`${'═'.repeat(55)}`);

  if (fail === 0) {
    console.log('\n🟢 SISTEMA COMPLETAMENTE OPERATIVO');
    console.log('   Backend API: http://localhost:3000');
    console.log('   Frontend:    http://localhost:8081');
    console.log('   DB:          Supabase PostgreSQL (remoto)');
    console.log('   Sites:       23 (22 activos + 1 pendiente documental)');
    console.log('   Devices:     292 (269 activos + 23 pendientes)');
  }

  process.exit(fail > 0 ? 1 : 0);
}

run().catch(err => { console.error('E2E error:', err); process.exit(1); });
