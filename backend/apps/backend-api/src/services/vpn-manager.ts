/**
 * VPN / Tunnel Management Service
 *
 * Manages WireGuard VPN configurations and site connectivity profiles.
 * The actual WireGuard tunnels run at the OS level — this service handles:
 * - WireGuard config file generation
 * - X25519 keypair generation
 * - Site VPN profile CRUD (stored in tenant settings JSONB)
 * - Connectivity testing via TCP probes
 */

import crypto from 'crypto';
import { db } from '../db/client.js';
import { tenants, devices, sites } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { networkScanner } from './network-scanner.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface VPNConfig {
  /** WireGuard server public key */
  serverPublicKey: string;
  /** WireGuard server endpoint (domain:port) */
  serverEndpoint: string;
  /** Client VPN address (e.g. 10.0.0.2/32) */
  clientAddress: string;
  /** Networks reachable through VPN (e.g. 192.168.1.0/24) */
  allowedIPs: string;
  /** DNS server for VPN (optional) */
  dns?: string;
  /** Client private key (auto-generated if omitted) */
  clientPrivateKey?: string;
  /** Persistent keepalive interval in seconds (default 25) */
  persistentKeepalive?: number;
  /** MTU (default 1420) */
  mtu?: number;
}

export interface SiteVPNProfile {
  siteId: string;
  siteName: string;
  config: VPNConfig;
  clientPublicKey: string;
  clientPrivateKey: string;
  createdAt: string;
  updatedAt: string;
  lastTestedAt: string | null;
  lastTestResult: ConnectivityResult | null;
}

export interface ConnectivityResult {
  vpnReachable: boolean;
  gatewayReachable: boolean;
  devicesReachable: number;
  latencyMs: number;
}

interface WireGuardKeyPair {
  publicKey: string;
  privateKey: string;
}

// ── X25519 Key Generation ─────────────────────────────────────────────────

/**
 * Generate an X25519 keypair for WireGuard.
 * Uses Node.js crypto module with DH key exchange (X25519 curve).
 */
function generateX25519KeyPair(): WireGuardKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  // Extract raw 32-byte keys from DER encoding
  // X25519 SPKI DER: 12-byte header + 32-byte key
  const rawPublic = publicKey.subarray(publicKey.length - 32);
  // X25519 PKCS8 DER: 16-byte header + 32-byte key
  const rawPrivate = privateKey.subarray(privateKey.length - 32);

  return {
    publicKey: rawPublic.toString('base64'),
    privateKey: rawPrivate.toString('base64'),
  };
}

// ── Tenant settings helpers ───────────────────────────────────────────────

type TenantSettings = Record<string, unknown>;

async function getTenantSettings(tenantId: string): Promise<TenantSettings> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return ((tenant?.settings ?? {}) as TenantSettings);
}

async function saveTenantSettings(tenantId: string, settings: TenantSettings): Promise<void> {
  await db.update(tenants).set({ settings }).where(eq(tenants.id, tenantId));
}

function getVpnProfiles(settings: TenantSettings): Record<string, SiteVPNProfile> {
  return (settings.vpn_profiles ?? {}) as Record<string, SiteVPNProfile>;
}

// ── VPNManager class ──────────────────────────────────────────────────────

export class VPNManager {

  // ── Key generation ────────────────────────────────────────────────────

  /**
   * Generate a new WireGuard-compatible X25519 keypair.
   */
  generateKeyPair(): WireGuardKeyPair {
    return generateX25519KeyPair();
  }

  // ── WireGuard config generation ───────────────────────────────────────

