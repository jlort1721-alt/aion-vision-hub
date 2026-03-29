/**
 * AION Vision Hub — API Functional Test
 * Tests sites and devices endpoints with real data from DB.
 *
 * Usage: npx tsx scripts/api-test.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend .env
const envPath = path.resolve(__dirname, '../backend/.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.substring(0, i), v = t.substring(i + 1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const API_URL = 'http://localhost:3000';
const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const JWT_SECRET = process.env.JWT_SECRET!;

// ── Simple JWT generation (HS256) ──
function createJWT(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const b64url = (data: string) => Buffer.from(data).toString('base64url');
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: 'aion-vision-hub',
  }));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  return `${headerB64}.${payloadB64}.${signature}`;
}

const token = createJWT({
  sub: '00000000-0000-0000-0000-000000000001',
  email: 'test@aion.local',
  tenant_id: TENANT_ID,
  role: 'super_admin',
}, JWT_SECRET);

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ FAIL: ${label}`); failed++; }
}

async function apiGet(path: string) {
  const resp = await fetch(`${API_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return { status: resp.status, data: await resp.json() as any };
}

async function run() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  AION API — Functional Test Suite              ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  // ── Health ──
  console.log('Health:');
  const health = await fetch(`${API_URL}/health`);
  assert(health.status === 200, `GET /health → 200 (got ${health.status})`);
  const healthData = await health.json() as any;
  assert(healthData.status === 'healthy', `Status is healthy`);

  // ── Sites ──
  console.log('\nSites API:');
  const sitesResp = await apiGet('/sites');
  assert(sitesResp.status === 200, `GET /sites → 200 (got ${sitesResp.status})`);
  assert(sitesResp.data.success === true, 'Response success=true');

  const sitesData = sitesResp.data.data;
  assert(Array.isArray(sitesData), 'Sites is array');
  assert(sitesData.length >= 23, `At least 23 sites (got ${sitesData.length})`);

  // Find Torre Lucia
  const torreLucia = sitesData.find((s: any) => s.slug === 'torre-lucia');
  assert(!!torreLucia, 'Torre Lucia found by slug');
  assert(torreLucia?.status === 'active', 'Torre Lucia is active');

  // Find Aparta Casas
  const apartaCasas = sitesData.find((s: any) => s.slug === 'aparta-casas');
  assert(!!apartaCasas, 'Aparta Casas found');
  assert(apartaCasas?.status === 'pending_configuration', 'Aparta Casas is pending_configuration');

  // ── Site by ID ──
  if (torreLucia) {
    const siteById = await apiGet(`/sites/${torreLucia.id}`);
    assert(siteById.status === 200, `GET /sites/:id → 200`);
    assert(siteById.data.data.name === torreLucia.name, 'Site name matches');
  }

  // ── Devices for Torre Lucia ──
  if (torreLucia) {
    console.log('\nDevices API (Torre Lucia):');
    const devicesResp = await apiGet(`/sites/${torreLucia.id}/devices`);
    assert(devicesResp.status === 200, `GET /sites/:id/devices → 200`);

    const devicesData = devicesResp.data.data;
    assert(Array.isArray(devicesData), 'Devices is array');
    assert(devicesData.length === 36, `Torre Lucia has 36 devices (got ${devicesData.length})`);

    // Check device types present
    const types = new Set(devicesData.map((d: any) => d.type));
    assert(types.has('camera'), 'Has cameras');
    assert(types.has('router'), 'Has router');
    assert(types.has('nvr'), 'Has NVR');
    assert(types.has('xvr'), 'Has XVR');
    assert(types.has('access_control'), 'Has access_control');
    assert(types.has('intercom'), 'Has intercom');
    assert(types.has('domotic'), 'Has domotic');
    assert(types.has('cloud_account_ewelink'), 'Has ewelink');
    assert(types.has('cloud_account_hik'), 'Has hik-connect');

    // Check credentials exist (verify fields are populated, not specific values)
    const router = devicesData.find((d: any) => d.deviceSlug === 'router-ppal-linksys');
    assert(!!router, 'Router found');
    assert(!!router?.username, 'Router has username');
    assert(!!router?.password, 'Router has password');
    assert(!!router?.serialNumber, 'Router has serial number');
  }

  // ── Devices list with pagination ──
  console.log('\nDevices API (paginated):');
  const devicesAll = await apiGet('/devices?perPage=500');
  assert(devicesAll.status === 200, `GET /devices → 200`);
  assert(devicesAll.data.data.meta.total === 292, `Total devices = 292 (got ${devicesAll.data.data.meta.total})`);

  // ── Devices filtered by status ──
  const pendingDevices = await apiGet('/devices?status=pending_configuration&perPage=500');
  assert(pendingDevices.status === 200, `GET /devices?status=pending_configuration → 200`);
  assert(pendingDevices.data.data.meta.total === 23, `Pending devices = 23 (got ${pendingDevices.data.data.meta.total})`);

  const activeDevices = await apiGet('/devices?status=active&perPage=500');
  assert(activeDevices.status === 200, `GET /devices?status=active → 200`);
  assert(activeDevices.data.data.meta.total === 269, `Active devices = 269 (got ${activeDevices.data.data.meta.total})`);

  // ── Devices filtered by type ──
  console.log('\nDevices by type:');
  const cameras = await apiGet('/devices?type=camera&perPage=500');
  assert(cameras.data.data.meta.total === 61, `Cameras = 61 (got ${cameras.data.data.meta.total})`);

  const intercoms = await apiGet('/devices?type=intercom&perPage=500');
  assert(intercoms.data.data.meta.total === 26, `Intercoms = 26 (got ${intercoms.data.data.meta.total})`);

  // ── Devices filtered by site ──
  if (torreLucia) {
    const bySite = await apiGet(`/devices?siteId=${torreLucia.id}&perPage=500`);
    assert(bySite.data.data.meta.total === 36, `Torre Lucia devices via /devices?siteId = 36 (got ${bySite.data.data.meta.total})`);
  }

  // ── Device by ID ──
  if (devicesAll.data.data.items.length > 0) {
    console.log('\nDevice by ID:');
    const firstDevice = devicesAll.data.data.items[0];
    const deviceById = await apiGet(`/devices/${firstDevice.id}`);
    assert(deviceById.status === 200, `GET /devices/:id → 200`);
    assert(deviceById.data.data.id === firstDevice.id, 'Device ID matches');
  }

  // ── Device health endpoint ──
  if (devicesAll.data.data.items.length > 0) {
    const firstDevice = devicesAll.data.data.items[0];
    const healthResp = await apiGet(`/devices/${firstDevice.id}/health`);
    assert(healthResp.status === 200, `GET /devices/:id/health → 200`);
    assert(healthResp.data.data.deviceId === firstDevice.id, 'Health deviceId matches');
  }

  // ── Summary ──
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`API TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(50)}`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error('Test error:', err); process.exit(1); });
