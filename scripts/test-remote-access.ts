/**
 * AION — Remote Access Validation
 * Validates that devices have correct WAN IP / remoteAddress computed,
 * and tests real TCP connectivity to devices via public IPs.
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

async function run() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  AION — Remote Access & WAN IP Validation        ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  let ok = 0, fail = 0;
  const check = (c: boolean, l: string) => { if (c) { ok++; console.log(`  ✓ ${l}`); } else { console.error(`  ✗ ${l}`); fail++; } };

  // 1. Verify sites have wan_ip
  const sitesResp = await get('/sites');
  const sites = sitesResp.data.data;
  console.log('Sites WAN IP check:');

  const EXPECTED_WAN: Record<string, string> = {
    'torre-lucia': '181.58.39.18',
    'altagracia': '181.205.175.18',
    'brescia': '186.97.104.202',
    'portal-plaza': '181.205.175.19',
    'portalegre': '200.58.214.114',
    'san-nicolas': '181.143.16.170',
    'san-sebastian': '186.97.106.252',
    'pisquines': '181.205.202.122',
    'senderos': '38.9.217.12',
    'altos': '130.159.37.188',
    'la-palencia': '181.205.244.180',
    'monitoreo': '181.205.188.99',
  };

  for (const [slug, expectedWan] of Object.entries(EXPECTED_WAN)) {
    const site = sites.find((s: any) => s.slug === slug);
    check(site?.wanIp === expectedWan, `${slug}: WAN IP = ${expectedWan} (got ${site?.wanIp})`);
  }

  // Sites without WAN should be null
  const noWanSites = ['alborada', 'los-danubios', 'patio-bonito', 'lubeck', 'terrabamba', 'terrazzino', 'quintas-sm', 'hospital-san-jeronimo', 'santana'];
  for (const slug of noWanSites) {
    const site = sites.find((s: any) => s.slug === slug);
    check(!site?.wanIp, `${slug}: WAN IP = null (pending) ✓`);
  }

  // 2. Verify devices have remoteAddress
  console.log('\nDevice remoteAddress check:');
  const devResp = await get('/devices?perPage=500');
  const allDevices = devResp.data.data.items;

  // Torre Lucia devices should have remoteAddress
  const torreLucia = sites.find((s: any) => s.slug === 'torre-lucia');
  const torreDevices = allDevices.filter((d: any) => d.siteId === torreLucia?.id);
  const torreWithRemote = torreDevices.filter((d: any) => d.remoteAddress);
  const torreWithPort = torreDevices.filter((d: any) => d.port);

  console.log(`  Torre Lucia: ${torreDevices.length} devices, ${torreWithPort.length} with ports, ${torreWithRemote.length} with remoteAddress`);
  check(torreWithRemote.length === torreWithPort.length, `All Torre Lucia devices with ports have remoteAddress`);

  // Check specific device remoteAddress
  const nvrTorre = torreDevices.find((d: any) => d.deviceSlug === 'nvr-clave');
  if (nvrTorre) {
    check(nvrTorre.remoteAddress === '181.58.39.18:8000', `NVR Clave remoteAddress = 181.58.39.18:8000 (got ${nvrTorre.remoteAddress})`);
    check(nvrTorre.wanIp === '181.58.39.18', `NVR Clave wanIp = 181.58.39.18`);
  }

  // Devices without port should NOT have remoteAddress
  const noPortDevices = allDevices.filter((d: any) => !d.port);
  const noPortWithRemote = noPortDevices.filter((d: any) => d.remoteAddress);
  check(noPortWithRemote.length === 0, `Devices without port have no remoteAddress (${noPortDevices.length} devices, ${noPortWithRemote.length} with remote)`);

  // 3. Test real TCP health check on a known device
  console.log('\nTCP Health Check (real connectivity test):');

  // Test Torre Lucia NVR (181.58.39.18:8000)
  if (nvrTorre) {
    const healthResp = await get(`/devices/${nvrTorre.id}/health`);
    const health = healthResp.data.data;
    console.log(`  NVR Torre Lucia: reachable=${health.reachable}, latency=${health.latencyMs}ms, remote=${health.remoteAddress}`);
    check(health.remoteAddress === '181.58.39.18:8000', `Health check shows correct remoteAddress`);
    check(health.deviceId === nvrTorre.id, `Health check returns correct deviceId`);
    check(typeof health.reachable === 'boolean', `Health check returns reachable boolean`);
    check(health.checkedAt !== null, `Health check returns timestamp`);
  }

  // 4. Test site health check
  console.log('\nSite Health Check (batch):');
  if (torreLucia) {
    const siteHealthResp = await get(`/sites/${torreLucia.id}/health`);
    const siteHealth = siteHealthResp.data.data;
    console.log(`  Torre Lucia site health:`);
    console.log(`    Total: ${siteHealth.summary.total}, Checked: ${siteHealth.summary.checked}, Online: ${siteHealth.summary.online}, Offline: ${siteHealth.summary.offline}, Skipped: ${siteHealth.summary.skipped}`);
    check(siteHealth.site.wanIp === '181.58.39.18', `Site health returns correct WAN IP`);
    check(siteHealth.summary.total === 36, `Site health total = 36`);
    check(siteHealth.summary.checked > 0, `Site health checked > 0 devices`);
    check(siteHealth.devices.length > 0, `Site health returns device results`);

    // Show individual device results
    for (const d of siteHealth.devices.slice(0, 5)) {
      const status = d.reachable ? `✓ ONLINE (${d.latencyMs}ms)` : '✗ OFFLINE';
      console.log(`    ${d.deviceName.padEnd(25)} ${d.remoteAddress.padEnd(22)} ${status}`);
    }
    if (siteHealth.devices.length > 5) {
      console.log(`    ... and ${siteHealth.devices.length - 5} more devices`);
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`REMOTE ACCESS VALIDATION: ${ok} checks passed, ${fail} failed`);
  console.log(`${'═'.repeat(55)}`);

  process.exit(fail > 0 ? 1 : 0);
}

run().catch(err => { console.error('Error:', err); process.exit(1); });
