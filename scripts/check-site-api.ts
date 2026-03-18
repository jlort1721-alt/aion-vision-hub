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

const b64url = (d: string) => Buffer.from(d).toString('base64url');
const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const p = b64url(JSON.stringify({ sub:'00000000-0000-0000-0000-000000000001', email:'test@aion.local', tenant_id:'a0000000-0000-0000-0000-000000000001', role:'super_admin', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600, iss:'aion-vision-hub' }));
const s = crypto.createHmac('sha256', process.env.JWT_SECRET!).update(`${h}.${p}`).digest('base64url');
const token = `${h}.${p}.${s}`;

const r = await fetch('http://localhost:3000/sites', { headers: { Authorization: `Bearer ${token}` } });
const data = await r.json() as any;
const tl = data.data.find((s: any) => s.slug === 'torre-lucia');
console.log('Torre Lucia site keys:', Object.keys(tl));
console.log('wanIp:', tl.wanIp);
console.log('wan_ip:', tl.wan_ip);
console.log('Full object:', JSON.stringify(tl, null, 2));