  /**
   * Generate a WireGuard configuration file string.
   * If no client private key is supplied, a new keypair is generated.
   */
  generateWireGuardConfig(params: VPNConfig): {
    config: string;
    publicKey: string;
    privateKey: string;
  } {
    let privateKey: string;
    let publicKey: string;

    if (params.clientPrivateKey) {
      // Derive public key from provided private key
      privateKey = params.clientPrivateKey;
      const privKeyObj = crypto.createPrivateKey({
        key: Buffer.concat([
          // PKCS8 DER header for X25519
          Buffer.from('302e020100300506032b656e04220420', 'hex'),
          Buffer.from(privateKey, 'base64'),
        ]),
        format: 'der',
        type: 'pkcs8',
      });
      const pubKeyDer = crypto.createPublicKey(privKeyObj).export({ type: 'spki', format: 'der' });
      publicKey = pubKeyDer.subarray(pubKeyDer.length - 32).toString('base64');
    } else {
      const pair = generateX25519KeyPair();
      privateKey = pair.privateKey;
      publicKey = pair.publicKey;
    }

    const mtu = params.mtu ?? 1420;
    const keepalive = params.persistentKeepalive ?? 25;

    const lines: string[] = [
      '[Interface]',
      `PrivateKey = ${privateKey}`,
      `Address = ${params.clientAddress}`,
      `MTU = ${mtu}`,
    ];

    if (params.dns) {
      lines.push(`DNS = ${params.dns}`);
    }

    lines.push('');
    lines.push('[Peer]');
    lines.push(`PublicKey = ${params.serverPublicKey}`);
    lines.push(`Endpoint = ${params.serverEndpoint}`);
    lines.push(`AllowedIPs = ${params.allowedIPs}`);
    lines.push(`PersistentKeepalive = ${keepalive}`);

    return {
      config: lines.join('\n'),
      publicKey,
      privateKey,
    };
  }

  // ── Site VPN profile CRUD ─────────────────────────────────────────────

