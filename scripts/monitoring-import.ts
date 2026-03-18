/**
 * AION Vision Hub — Monitoring Station Import Script
 * Idempotent: safe to run multiple times without duplicating data
 *
 * Usage: cd backend/apps/backend-api && npx tsx ../../../scripts/monitoring-import.ts
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

// ════════════════════════════════════════════════════════════
// SITES DATA
// ════════════════════════════════════════════════════════════
interface SiteData {
  name: string; slug: string; siteSheet: string; address: string; status: string;
}

const SITES: SiteData[] = [
  { name: 'Torre Lucia', slug: 'torre-lucia', siteSheet: 'Torre Lucia', address: 'CALLE 75 SUR #34-280 SABANETA', status: 'active' },
  { name: 'San Nicolás', slug: 'san-nicolas', siteSheet: 'San Nicolas', address: 'Cl. 35 #58-10, Rionegro', status: 'active' },
  { name: 'Alborada 9-10', slug: 'alborada', siteSheet: 'Alborada', address: 'Dg 93 #39-60, Santa Monica, Campo Alegre', status: 'active' },
  { name: 'Brescia', slug: 'brescia', siteSheet: 'Brescia', address: 'CALLE 47 #19 SUR 40', status: 'active' },
  { name: 'Patio Bonito', slug: 'patio-bonito', siteSheet: 'Patio Bonito', address: 'Tv. 5A #45-163, El Poblado, Medellín', status: 'active' },
  { name: 'Los Pisquines P.H.', slug: 'pisquines', siteSheet: 'Pisquines', address: 'CR 43 #23-29', status: 'active' },
  { name: 'San Sebastián', slug: 'san-sebastian', siteSheet: 'San Sebastian', address: 'CARRERA 79 #34-26, Laureles', status: 'active' },
  { name: 'Propiedad Terrabamba', slug: 'terrabamba', siteSheet: 'Terrabamba', address: 'Entrada al Gaitero - Restaurante El Camionero vía MDE - STA FÉ', status: 'active' },
  { name: 'Senderos de Calasanz', slug: 'senderos', siteSheet: 'Senderos', address: 'Cra 81A #49-89, Calasanz, La América', status: 'active' },
  { name: 'Altos del Rosario', slug: 'altos', siteSheet: 'Altos', address: 'Cra. 84 #34B-110, Simón Bolívar, Laureles', status: 'active' },
  { name: 'Danubios', slug: 'los-danubios', siteSheet: 'Los Danubios', address: 'Cl. 47D #72-183, Laureles - Estadio', status: 'active' },
  { name: 'Terrazzino', slug: 'terrazzino', siteSheet: 'Terrazzino', address: 'Cl. 22A Sur #46-34, Zona 2, Envigado, Antioquia', status: 'active' },
  { name: 'Portal Plaza', slug: 'portal-plaza', siteSheet: 'Portal Plaza', address: 'Cra. 39 #48-11, La Candelaria, Medellín', status: 'active' },
  { name: 'Portalegre', slug: 'portalegre', siteSheet: 'Portalegre', address: 'Cl 45F #70A-75, Laureles - Estadio, Medellín', status: 'active' },
  { name: 'Altagracia', slug: 'altagracia', siteSheet: 'Altagracia', address: 'CARRERA 39 #48-19', status: 'active' },
  { name: 'Lubeck', slug: 'lubeck', siteSheet: 'Lubeck', address: 'CALLE 36 #64A-29, Laureles - Estadio, Medellín', status: 'active' },
  { name: 'Aparta Casas', slug: 'aparta-casas', siteSheet: '', address: 'Carrera 53B #84A-03 Itagüí', status: 'pending_configuration' },
  { name: 'Quintas de Santa María', slug: 'quintas-sm', siteSheet: 'Quintas SM', address: 'Cra. 10, San Jerónimo, Antioquia', status: 'active' },
  { name: 'Hospital San Jerónimo', slug: 'hospital-san-jeronimo', siteSheet: 'Hospital San Jerónimo', address: 'Hospital San Jerónimo de Antioquia', status: 'active' },
  { name: 'Hotel Eutopiq / Factory / Smach / BBC Bodega La 33', slug: 'factory', siteSheet: 'Factory', address: 'Carrera 69 # Circular 1-32 Laureles, frente de la UPB', status: 'active' },
  { name: 'Santa Ana de los Caballeros', slug: 'santana', siteSheet: 'Santana', address: 'Transversal 74 #2-15 Medellín', status: 'active' },
  { name: 'Edificio La Palencia P.H.', slug: 'la-palencia', siteSheet: 'La Palencia', address: 'CR46 #50-28 Medellín', status: 'active' },
  { name: 'Central de Monitoreo', slug: 'monitoreo', siteSheet: 'Monitoreo', address: 'Central de monitoreo', status: 'active' },
];

// ════════════════════════════════════════════════════════════
// DEVICES DATA
// ════════════════════════════════════════════════════════════
interface DeviceData {
  siteSlug: string; name: string; deviceSlug: string; type: string;
  ipAddress?: string; subnetMask?: string; gateway?: string; operator?: string;
  port?: number; username?: string; password?: string; serial?: string;
  aps?: number; antennas?: number; cameras?: number; analogCameras?: number;
  connection?: string; appName?: string; appId?: string;
  extension?: string; outboundCall?: string; note?: string;
  status: string; missingFields?: string; sourceSheet: string;
}

function n(v: string | undefined): string | null {
  if (!v || v === '' || v === 'N/A' || v === 'n/a') return null;
  return v.trim();
}
function nInt(v: string | number | undefined): number | null {
  if (v === undefined || v === null || v === '' || v === 'N/A') return null;
  const num = typeof v === 'number' ? v : parseInt(v, 10);
  return isNaN(num) ? null : num;
}

const DEVICES: DeviceData[] = [
  // ── ALBORADA (9 devices) ──
  { siteSlug:'alborada', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', operator:'Tigo', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Alborada' },
  { siteSlug:'alborada', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.0.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Alborada' },
  { siteSlug:'alborada', name:'Router Ppal', deviceSlug:'router-ppal', type:'router', ipAddress:'192.168.0.1', port:443, username:'admin', password:'Seg12345', serial:'224AY7006126', status:'active', sourceSheet:'Alborada' },
  { siteSlug:'alborada', name:'XVR Clave', deviceSlug:'xvr-clave', type:'xvr', ipAddress:'192.168.0.194', username:'admin', password:'Clave.seg2023', serial:'AL02505PAJD40E7', cameras:16, status:'active', sourceSheet:'Alborada' },
  { siteSlug:'alborada', name:'Control Ppal', deviceSlug:'control-ppal', type:'access_control', ipAddress:'192.168.0.199', port:8000, username:'admin', password:'Seg12345', serial:'DS-K1T321MFWX20240701V030903EN5G191190', connection:'Hik-Connect', status:'active', sourceSheet:'Alborada' },
  { siteSlug:'alborada', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Alborada' },
  { siteSlug:'alborada', name:'Hik-Connect', deviceSlug:'hik-connect', type:'cloud_account_hik', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Alborada' },
  { siteSlug:'alborada', name:'Citofono vehicular', deviceSlug:'citofono-vehicular', type:'intercom', ipAddress:'192.168.0.165', username:'admin', password:'admin', extension:'1029', outboundCall:'2000', status:'active', sourceSheet:'Alborada' },
  { siteSlug:'alborada', name:'Citofono peatonal', deviceSlug:'citofono-peatonal', type:'intercom', ipAddress:'192.168.0.125', username:'admin', password:'admin', extension:'1028', outboundCall:'2000', status:'active', sourceSheet:'Alborada' },

  // ── ALTAGRACIA (17 devices) ──
  { siteSlug:'altagracia', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', ipAddress:'181.205.175.18', subnetMask:'255.255.255.248', gateway:'181.205.175.17', status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.1.1', port:8080, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'Router Ppal - Linksys', deviceSlug:'router-ppal-linksys', type:'router', ipAddress:'192.168.1.1', port:8080, username:'admin', password:'Seg12345', aps:2, antennas:3, status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'DVR', deviceSlug:'dvr', type:'dvr', ipAddress:'192.168.1.238', port:8030, username:'admin', password:'Clave.seg2023', serial:'C54813005', cameras:30, analogCameras:23, status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'Control de Acceso', deviceSlug:'control-de-acceso', type:'access_control', ipAddress:'192.168.1.42', port:8050, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'Cam. Calle Sur', deviceSlug:'cam-calle-sur', type:'camera', ipAddress:'192.168.1.22', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'Cam. Ingreso', deviceSlug:'cam-ingreso', type:'camera', ipAddress:'192.168.1.23', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'Cam. Pasillo', deviceSlug:'cam-pasillo', type:'camera', ipAddress:'192.168.1.24', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'Cam. Entrada Ascensor', deviceSlug:'cam-entrada-ascensor', type:'camera', ipAddress:'192.168.1.25', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'Cam. Ascensor', deviceSlug:'cam-ascensor', type:'camera', ipAddress:'192.168.1.5', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'Domotico Sirena', deviceSlug:'domotico-sirena', type:'domotic', appName:'Altagracia Sirena', appId:'1001d6df1b', status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'Domotico Energía', deviceSlug:'domotico-energia', type:'domotic', appName:'Altagracia Energía', appId:'10018b9751', status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'Hik-Connect', deviceSlug:'hik-connect', type:'cloud_account_hik', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'Cam. Placas (Portal)', deviceSlug:'cam-placas-portal', type:'camera', ipAddress:'192.168.1.50', port:8010, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'Cam. Calle Norte', deviceSlug:'cam-calle-norte', type:'camera', ipAddress:'192.168.1.21', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Altagracia' },
  { siteSlug:'altagracia', name:'Citofono', deviceSlug:'citofono', type:'intercom', ipAddress:'192.168.1.188', username:'admin', password:'admin', serial:'00100400FV02001000000c383e292080', extension:'1004', outboundCall:'2000', status:'active', sourceSheet:'Altagracia' },

  // ── ALTOS DEL ROSARIO (7 devices) ──
  { siteSlug:'altos', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', ipAddress:'130.159.37.188', subnetMask:'255.255.255.192', gateway:'190.159.37.129', status:'active', sourceSheet:'Altos' },
  { siteSlug:'altos', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.0.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Altos' },
  { siteSlug:'altos', name:'Router Ppal', deviceSlug:'router-ppal', type:'router', ipAddress:'192.168.0.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Altos' },
  { siteSlug:'altos', name:'DVR', deviceSlug:'dvr', type:'dvr', ipAddress:'192.168.0.50', username:'admin', password:'Clave.seg2023', serial:'iDS-7216HQHI-M1/S16202212', cameras:16, connection:'IP', status:'active', sourceSheet:'Altos' },
  { siteSlug:'altos', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Altos' },
  { siteSlug:'altos', name:'Hik-Connect', deviceSlug:'hik-connect', type:'cloud_account_hik', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Altos' },
  { siteSlug:'altos', name:'Citofono vehicular', deviceSlug:'citofono-vehicular', type:'intercom', username:'admin', password:'admin', extension:'1038', outboundCall:'1000', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Altos' },

  // ── BRESCIA (28 devices) ──
  { siteSlug:'brescia', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', ipAddress:'186.97.104.202', subnetMask:'255.255.255.248', gateway:'186.97.104.201', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.20.1', port:80, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Router Ppal - Linksys', deviceSlug:'router-ppal-linksys', type:'router', ipAddress:'192.168.20.1', port:8080, username:'admin', password:'Seg12345', aps:3, antennas:2, status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'XVR', deviceSlug:'xvr', type:'xvr', ipAddress:'192.168.20.114', port:37777, username:'admin', password:'Clave.seg2023', serial:'AK01E46PAZ0BA9C', cameras:16, analogCameras:7, status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Control de acceso', deviceSlug:'control-de-acceso', type:'access_control', ipAddress:'192.168.20.16', port:8050, username:'admin', password:'seg12345', connection:'IP', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Placas N1', deviceSlug:'placas-n1', type:'other', ipAddress:'192.168.20.22', port:8030, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Placas Sotano', deviceSlug:'placas-sotano', type:'other', ipAddress:'192.168.20.23', port:8020, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Ascensor', deviceSlug:'ascensor', type:'other', ipAddress:'192.168.20.36', port:8040, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'LOBBY B', deviceSlug:'lobby-b', type:'other', ipAddress:'192.168.20.5', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'JARDIN PP', deviceSlug:'jardin-pp', type:'other', ipAddress:'192.168.20.2', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'ENTRADA SOTANO', deviceSlug:'entrada-sotano', type:'other', ipAddress:'192.168.20.18', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Domotico Veh 1', deviceSlug:'domotico-veh-1', type:'domotic', appName:'BRE 1', appId:'1002010cdd', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Domotico Veh 2', deviceSlug:'domotico-veh-2', type:'domotic', appName:'BRE 2', appId:'1002011d9e', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Domotico Energía', deviceSlug:'domotico-energia', type:'domotic', appName:'Brescia energía', appId:'10020168e6+1', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Domotico Sirena Sotano', deviceSlug:'domotico-sirena-sotano', type:'domotic', appName:'Brescia Sirena Sotano', appId:'10018c0b11', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Domotico Letrero', deviceSlug:'domotico-letrero', type:'domotic', appName:'Brescia Reflector Letrero', appId:'10018cc0dd', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'SOTANO B', deviceSlug:'sotano-b', type:'other', ipAddress:'192.168.20.3', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'PEATONAL', deviceSlug:'peatonal', type:'other', ipAddress:'192.168.20.8', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'N1 A', deviceSlug:'n1-a', type:'other', ipAddress:'192.168.20.7', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Domotico Reflector Fachada', deviceSlug:'domotico-reflector-fachada', type:'domotic', appName:'BRESCIA REFLECTOR FACHADA', appId:'10018cce50', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Domotico Luces 2', deviceSlug:'domotico-luces-2', type:'domotic', appName:'Brescia Luces 2', appId:'10020137a0', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Domotico Luces', deviceSlug:'domotico-luces', type:'domotic', appName:'Brescia Luces', appId:'10020142eb', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Domotico Sirena Ppal', deviceSlug:'domotico-sirena-ppal', type:'domotic', appName:'Brescia Sirena Principal', appId:'100150f50e0', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'SOTANO A', deviceSlug:'sotano-a', type:'other', ipAddress:'192.168.20.4', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'ENTRADA PP', deviceSlug:'entrada-pp', type:'other', ipAddress:'192.168.20.6', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Citofono Peatonal', deviceSlug:'citofono-peatonal', type:'intercom', ipAddress:'192.168.20.110', username:'admin', password:'admin', serial:'00100400FV02001000000c383e292380', extension:'1023', outboundCall:'2000', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Citofono vehicular', deviceSlug:'citofono-vehicular', type:'intercom', ipAddress:'192.168.20.127', username:'admin', password:'admin', serial:'00100400FV02001000000c383e2920e2', extension:'1024', outboundCall:'2000', status:'active', sourceSheet:'Brescia' },
  { siteSlug:'brescia', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Brescia' },

  // ── FACTORY (7 devices) ──
  { siteSlug:'factory', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', ipAddress:'192.168.7.1', status:'active', sourceSheet:'Factory' },
  { siteSlug:'factory', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.7.1', status:'pending_configuration', missingFields:'username, password', sourceSheet:'Factory' },
  { siteSlug:'factory', name:'AP', deviceSlug:'ap', type:'access_point', username:'admin', password:'seg12345', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Factory' },
  { siteSlug:'factory', name:'XVR Puesto', deviceSlug:'xvr-puesto', type:'xvr', port:37777, username:'admin', password:'Clave.seg2023', serial:'9B02D09PAZ4C0D2', cameras:4, status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Factory' },
  { siteSlug:'factory', name:'Domotico Sirena E', deviceSlug:'domotico-sirena-e', type:'domotic', appName:'S HOTEL E', appId:'1001d5ac63', status:'active', sourceSheet:'Factory' },
  { siteSlug:'factory', name:'Domotico Sirena F', deviceSlug:'domotico-sirena-f', type:'domotic', appName:'S HOTEL F', appId:'10018ba98f', status:'active', sourceSheet:'Factory' },
  { siteSlug:'factory', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Factory' },

  // ── HOSPITAL SAN JERÓNIMO (5 devices) ──
  { siteSlug:'hospital-san-jeronimo', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', operator:'Starlink', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Hospital San Jerónimo' },
  { siteSlug:'hospital-san-jeronimo', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.20.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Hospital San Jerónimo' },
  { siteSlug:'hospital-san-jeronimo', name:'Router Ppal', deviceSlug:'router-ppal', type:'router', ipAddress:'192.168.20.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Hospital San Jerónimo' },
  { siteSlug:'hospital-san-jeronimo', name:'XVR Clave', deviceSlug:'xvr-clave', type:'xvr', ipAddress:'192.168.20.8', port:8000, username:'admin', password:'Clave.seg2023', serial:'AE01C60PAZA4D94', status:'active', sourceSheet:'Hospital San Jerónimo' },
  { siteSlug:'hospital-san-jeronimo', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Hospital San Jerónimo' },

  // ── LA PALENCIA (7 devices) ──
  { siteSlug:'la-palencia', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', ipAddress:'181.205.244.180', subnetMask:'255.255.255.248', status:'active', sourceSheet:'La Palencia' },
  { siteSlug:'la-palencia', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.1.1', port:443, username:'admin', password:'seg12345', status:'active', sourceSheet:'La Palencia' },
  { siteSlug:'la-palencia', name:'DVR', deviceSlug:'dvr', type:'dvr', ipAddress:'192.168.1.105', port:8000, username:'admin', password:'Clave.seg2023', serial:'Z3337624', cameras:16, analogCameras:9, status:'active', sourceSheet:'La Palencia' },
  { siteSlug:'la-palencia', name:'Cámara', deviceSlug:'camara-192.168.1.5', type:'camera', ipAddress:'192.168.1.5', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'La Palencia' },
  { siteSlug:'la-palencia', name:'Cámara', deviceSlug:'camara-192.168.1.8', type:'camera', ipAddress:'192.168.1.8', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'La Palencia' },
  { siteSlug:'la-palencia', name:'Cámara', deviceSlug:'camara-192.168.1.9', type:'camera', ipAddress:'192.168.1.9', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'La Palencia' },
  { siteSlug:'la-palencia', name:'Cámara', deviceSlug:'camara-192.168.1.26', type:'camera', ipAddress:'192.168.1.26', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'La Palencia' },

  // ── LOS DANUBIOS (16 devices) ──
  { siteSlug:'los-danubios', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', operator:'Movistar', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Los Danubios' },
  { siteSlug:'los-danubios', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.20.1', port:443, username:'admin', password:'seg12345', status:'active', sourceSheet:'Los Danubios' },
  { siteSlug:'los-danubios', name:'Router Ppal', deviceSlug:'router-ppal', type:'router', ipAddress:'192.168.20.1', port:443, username:'admin', password:'seg12345', serial:'22C969000739', status:'active', sourceSheet:'Los Danubios' },
  { siteSlug:'los-danubios', name:'XVR Puesto', deviceSlug:'xvr-puesto', type:'xvr', ipAddress:'192.168.20.121', port:37777, username:'CLAVE', password:'Clave.seg2023', serial:'AH0306CPAZ5EA1A', cameras:16, status:'active', sourceSheet:'Los Danubios' },
  { siteSlug:'los-danubios', name:'XVR Clave', deviceSlug:'xvr-clave', type:'xvr', ipAddress:'192.168.20.120', port:8020, username:'admin', password:'Clave.seg2023', serial:'AJ00421PAZF2E60', cameras:9, status:'active', sourceSheet:'Los Danubios' },
  { siteSlug:'los-danubios', name:'Control Ppal', deviceSlug:'control-ppal', type:'access_control', ipAddress:'192.168.20.6', port:8000, username:'admin', password:'seg12345', serial:'AC4529677', connection:'Hik-conncet', status:'active', sourceSheet:'Los Danubios' },
  { siteSlug:'los-danubios', name:'Control T1', deviceSlug:'control-t1', type:'access_control', ipAddress:'192.168.20.8', port:8000, username:'admin', password:'seg12345', serial:'FK4627117', connection:'Hik-conncet', status:'active', sourceSheet:'Los Danubios' },
  { siteSlug:'los-danubios', name:'Control T2', deviceSlug:'control-t2', type:'access_control', ipAddress:'192.168.20.4', port:8000, username:'admin', password:'seg12345', serial:'FK4627103', connection:'Hik-conncet', status:'active', sourceSheet:'Los Danubios' },
  { siteSlug:'los-danubios', name:'Domotico Vehicular Visitantes', deviceSlug:'domotico-vehicular-visitantes', type:'domotic', appName:'Dan 3', appId:'10018c5e41', status:'active', sourceSheet:'Los Danubios' },
  { siteSlug:'los-danubios', name:'Domotico apert. Veh. Res.', deviceSlug:'domotico-apert-veh-res', type:'domotic', appName:'Dan 1', appId:'10022aab73', status:'active', sourceSheet:'Los Danubios' },
  { siteSlug:'los-danubios', name:'Domotico cierre Veh. Res.', deviceSlug:'domotico-cierre-veh-res', type:'domotic', appName:'Dan 2', appId:'10022aab06', status:'active', sourceSheet:'Los Danubios' },
  { siteSlug:'los-danubios', name:'Domotico Sirena', deviceSlug:'domotico-sirena', type:'domotic', appName:'Sirena Danubios', appId:'10022a597a', status:'active', sourceSheet:'Los Danubios' },
  { siteSlug:'los-danubios', name:'Citofono vehicular', deviceSlug:'citofono-vehicular', type:'intercom', ipAddress:'192.168.20.12', username:'admin', password:'admin', serial:'00100400FV02001000000c383e2de4ff', extension:'1026', outboundCall:'2000', status:'active', sourceSheet:'Los Danubios' },
  { siteSlug:'los-danubios', name:'Citofono peatonal', deviceSlug:'citofono-peatonal', type:'intercom', ipAddress:'192.168.20.14', username:'admin', password:'admin', serial:'00100400FV02001000000c383e2de501', extension:'1027', outboundCall:'2000', status:'active', sourceSheet:'Los Danubios' },
  { siteSlug:'los-danubios', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Los Danubios' },
  { siteSlug:'los-danubios', name:'Hik-Connect', deviceSlug:'hik-connect', type:'cloud_account_hik', username:'clavemonitoreo1@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Los Danubios' },

  // ── LUBECK (9 devices) ──
  { siteSlug:'lubeck', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', operator:'Tigo', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Lubeck' },
  { siteSlug:'lubeck', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.1.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Lubeck' },
  { siteSlug:'lubeck', name:'Router Ppal', deviceSlug:'router-ppal', type:'router', ipAddress:'192.168.1.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Lubeck' },
  { siteSlug:'lubeck', name:'XVR Clave', deviceSlug:'xvr-clave', type:'xvr', ipAddress:'192.168.1.125', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Lubeck' },
  { siteSlug:'lubeck', name:'Citofono vehicular 1', deviceSlug:'citofono-vehicular-1', type:'intercom', username:'admin', password:'admin', extension:'1020', outboundCall:'2000', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Lubeck' },
  { siteSlug:'lubeck', name:'Citofono vehicular 2', deviceSlug:'citofono-vehicular-2', type:'intercom', username:'admin', password:'admin', extension:'1019', outboundCall:'2000', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Lubeck' },
  { siteSlug:'lubeck', name:'Citofono peatonal', deviceSlug:'citofono-peatonal', type:'intercom', username:'admin', password:'admin', extension:'1018', outboundCall:'2000', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Lubeck' },
  { siteSlug:'lubeck', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Lubeck' },
  { siteSlug:'lubeck', name:'Hik-Connect', deviceSlug:'hik-connect', type:'cloud_account_hik', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Lubeck' },

  // ── MONITOREO (15 devices) ──
  { siteSlug:'monitoreo', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', ipAddress:'181.205.188.99', subnetMask:'255.255.255.248', gateway:'181.205.188.97', status:'active', sourceSheet:'Monitoreo' },
  { siteSlug:'monitoreo', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.88.1', status:'pending_configuration', missingFields:'username, password', sourceSheet:'Monitoreo' },
  { siteSlug:'monitoreo', name:'Router Ppal - MIKROTIK', deviceSlug:'router-ppal-mikrotik', type:'router', ipAddress:'192.168.88.1', port:443, username:'admin', password:'Clave.seg2024', status:'active', sourceSheet:'Monitoreo' },
  { siteSlug:'monitoreo', name:'Equipo Servidor', deviceSlug:'equipo-servidor', type:'server', ipAddress:'192.168.88.242', username:'CLAVE', password:'2024', status:'active', sourceSheet:'Monitoreo' },
  { siteSlug:'monitoreo', name:'Equipo Clon', deviceSlug:'equipo-clon', type:'other', ipAddress:'192.168.88.253', username:'CLAVE', password:'2024', status:'active', sourceSheet:'Monitoreo' },
  { siteSlug:'monitoreo', name:'PC', deviceSlug:'pc', type:'other', ipAddress:'192.168.88.252', username:'CLAVE', password:'2024', status:'active', sourceSheet:'Monitoreo' },
  { siteSlug:'monitoreo', name:'Portatil Apoyo', deviceSlug:'portatil-apoyo', type:'other', ipAddress:'192.168.88.247', username:'CLAVE', password:'2024', status:'active', sourceSheet:'Monitoreo' },
  { siteSlug:'monitoreo', name:'Cisco', deviceSlug:'cisco', type:'other', ipAddress:'192.168.88.12', status:'active', sourceSheet:'Monitoreo' },
  { siteSlug:'monitoreo', name:'Control de Acceso', deviceSlug:'control-de-acceso', type:'access_control', ipAddress:'192.168.88.13', port:8000, username:'admin', password:'seg12345', serial:'AB6509892', status:'active', sourceSheet:'Monitoreo' },
  { siteSlug:'monitoreo', name:'Planta IP', deviceSlug:'planta-ip', type:'other', ipAddress:'181.205.188.98', port:8090, username:'clave', password:'Clave.seg2024', status:'active', sourceSheet:'Monitoreo' },
  { siteSlug:'monitoreo', name:'Cámara EZVIZ Monitoreo', deviceSlug:'camara-ezviz-monitoreo', type:'camera', ipAddress:'192.168.88.19', port:8000, username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', serial:'L41978196', status:'active', sourceSheet:'Monitoreo' },
  { siteSlug:'monitoreo', name:'Cámara HIKVISION Operativo', deviceSlug:'camara-hikvision-operativo', type:'camera', ipAddress:'192.168.88.35', port:8000, serial:'K85531886', status:'active', sourceSheet:'Monitoreo' },
  { siteSlug:'monitoreo', name:'Conmutador GRANDSTREAM', deviceSlug:'conmutador-grandstream', type:'other', ipAddress:'192.168.88.250', username:'admin', password:'seg12345', serial:'24UML3NN108807A9', status:'active', sourceSheet:'Monitoreo' },
  { siteSlug:'monitoreo', name:'Conmutador Fanvil', deviceSlug:'conmutador-fanvil', type:'other', ipAddress:'192.168.88.243', username:'admin', password:'admin', serial:'00100400FV02001000000c383e2d8df2', status:'active', sourceSheet:'Monitoreo' },
  { siteSlug:'monitoreo', name:'Domotico Sirena', deviceSlug:'domotico-sirena', type:'domotic', appName:'SIRENA MONITOREO CLAVE', appId:'1001d5d3cb', status:'active', sourceSheet:'Monitoreo' },

  // ── PATIO BONITO (11 devices) ──
  { siteSlug:'patio-bonito', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', operator:'Movistar', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Patio Bonito' },
  { siteSlug:'patio-bonito', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.0.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Patio Bonito' },
  { siteSlug:'patio-bonito', name:'Router Ppal', deviceSlug:'router-ppal', type:'router', ipAddress:'192.168.0.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Patio Bonito' },
  { siteSlug:'patio-bonito', name:'XVR Clave', deviceSlug:'xvr-clave', type:'xvr', ipAddress:'192.168.0.195', username:'admin', password:'Clave.seg2023', serial:'AL02505PAJDC6A4', cameras:10, status:'active', sourceSheet:'Patio Bonito' },
  { siteSlug:'patio-bonito', name:'Control Ppal', deviceSlug:'control-ppal', type:'access_control', ipAddress:'192.168.0.199', port:8000, username:'admin', password:'seg12345', serial:'AB7910050', connection:'Hik-connect', status:'active', sourceSheet:'Patio Bonito' },
  { siteSlug:'patio-bonito', name:'Control Sotano', deviceSlug:'control-sotano', type:'access_control', ipAddress:'192.168.0.101', port:8000, username:'admin', password:'seg12345', serial:'FX9514413', connection:'Hik-connect', status:'active', sourceSheet:'Patio Bonito' },
  { siteSlug:'patio-bonito', name:'Cámara Placas', deviceSlug:'camara-placas', type:'camera', ipAddress:'192.168.0.99', port:8000, username:'admin', password:'Clave.seg2023', serial:'FX9514413', connection:'Hik-connect', status:'active', sourceSheet:'Patio Bonito' },
  { siteSlug:'patio-bonito', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Patio Bonito' },
  { siteSlug:'patio-bonito', name:'Hik-Connect', deviceSlug:'hik-connect', type:'cloud_account_hik', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Patio Bonito' },
  { siteSlug:'patio-bonito', name:'Citofono vehicular', deviceSlug:'citofono-vehicular', type:'intercom', username:'admin', password:'admin', extension:'1031', outboundCall:'1000', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Patio Bonito' },
  { siteSlug:'patio-bonito', name:'Citofono peatonal', deviceSlug:'citofono-peatonal', type:'intercom', username:'admin', password:'admin', extension:'1030', outboundCall:'1000', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Patio Bonito' },

  // ── PISQUINES (20 devices) ──
  { siteSlug:'pisquines', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', ipAddress:'181.205.202.122', subnetMask:'255.255.255.248', gateway:'181.205.202.121', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.1.1', port:8080, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Router Ppal - Linksys', deviceSlug:'router-ppal-linksys', type:'router', ipAddress:'192.168.1.1', port:8080, username:'admin', password:'Seg12345', aps:3, antennas:3, status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'DVR', deviceSlug:'dvr', type:'dvr', ipAddress:'192.168.1.108', port:8020, username:'admin', password:'Clave.seg2023', serial:'D65661173', cameras:16, analogCameras:11, status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'NVR', deviceSlug:'nvr', type:'nvr', ipAddress:'192.168.1.155', port:8010, username:'admin', password:'Clave.seg2023', serial:'AK5965771', cameras:9, status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Control de acceso', deviceSlug:'control-de-acceso', type:'access_control', ipAddress:'192.168.1.177', port:8000, username:'admin', password:'seg12345', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Cam. ZC Bl A', deviceSlug:'cam-zc-bl-a', type:'camera', ipAddress:'192.168.1.157', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Cam. Ext. Bl A.', deviceSlug:'cam-ext-bl-a', type:'camera', ipAddress:'192.168.1.159', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Cam. Calle', deviceSlug:'cam-calle', type:'camera', ipAddress:'192.168.1.165', port:8000, username:'admin', password:'seg12345', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Cam.Z.V. BLOQUE A', deviceSlug:'cam-z-v-bloque-a', type:'camera', ipAddress:'192.168.1.158', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Cam. Z.C BLOQUE D', deviceSlug:'cam-z-c-bloque-d', type:'camera', ipAddress:'192.168.1.167', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Domotico Vehicular', deviceSlug:'domotico-vehicular', type:'domotic', appName:'Pisquines', appId:'10022a7ff0', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Domotico sirena 1', deviceSlug:'domotico-sirena-1', type:'domotic', appName:'Pisquines Sirena 1', appId:'1001d60835', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Domotico Sirena 2', deviceSlug:'domotico-sirena-2', type:'domotic', appName:'Pisquines Sirena 2', appId:'10018cc0de', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Domotico energía', deviceSlug:'domotico-energia', type:'domotic', appName:'Energía Pisquines', appId:'10018ba9be', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Cam. Acceso', deviceSlug:'cam-acceso', type:'camera', ipAddress:'192.168.1.7', port:8000, username:'admin', password:'seg12345', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Cam. Ppal', deviceSlug:'cam-ppal', type:'camera', ipAddress:'192.168.1.166', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Citofono', deviceSlug:'citofono', type:'intercom', ipAddress:'192.168.1.189', username:'admin', password:'admin', serial:'00100400FV02001000000c383e29243b', extension:'1003', outboundCall:'1000', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Pisquines' },
  { siteSlug:'pisquines', name:'Hik-Connect', deviceSlug:'hik-connect', type:'cloud_account_hik', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Pisquines' },

  // ── PORTAL PLAZA (20 devices) ──
  { siteSlug:'portal-plaza', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', ipAddress:'181.205.175.19', subnetMask:'255.255.255.248', gateway:'181.205.175.17', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.2.1', port:8090, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'XVR Puesto', deviceSlug:'xvr-puesto', type:'xvr', ipAddress:'192.168.2.16', port:37777, username:'CLAVE', password:'Clave.seg2023', serial:'9D07264PAZD6B3A', cameras:3, analogCameras:3, status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'NVR Clave', deviceSlug:'nvr-clave', type:'nvr', ipAddress:'192.168.2.40', port:8020, username:'admin', password:'Clave.seg2023', serial:'FA0742394', cameras:13, analogCameras:2, status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Control de acceso', deviceSlug:'control-de-acceso', type:'access_control', ipAddress:'192.168.2.13', port:8081, username:'admin', password:'seg12345', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Cam. Entr. Parq.', deviceSlug:'cam-entr-parq', type:'camera', ipAddress:'192.168.2.41', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Cam. Entr. Ascensor', deviceSlug:'cam-entr-ascensor', type:'camera', ipAddress:'192.168.2.42', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Cam. Fondo Parq.', deviceSlug:'cam-fondo-parq', type:'camera', ipAddress:'192.168.2.43', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Cam. Ext.', deviceSlug:'cam-ext', type:'camera', ipAddress:'192.168.2.44', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Cam. 2do Piso.', deviceSlug:'cam-2do-piso', type:'camera', ipAddress:'192.168.2.45', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Domotico Vehicular', deviceSlug:'domotico-vehicular', type:'domotic', appName:'Portal 1', appId:'10022a5bcb', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Domotico Energía', deviceSlug:'domotico-energia', type:'domotic', appName:'Energía Portal Plaza', appId:'10022a9354', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Domotico Luces N1', deviceSlug:'domotico-luces-n1', type:'domotic', appName:'Portal Plaza Sirena', appId:'10022ab4ff', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Cam. Piso 14', deviceSlug:'cam-piso-14', type:'camera', ipAddress:'192.168.2.46', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Cam. Salón Social', deviceSlug:'cam-salon-social', type:'camera', ipAddress:'192.168.2.48', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Cam. Terraza', deviceSlug:'cam-terraza', type:'camera', ipAddress:'192.168.2.47', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Citofono', deviceSlug:'citofono', type:'intercom', ipAddress:'192.168.2.165', username:'admin', password:'admin', serial:'00100400FV02001000000c383e2921af', extension:'1025', outboundCall:'2000', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Hik-Connect', deviceSlug:'hik-connect', type:'cloud_account_hik', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Portal Plaza' },
  { siteSlug:'portal-plaza', name:'Cam. Ascensor', deviceSlug:'cam-ascensor', type:'camera', ipAddress:'192.168.2.49', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Portal Plaza' },

  // ── PORTALEGRE (18 devices) ──
  { siteSlug:'portalegre', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', ipAddress:'200.58.214.114', subnetMask:'255.255.255.248', gateway:'200.58.214.113', status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.20.1', port:8000, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'Router Ppal - Linksys', deviceSlug:'router-ppal-linksys', type:'router', ipAddress:'192.168.20.1', port:8080, username:'admin', password:'Seg12345', serial:'37A10M2CD00423', aps:2, antennas:1, status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'DVR Puesto', deviceSlug:'dvr-puesto', type:'dvr', ipAddress:'192.168.20.95', port:8040, username:'admin', password:'Clave.seg2023', serial:'L09799827', cameras:4, status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'NVR Clave', deviceSlug:'nvr-clave', type:'nvr', ipAddress:'192.168.20.100', port:8000, username:'admin', password:'Clave.seg2023', serial:'AK5965779', cameras:10, status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'Control Ppal', deviceSlug:'control-ppal', type:'access_control', ipAddress:'192.168.20.244', port:8010, username:'admin', password:'Seg12345', serial:'AC0155174', status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'CAM Sotano A', deviceSlug:'cam-sotano-a', type:'camera', ipAddress:'192.168.20.50', port:8000, username:'admin', password:'Clave.seg2023', serial:'AD6872381', status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'CAM Sotano B', deviceSlug:'cam-sotano-b', type:'camera', ipAddress:'192.168.20.52', port:8000, username:'admin', password:'Clave.seg2023', serial:'AH3639691', status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'CAM Parq. A', deviceSlug:'cam-parq-a', type:'camera', ipAddress:'192.168.20.56', port:8000, username:'admin', password:'Clave.seg2023', serial:'AD6872671', status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'Domotico Energía', deviceSlug:'domotico-energia', type:'domotic', appName:'Energía Portalegre', appId:'1002016870', status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'Domotico Sirenas', deviceSlug:'domotico-sirenas', type:'domotic', appName:'Portalegre Sirena', appId:'10020115c1', status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'Citofono peatonal', deviceSlug:'citofono-peatonal', type:'intercom', ipAddress:'192.168.20.178', username:'admin', password:'admin', serial:'00100400FV02001000000c383e43525a', extension:'1006', outboundCall:'2000', status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'CAM Ascensor', deviceSlug:'cam-ascensor', type:'camera', ipAddress:'192.168.20.9', port:8000, username:'admin', password:'Clave.seg2023', serial:'AH5182273', status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'CAM Veh. 1', deviceSlug:'cam-veh-1', type:'camera', ipAddress:'192.168.20.58', port:8000, username:'admin', password:'Clave.seg2023', serial:'L45034617', status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'CAM Parq. B', deviceSlug:'cam-parq-b', type:'camera', ipAddress:'192.168.20.54', port:8000, username:'admin', password:'Clave.seg2023', serial:'AH3640124', status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'CAM Veh. 2', deviceSlug:'cam-veh-2', type:'camera', ipAddress:'192.168.20.48', port:8000, username:'admin', password:'Clave.seg2023', serial:'L45034652', status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Portalegre' },
  { siteSlug:'portalegre', name:'Hik-Connect', deviceSlug:'hik-connect', type:'cloud_account_hik', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Portalegre' },

  // ── QUINTAS SM (8 devices) ──
  { siteSlug:'quintas-sm', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', operator:'Starlink', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Quintas SM' },
  { siteSlug:'quintas-sm', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.100.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Quintas SM' },
  { siteSlug:'quintas-sm', name:'Router Ppal', deviceSlug:'router-ppal', type:'router', ipAddress:'192.168.100.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Quintas SM' },
  { siteSlug:'quintas-sm', name:'XVR Clave', deviceSlug:'xvr-clave', type:'xvr', ipAddress:'192168100.19', port:8000, username:'admin', password:'Clave.seg2023', serial:'AH1020EPAZ39E67', status:'active', sourceSheet:'Quintas SM' },
  { siteSlug:'quintas-sm', name:'Citofono peatonal 1', deviceSlug:'citofono-peatonal-1040', type:'intercom', username:'admin', password:'admin', extension:'1040', outboundCall:'2000', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Quintas SM' },
  { siteSlug:'quintas-sm', name:'Citofono peatonal 2', deviceSlug:'citofono-peatonal-1041', type:'intercom', username:'admin', password:'admin', extension:'1041', outboundCall:'2000', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Quintas SM' },
  { siteSlug:'quintas-sm', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Quintas SM' },
  { siteSlug:'quintas-sm', name:'Hik-Connect', deviceSlug:'hik-connect', type:'cloud_account_hik', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Quintas SM' },

  // ── SAN NICOLAS (8 devices) ──
  { siteSlug:'san-nicolas', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', ipAddress:'181.143.16.170', subnetMask:'255.255.255.248', gateway:'181.143.16.169', status:'active', sourceSheet:'San Nicolas' },
  { siteSlug:'san-nicolas', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.20.1', port:443, username:'admin', password:'seg12345', status:'active', sourceSheet:'San Nicolas' },
  { siteSlug:'san-nicolas', name:'DVR', deviceSlug:'dvr', type:'dvr', ipAddress:'192.168.20.15', port:8060, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'San Nicolas' },
  { siteSlug:'san-nicolas', name:'NVR', deviceSlug:'nvr', type:'nvr', ipAddress:'192.168.20.99', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'San Nicolas' },
  { siteSlug:'san-nicolas', name:'Control de acceso', deviceSlug:'control-de-acceso', type:'access_control', ipAddress:'192.168.20.26', port:8050, username:'admin', password:'seg12345', connection:'IP', status:'active', sourceSheet:'San Nicolas' },
  { siteSlug:'san-nicolas', name:'Cámara Placas', deviceSlug:'camara-placas', type:'camera', ipAddress:'192.168.20.222', port:8081, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'San Nicolas' },
  { siteSlug:'san-nicolas', name:'Citofono vehicular', deviceSlug:'citofono-vehicular', type:'intercom', ipAddress:'192.168.20.115', username:'admin', password:'admin', extension:'1002', outboundCall:'2000', status:'active', sourceSheet:'San Nicolas' },
  { siteSlug:'san-nicolas', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'San Nicolas' },

  // ── SAN SEBASTIAN (21 devices) ──
  { siteSlug:'san-sebastian', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', ipAddress:'186.97.106.252', subnetMask:'255.255.255.248', gateway:'186.97.106.250', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.20.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Router Ppal - Linksys', deviceSlug:'router-ppal-linksys', type:'router', ipAddress:'192.168.20.1', port:8080, username:'admin', password:'Seg12345', serial:'37A10M2CD00499', aps:2, antennas:2, status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'DVR', deviceSlug:'dvr', type:'dvr', ipAddress:'192.168.20.14', port:8000, username:'admin', password:'Clave.seg2023', serial:'Z3337616', cameras:16, analogCameras:6, connection:'IP', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Control de acceso', deviceSlug:'control-de-acceso', type:'access_control', ipAddress:'192.168.20.120', port:8080, username:'admin', password:'seg12345', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Cam Escalas Sotano', deviceSlug:'cam-escalas-sotano', type:'camera', ipAddress:'192.168.20.32', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Cam Peatonal', deviceSlug:'cam-peatonal', type:'camera', ipAddress:'192.168.20.33', port:8080, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Cam Entr. Asce.', deviceSlug:'cam-entr-asce', type:'camera', ipAddress:'192.168.20.23', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Cam Calle Norte', deviceSlug:'cam-calle-norte', type:'camera', ipAddress:'192.168.20.20', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Cam Calle Sur', deviceSlug:'cam-calle-sur', type:'camera', ipAddress:'192.168.20.21', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Cam Lobby', deviceSlug:'cam-lobby', type:'camera', ipAddress:'192.168.20.22', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Cam Parq. 1 B', deviceSlug:'cam-parq-1-b', type:'camera', ipAddress:'192.168.20.24', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Cam Acceso Sotano', deviceSlug:'cam-acceso-sotano', type:'camera', ipAddress:'192.168.20.31', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Cam Ascensor', deviceSlug:'cam-ascensor', type:'camera', ipAddress:'192.168.20.2', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Cam Acces. Parq', deviceSlug:'cam-acces-parq', type:'camera', ipAddress:'192.168.20.34', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Domotico Vehicular 1', deviceSlug:'domotico-vehicular-1', type:'domotic', appName:'San Sebastian 1', appId:'10018bf929', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Domotico Vehicular 2', deviceSlug:'domotico-vehicular-2', type:'domotic', appName:'San Sebastian 2', appId:'1002008966', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Domotico Sirenas', deviceSlug:'domotico-sirenas', type:'domotic', appName:'San Sebastian Sirenas', appId:'1001d65820', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Domotico Energía', deviceSlug:'domotico-energia', type:'domotic', appName:'San Sebastian Energía', appId:'100200ba92', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Citofono peatonal', deviceSlug:'citofono-peatonal', type:'intercom', ipAddress:'192.168.20.12', username:'admin', password:'admin', serial:'00100400FV02001000000c383e2de4ff', extension:'1021', outboundCall:'1000', status:'active', sourceSheet:'San Sebastian' },
  { siteSlug:'san-sebastian', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'San Sebastian' },

  // ── SANTANA (6 devices) ──
  { siteSlug:'santana', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', operator:'Movistar', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Santana' },
  { siteSlug:'santana', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.0.1', port:443, username:'admin', password:'seg12345', status:'active', sourceSheet:'Santana' },
  { siteSlug:'santana', name:'Router Ppal', deviceSlug:'router-ppal', type:'router', ipAddress:'192.168.0.1', port:443, username:'admin', password:'seg12345', serial:'223B697019978', status:'active', sourceSheet:'Santana' },
  { siteSlug:'santana', name:'DVR Puesto', deviceSlug:'dvr-puesto', type:'dvr', ipAddress:'192.168.0.101', port:8000, username:'admin', password:'Clave.seg2023', serial:'D35839762', cameras:15, status:'active', sourceSheet:'Santana' },
  { siteSlug:'santana', name:'XVR Clave', deviceSlug:'xvr-clave', type:'xvr', ipAddress:'192.168.0.108', port:37777, username:'admin', password:'Clave.seg2023', serial:'AB081E4PAZD6D5B', cameras:7, status:'active', sourceSheet:'Santana' },
  { siteSlug:'santana', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Santana' },

  // ── SENDEROS (7 devices) ──
  { siteSlug:'senderos', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', ipAddress:'38.9.217.12', subnetMask:'255.255.255.248', gateway:'38.9.217.9', status:'active', sourceSheet:'Senderos' },
  { siteSlug:'senderos', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.1.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Senderos' },
  { siteSlug:'senderos', name:'Router Ppal', deviceSlug:'router-ppal', type:'router', ipAddress:'192.168.1.1', port:443, username:'admin', password:'Seg12345', serial:'37A10M2CD02166', status:'active', sourceSheet:'Senderos' },
  { siteSlug:'senderos', name:'DVR', deviceSlug:'dvr', type:'dvr', ipAddress:'192.168.0.223', username:'admin', password:'Clave.seg2023', serial:'M10820250616CCWRGB4593326WCVU', connection:'IP', status:'active', sourceSheet:'Senderos' },
  { siteSlug:'senderos', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Senderos' },
  { siteSlug:'senderos', name:'Hik-Connect', deviceSlug:'hik-connect', type:'cloud_account_hik', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Senderos' },
  { siteSlug:'senderos', name:'Citofono peatonal', deviceSlug:'citofono-peatonal', type:'intercom', username:'admin', password:'admin', extension:'1032', outboundCall:'2000', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Senderos' },

  // ── TERRABAMBA (7 devices) ──
  { siteSlug:'terrabamba', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', operator:'Starlink', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Terrabamba' },
  { siteSlug:'terrabamba', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.20.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Terrabamba' },
  { siteSlug:'terrabamba', name:'Router Ppal', deviceSlug:'router-ppal', type:'router', ipAddress:'192.168.20.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Terrabamba' },
  { siteSlug:'terrabamba', name:'XVR Clave', deviceSlug:'xvr-clave', type:'xvr', ipAddress:'192.168.20.100', port:37777, username:'admin', password:'Clave.seg2023', serial:'AH0306CPAZ0E430', cameras:5, status:'active', sourceSheet:'Terrabamba' },
  { siteSlug:'terrabamba', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Terrabamba' },
  { siteSlug:'terrabamba', name:'Hik-Connect', deviceSlug:'hik-connect', type:'cloud_account_hik', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Terrabamba' },
  { siteSlug:'terrabamba', name:'Citofono peatonal', deviceSlug:'citofono-peatonal', type:'intercom', username:'admin', password:'admin', extension:'1034', outboundCall:'2000', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Terrabamba' },

  // ── TERRAZZINO (10 devices) ──
  { siteSlug:'terrazzino', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', operator:'Movistar', status:'pending_configuration', missingFields:'ip_address', sourceSheet:'Terrazzino' },
  { siteSlug:'terrazzino', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.1.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Terrazzino' },
  { siteSlug:'terrazzino', name:'Router Ppal', deviceSlug:'router-ppal', type:'router', ipAddress:'192.168.1.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Terrazzino' },
  { siteSlug:'terrazzino', name:'XVR Clave', deviceSlug:'xvr-clave', type:'xvr', ipAddress:'192.168.1.50', port:37777, username:'admin', password:'Clave.seg2023', serial:'AH0306CPAZ5E9FA', cameras:8, status:'active', sourceSheet:'Terrazzino' },
  { siteSlug:'terrazzino', name:'Control Ppal', deviceSlug:'control-ppal', type:'access_control', ipAddress:'192.168.1.55', port:8000, username:'admin', password:'seg12345', serial:'FK4627089', connection:'Hik-connect', status:'active', sourceSheet:'Terrazzino' },
  { siteSlug:'terrazzino', name:'Domotico Vehicular', deviceSlug:'domotico-vehicular', type:'domotic', appName:'Terrazzino', appId:'10022abbc6', status:'active', sourceSheet:'Terrazzino' },
  { siteSlug:'terrazzino', name:'Domotico Sirena', deviceSlug:'domotico-sirena', type:'domotic', appName:'Terrazzino Sirena', appId:'10018c04ea', status:'active', sourceSheet:'Terrazzino' },
  { siteSlug:'terrazzino', name:'Domotico Energía', deviceSlug:'domotico-energia', type:'domotic', appName:'Terrazzino Energía', appId:'100200e0bf', status:'active', sourceSheet:'Terrazzino' },
  { siteSlug:'terrazzino', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Terrazzino' },
  { siteSlug:'terrazzino', name:'Hik-Connect', deviceSlug:'hik-connect', type:'cloud_account_hik', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Terrazzino' },

  // ── TORRE LUCIA (36 devices) ──
  { siteSlug:'torre-lucia', name:'Red WAN', deviceSlug:'red-wan', type:'network_wan', ipAddress:'181.58.39.18', subnetMask:'255.255.255.248', gateway:'181.58.39.17', operator:'Movistar', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Red LAN', deviceSlug:'red-lan', type:'network_lan', ipAddress:'192.168.20.1', port:443, username:'admin', password:'Seg12345', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Router Ppal - Linksys', deviceSlug:'router-ppal-linksys', type:'router', ipAddress:'192.168.20.1', port:8080, username:'admin', password:'Seg12345', serial:'37A10M2C900553', aps:3, antennas:5, status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'XVR Puesto', deviceSlug:'xvr-puesto', type:'xvr', ipAddress:'192.168.20.108', port:37777, username:'CLAVE', password:'Clave.seg2023', serial:'9B02D09PAZ4B67A', cameras:4, status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'NVR Clave', deviceSlug:'nvr-clave', type:'nvr', ipAddress:'192.168.20.100', port:8000, username:'admin', password:'Clave.seg2023', serial:'AK5965801', cameras:17, status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Control Ppal', deviceSlug:'control-ppal', type:'access_control', ipAddress:'192.168.20.120', port:8020, username:'admin', password:'seg12345', serial:'AK5523299', connection:'Hik-Connect', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Control T1', deviceSlug:'control-t1', type:'access_control', ipAddress:'192.168.20.6', port:8010, username:'admin', password:'seg12345', serial:'AC4529672', connection:'Hik-Connect', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Control T2', deviceSlug:'control-t2', type:'access_control', ipAddress:'192.168.20.9', port:8040, username:'admin', password:'seg12345', serial:'FK4627091', connection:'Hik-Connect', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Control Sotano', deviceSlug:'control-sotano', type:'access_control', ipAddress:'192.168.20.7', port:8030, username:'admin', password:'seg12345', serial:'FK4627083', connection:'Hik-Connect', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Control Piso 16', deviceSlug:'control-piso-16', type:'access_control', ipAddress:'192.168.20.8', port:8050, username:'admin', password:'seg12345', serial:'FK4627097', connection:'Hik-Connect', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Cam. Calle Frontal', deviceSlug:'cam-calle-frontal', type:'camera', ipAddress:'192.168.20.50', port:8000, username:'admin', password:'Clave.seg2023', serial:'AD6872401', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Cam. Calle Lateral', deviceSlug:'cam-calle-lateral', type:'camera', ipAddress:'192.168.20.51', port:8000, username:'admin', password:'Clave.seg2023', serial:'AD6872349', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Cam. Lobby', deviceSlug:'cam-lobby', type:'camera', ipAddress:'192.168.20.52', port:8000, username:'admin', password:'Clave.seg2023', serial:'AH3639689', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Cam. Ascensor', deviceSlug:'cam-ascensor', type:'camera', ipAddress:'192.168.20.53', port:8000, username:'admin', password:'Clave.seg2023', serial:'AH5182315', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Cam. Sotano A', deviceSlug:'cam-sotano-a', type:'camera', ipAddress:'192.168.20.54', port:8000, username:'admin', password:'Clave.seg2023', serial:'AH3640123', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Cam. Sotano B', deviceSlug:'cam-sotano-b', type:'camera', ipAddress:'192.168.20.55', port:8000, username:'admin', password:'Clave.seg2023', serial:'AH3639687', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Cam. Parq. A', deviceSlug:'cam-parq-a', type:'camera', ipAddress:'192.168.20.56', port:8000, username:'admin', password:'Clave.seg2023', serial:'AD6872671', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Cam. Parq. B', deviceSlug:'cam-parq-b', type:'camera', ipAddress:'192.168.20.57', port:8000, username:'admin', password:'Clave.seg2023', serial:'AD6873189', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Cam. Veh. 1', deviceSlug:'cam-veh-1', type:'camera', ipAddress:'192.168.20.58', port:8000, username:'admin', password:'Clave.seg2023', serial:'L45034617', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Cam. Veh. 2', deviceSlug:'cam-veh-2', type:'camera', ipAddress:'192.168.20.59', port:8000, username:'admin', password:'Clave.seg2023', serial:'L45034652', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Cam. Piso 16', deviceSlug:'cam-piso-16', type:'camera', ipAddress:'192.168.20.60', port:8000, username:'admin', password:'Clave.seg2023', serial:'AH5182314', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Cam. Terraza', deviceSlug:'cam-terraza', type:'camera', ipAddress:'192.168.20.61', port:8000, username:'admin', password:'Clave.seg2023', serial:'AH5182310', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Domotico Vehicular Visitantes', deviceSlug:'domotico-vehicular-visitantes', type:'domotic', appName:'Torre 3', appId:'10018c5e39', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Domotico apert. Veh. Res.', deviceSlug:'domotico-apert-veh-res', type:'domotic', appName:'Torre 1', appId:'10022a7fb8', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Domotico cierre Veh. Res.', deviceSlug:'domotico-cierre-veh-res', type:'domotic', appName:'Torre 2', appId:'10022a7fe7', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Domotico Peatonal', deviceSlug:'domotico-peatonal', type:'domotic', appName:'Torre 4', appId:'10022a7fec', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Domotico Sirena 1', deviceSlug:'domotico-sirena-1', type:'domotic', appName:'Torre Lucia Sirena Piso 1', appId:'1001d6080e', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Domotico Sirena Sotano', deviceSlug:'domotico-sirena-sotano', type:'domotic', appName:'Torre Lucia Sirena Sotano', appId:'10018cce57', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Domotico Energía', deviceSlug:'domotico-energia', type:'domotic', appName:'Torre Lucia Energía', appId:'10020168e1', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Citofono vehicular', deviceSlug:'citofono-vehicular', type:'intercom', ipAddress:'192.168.20.165', username:'admin', password:'admin', serial:'00100400FV02001000000c383e2921cf', extension:'1000', outboundCall:'2000', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Citofono peatonal', deviceSlug:'citofono-peatonal', type:'intercom', ipAddress:'192.168.20.125', username:'admin', password:'admin', serial:'00100400FV02001000000c383e292130', extension:'1001', outboundCall:'2000', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Citofono T1', deviceSlug:'citofono-t1', type:'intercom', ipAddress:'192.168.20.195', username:'admin', password:'admin', serial:'00100400FV02001000000c383e43526b', extension:'1010', outboundCall:'2000', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Citofono T2', deviceSlug:'citofono-t2', type:'intercom', ipAddress:'192.168.20.196', username:'admin', password:'admin', serial:'00100400FV02001000000c383e43526e', extension:'1011', outboundCall:'2000', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Ewelink', deviceSlug:'ewelink', type:'cloud_account_ewelink', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Hik-Connect', deviceSlug:'hik-connect', type:'cloud_account_hik', username:'clavemonitoreo@gmail.com', password:'Clave.seg2023', status:'active', sourceSheet:'Torre Lucia' },
  { siteSlug:'torre-lucia', name:'Cam. Placas', deviceSlug:'cam-placas', type:'camera', ipAddress:'192.168.20.62', port:8000, username:'admin', password:'Clave.seg2023', status:'active', sourceSheet:'Torre Lucia' },
];

// ════════════════════════════════════════════════════════════
// IMPORT LOGIC
// ════════════════════════════════════════════════════════════
async function runMigration() {
  console.log('── Running migration 008 ──');
  const migrationPath = path.resolve(__dirname, '../backend/apps/backend-api/src/db/migrations/008_monitoring_sites_devices.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
  await sql.unsafe(migrationSql);
  console.log('Migration 008 applied successfully');
}

async function ensureTenant() {
  console.log('── Ensuring tenant exists ──');
  const existing = await sql`SELECT id FROM public.tenants WHERE id = ${TENANT_ID}`;
  if (existing.length === 0) {
    await sql`INSERT INTO public.tenants (id, name, slug, timezone, settings) VALUES (${TENANT_ID}, 'AION Seguridad', 'aion-main', 'America/Bogota', '{"language":"es","theme":"dark"}'::jsonb)`;
    console.log('Tenant AION Seguridad created');
  } else {
    console.log('Tenant already exists');
  }
}

async function upsertSites(): Promise<Map<string, string>> {
  console.log('── Upserting sites ──');
  const siteMap = new Map<string, string>();

  for (const site of SITES) {
    const existing = await sql`SELECT id FROM public.sites WHERE tenant_id = ${TENANT_ID} AND slug = ${site.slug}`;

    if (existing.length > 0) {
      await sql`UPDATE public.sites SET name = ${site.name}, address = ${site.address}, site_sheet = ${site.siteSheet || null}, status = ${site.status}, timezone = 'America/Bogota', updated_at = NOW() WHERE id = ${existing[0].id}`;
      siteMap.set(site.slug, existing[0].id);
      console.log(`  Updated: ${site.name} (${site.slug})`);
    } else {
      // Try matching by name for sites created by create-sites.sql
      const byName = await sql`SELECT id FROM public.sites WHERE tenant_id = ${TENANT_ID} AND (LOWER(name) = LOWER(${site.name}) OR LOWER(name) LIKE LOWER(${`%${site.slug.replace(/-/g, ' ')}%`}))`;

      if (byName.length > 0) {
        await sql`UPDATE public.sites SET slug = ${site.slug}, site_sheet = ${site.siteSheet || null}, address = ${site.address}, status = ${site.status}, timezone = 'America/Bogota', updated_at = NOW() WHERE id = ${byName[0].id}`;
        siteMap.set(site.slug, byName[0].id);
        console.log(`  Matched & updated: ${site.name} (${site.slug})`);
      } else {
        const inserted = await sql`INSERT INTO public.sites (tenant_id, name, slug, site_sheet, address, timezone, status) VALUES (${TENANT_ID}, ${site.name}, ${site.slug}, ${site.siteSheet || null}, ${site.address}, 'America/Bogota', ${site.status}) RETURNING id`;
        siteMap.set(site.slug, inserted[0].id);
        console.log(`  Created: ${site.name} (${site.slug})`);
      }
    }
  }

  console.log(`  Total sites: ${siteMap.size}`);
  return siteMap;
}

async function upsertDevices(siteMap: Map<string, string>) {
  console.log('── Upserting devices ──');
  let created = 0, updated = 0, skipped = 0;

  for (const dev of DEVICES) {
    const siteId = siteMap.get(dev.siteSlug);
    if (!siteId) {
      console.error(`  SKIP: No site found for slug '${dev.siteSlug}'`);
      skipped++;
      continue;
    }

    // Idempotent key: site_id + device_slug
    const existing = await sql`SELECT id FROM public.devices WHERE site_id = ${siteId} AND device_slug = ${dev.deviceSlug}`;

    const values = {
      tenant_id: TENANT_ID,
      site_id: siteId,
      name: dev.name,
      device_slug: dev.deviceSlug,
      type: dev.type,
      ip_address: n(dev.ipAddress) || null,
      port: dev.port ?? null,
      username: n(dev.username) || null,
      password: n(dev.password) || null,
      subnet_mask: n(dev.subnetMask) || null,
      gateway: n(dev.gateway) || null,
      operator: n(dev.operator) || null,
      serial_number: n(dev.serial) || null,
      app_name: n(dev.appName) || null,
      app_id: n(dev.appId) || null,
      extension: n(dev.extension) || null,
      outbound_call: n(dev.outboundCall) || null,
      connection_type: n(dev.connection) || null,
      aps_count: dev.aps ?? null,
      antennas_count: dev.antennas ?? null,
      cameras_count: dev.cameras ?? null,
      analog_cameras_count: dev.analogCameras ?? null,
      status: dev.status,
      missing_fields: n(dev.missingFields) || null,
      source_sheet: dev.sourceSheet,
      notes: n(dev.note) || null,
    };

    if (existing.length > 0) {
      await sql`UPDATE public.devices SET
        name = ${values.name}, type = ${values.type},
        ip_address = ${values.ip_address}, port = ${values.port},
        username = ${values.username}, password = ${values.password},
        subnet_mask = ${values.subnet_mask}, gateway = ${values.gateway},
        operator = ${values.operator}, serial_number = ${values.serial_number},
        app_name = ${values.app_name}, app_id = ${values.app_id},
        extension = ${values.extension}, outbound_call = ${values.outbound_call},
        connection_type = ${values.connection_type},
        aps_count = ${values.aps_count}, antennas_count = ${values.antennas_count},
        cameras_count = ${values.cameras_count}, analog_cameras_count = ${values.analog_cameras_count},
        status = ${values.status}, missing_fields = ${values.missing_fields},
        source_sheet = ${values.source_sheet}, notes = ${values.notes},
        updated_at = NOW()
        WHERE id = ${existing[0].id}`;
      updated++;
    } else {
      await sql`INSERT INTO public.devices (
        tenant_id, site_id, name, device_slug, type, ip_address, port,
        username, password, subnet_mask, gateway, operator, serial_number,
        app_name, app_id, extension, outbound_call, connection_type,
        aps_count, antennas_count, cameras_count, analog_cameras_count,
        status, missing_fields, source_sheet, notes, channels, capabilities
      ) VALUES (
        ${values.tenant_id}, ${values.site_id}, ${values.name}, ${values.device_slug},
        ${values.type}, ${values.ip_address}, ${values.port},
        ${values.username}, ${values.password}, ${values.subnet_mask}, ${values.gateway},
        ${values.operator}, ${values.serial_number},
        ${values.app_name}, ${values.app_id}, ${values.extension}, ${values.outbound_call},
        ${values.connection_type},
        ${values.aps_count}, ${values.antennas_count}, ${values.cameras_count}, ${values.analog_cameras_count},
        ${values.status}, ${values.missing_fields}, ${values.source_sheet}, ${values.notes},
        1, '{}'::jsonb
      )`;
      created++;
    }
  }

  console.log(`  Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
  console.log(`  Total processed: ${DEVICES.length}`);
}

async function validate() {
  console.log('\n════════════════════════════════════════════');
  console.log('VALIDATION RESULTS');
  console.log('════════════════════════════════════════════\n');

  // Total sites
  const totalSites = await sql`SELECT COUNT(*) as count FROM public.sites WHERE tenant_id = ${TENANT_ID}`;
  console.log(`Total sites: ${totalSites[0].count}`);

  // Total devices
  const totalDevices = await sql`SELECT COUNT(*) as count FROM public.devices WHERE tenant_id = ${TENANT_ID}`;
  console.log(`Total devices: ${totalDevices[0].count}`);

  // Active devices
  const activeDevices = await sql`SELECT COUNT(*) as count FROM public.devices WHERE tenant_id = ${TENANT_ID} AND status = 'active'`;
  console.log(`Active devices: ${activeDevices[0].count}`);

  // Pending devices
  const pendingDevices = await sql`SELECT COUNT(*) as count FROM public.devices WHERE tenant_id = ${TENANT_ID} AND status = 'pending_configuration'`;
  console.log(`Pending devices: ${pendingDevices[0].count}`);

  // Check for duplicates
  const duplicates = await sql`SELECT site_id, device_slug, COUNT(*) as cnt FROM public.devices WHERE tenant_id = ${TENANT_ID} AND device_slug IS NOT NULL GROUP BY site_id, device_slug HAVING COUNT(*) > 1`;
  console.log(`Duplicate device keys: ${duplicates.length}`);
  if (duplicates.length > 0) {
    console.log('  DUPLICATES FOUND:', duplicates);
  }

  // Pending sites
  const pendingSites = await sql`SELECT name, status FROM public.sites WHERE tenant_id = ${TENANT_ID} AND status = 'pending_configuration'`;
  console.log(`\nPending sites (missing docs): ${pendingSites.length}`);
  for (const s of pendingSites) {
    console.log(`  - ${s.name} (${s.status})`);
  }

  // Pending by site
  console.log('\nPending devices by site:');
  const pendingBySite = await sql`
    SELECT s.name as site_name, s.slug, d.name as device_name, d.missing_fields
    FROM public.devices d
    JOIN public.sites s ON d.site_id = s.id
    WHERE d.tenant_id = ${TENANT_ID} AND d.status = 'pending_configuration'
    ORDER BY s.name, d.name`;

  let currentSite = '';
  for (const row of pendingBySite) {
    if (row.site_name !== currentSite) {
      currentSite = row.site_name;
      console.log(`  ${row.site_name}:`);
    }
    console.log(`    - ${row.device_name} | falta: ${row.missing_fields}`);
  }

  // Devices by type
  console.log('\nDevices by type:');
  const byType = await sql`SELECT type, COUNT(*) as count FROM public.devices WHERE tenant_id = ${TENANT_ID} GROUP BY type ORDER BY count DESC`;
  for (const row of byType) {
    console.log(`  ${row.type}: ${row.count}`);
  }

  // Devices per site
  console.log('\nDevices per site:');
  const perSite = await sql`
    SELECT s.name, s.slug, s.status as site_status,
      COUNT(d.id) as device_count,
      COUNT(CASE WHEN d.status = 'active' THEN 1 END) as active,
      COUNT(CASE WHEN d.status = 'pending_configuration' THEN 1 END) as pending
    FROM public.sites s
    LEFT JOIN public.devices d ON d.site_id = s.id
    WHERE s.tenant_id = ${TENANT_ID}
    GROUP BY s.id, s.name, s.slug, s.status
    ORDER BY s.name`;

  for (const row of perSite) {
    const marker = row.site_status === 'pending_configuration' ? ' [PENDIENTE DOCUMENTAL]' : '';
    console.log(`  ${row.name} (${row.slug}) | devices=${row.device_count} active=${row.active} pending=${row.pending}${marker}`);
  }
}

// ════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  AION Monitoring Station — Idempotent Import ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  try {
    await runMigration();
    await ensureTenant();
    const siteMap = await upsertSites();
    await upsertDevices(siteMap);
    await validate();

    console.log('\n✓ IMPORT COMPLETED SUCCESSFULLY');
    console.log(`  Input dataset: ${DEVICES.length} devices across ${SITES.length} sites`);
    console.log(`  Aparta Casas: reportada como pendiente documental (sin datos en fuente)`);
  } catch (err) {
    console.error('IMPORT FAILED:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