  /**
   * Create a VPN profile for a site. Stored in tenant settings JSONB
   * under the "vpn_profiles" key, keyed by siteId.
   */
  async createSiteProfile(
    tenantId: string,
    siteId: string,
    params: VPNConfig,
  ): Promise<SiteVPNProfile> {
    // Verify site belongs to tenant
    const [site] = await db
      .select({ id: sites.id, name: sites.name })
      .from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.tenantId, tenantId)))
      .limit(1);

    if (!site) {
      throw new Error(`Site ${siteId} not found for this tenant`);
    }

    const { publicKey, privateKey } = this.generateWireGuardConfig(params);
    const now = new Date().toISOString();

    const profile: SiteVPNProfile = {
      siteId,
      siteName: site.name,
      config: {
        ...params,
        clientPrivateKey: undefined, // Don't store in config copy
      },
      clientPublicKey: publicKey,
      clientPrivateKey: privateKey,
      createdAt: now,
      updatedAt: now,
      lastTestedAt: null,
      lastTestResult: null,
    };

    const settings = await getTenantSettings(tenantId);
    const profiles = getVpnProfiles(settings);
    profiles[siteId] = profile;
    settings.vpn_profiles = profiles;

    await saveTenantSettings(tenantId, settings);
    return profile;
  }

  /**
   * Retrieve the VPN profile for a site.
   */
  async getSiteProfile(tenantId: string, siteId: string): Promise<SiteVPNProfile | null> {
    const settings = await getTenantSettings(tenantId);
    const profiles = getVpnProfiles(settings);
    return profiles[siteId] ?? null;
  }

  /**
   * Update an existing site VPN profile.
   */
  async updateSiteProfile(
    tenantId: string,
    siteId: string,
    params: Partial<VPNConfig>,
  ): Promise<SiteVPNProfile> {
    const settings = await getTenantSettings(tenantId);
    const profiles = getVpnProfiles(settings);
    const existing = profiles[siteId];

    if (!existing) {
      throw new Error(`VPN profile for site ${siteId} not found`);
    }

    // Merge config updates
    const updatedConfig: VPNConfig = {
      ...existing.config,
      ...params,
    };

    // If server key or endpoint changed, regenerate client keys
    let { clientPublicKey, clientPrivateKey } = existing;
    if (params.clientPrivateKey || params.serverPublicKey) {
      const generated = this.generateWireGuardConfig(updatedConfig);
      clientPublicKey = generated.publicKey;
      clientPrivateKey = generated.privateKey;
    }

    const updatedProfile: SiteVPNProfile = {
      ...existing,
      config: { ...updatedConfig, clientPrivateKey: undefined },
      clientPublicKey,
      clientPrivateKey,
      updatedAt: new Date().toISOString(),
    };

    profiles[siteId] = updatedProfile;
    settings.vpn_profiles = profiles;
    await saveTenantSettings(tenantId, settings);

    return updatedProfile;
  }

  /**
   * Delete a site VPN profile.
   */
  async deleteSiteProfile(tenantId: string, siteId: string): Promise<void> {
    const settings = await getTenantSettings(tenantId);
    const profiles = getVpnProfiles(settings);

    if (!profiles[siteId]) {
      throw new Error(`VPN profile for site ${siteId} not found`);
    }

    delete profiles[siteId];
    settings.vpn_profiles = profiles;
    await saveTenantSettings(tenantId, settings);
  }

  // ── Connectivity testing ──────────────────────────────────────────────

  /**
   * Test VPN connectivity for a site by probing:
   * 1. The VPN server endpoint
   * 2. The site gateway (first IP in allowedIPs range)
   * 3. Individual devices registered for the site
   */
  async testConnectivity(tenantId: string, siteId: string): Promise<ConnectivityResult> {
    const settings = await getTenantSettings(tenantId);
    const profiles = getVpnProfiles(settings);
    const profile = profiles[siteId];

    if (!profile) {
      throw new Error(`VPN profile for site ${siteId} not found`);
    }

    const result: ConnectivityResult = {
      vpnReachable: false,
      gatewayReachable: false,
      devicesReachable: 0,
      latencyMs: 0,
    };

    const startTime = Date.now();

    // 1. Test VPN server endpoint
    try {
      const [host, portStr] = profile.config.serverEndpoint.split(':');
      const port = parseInt(portStr, 10) || 51820;
      // WireGuard uses UDP, so we do a basic TCP probe on the port
      // In practice, WireGuard servers won't respond to TCP, but we check reachability
      const vpnTest = await networkScanner.scanPort(host, port, 5000);
      result.vpnReachable = vpnTest.open;
    } catch {
      result.vpnReachable = false;
    }

    // 2. Test gateway (derive from allowedIPs — first usable IP in the range)
    try {
      const allowedIPs = profile.config.allowedIPs.split(',')[0].trim();
      const gatewayIp = allowedIPs.includes('/')
        ? allowedIPs.split('/')[0].replace(/\.0$/, '.1') // e.g. 192.168.1.0/24 → 192.168.1.1
        : allowedIPs;

      const gwTest = await networkScanner.scanPort(gatewayIp, 80, 5000);
      result.gatewayReachable = gwTest.open;
    } catch {
      result.gatewayReachable = false;
    }

    // 3. Test devices in the site
    try {
      const siteDevices = await db
        .select({ ipAddress: devices.ipAddress, port: devices.port })
        .from(devices)
        .where(and(eq(devices.siteId, siteId), eq(devices.tenantId, tenantId)));

      const deviceTests = await Promise.all(
        siteDevices
          .filter((d) => d.ipAddress)
          .map(async (d) => {
            const testPort = d.port ?? 80;
            const probe = await networkScanner.scanPort(d.ipAddress!, testPort, 3000);
            return probe.open;
          }),
      );

      result.devicesReachable = deviceTests.filter(Boolean).length;
    } catch {
      result.devicesReachable = 0;
    }

    result.latencyMs = Date.now() - startTime;

    // Persist test result
    try {
      profile.lastTestedAt = new Date().toISOString();
      profile.lastTestResult = result;
      profiles[siteId] = profile;
      settings.vpn_profiles = profiles;
      await saveTenantSettings(tenantId, settings);
    } catch {
      // Non-critical: don't fail if we can't persist the test result
    }

    return result;
  }
}

// ── Singleton export ────────────────────────────────────────────────────

export const vpnManager = new VPNManager();
