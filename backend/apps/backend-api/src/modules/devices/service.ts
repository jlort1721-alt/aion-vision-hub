import { eq, and, sql } from 'drizzle-orm';
import net from 'net';
import { db } from '../../db/client.js';
import { devices, sites } from '../../db/schema/index.js';
import { config } from '../../config/env.js';
import { encrypt, decrypt } from '@aion/common-utils';
import { NotFoundError } from '@aion/shared-contracts';
import type { CreateDeviceInput, UpdateDeviceInput, DeviceFilters } from './schemas.js';

/**
 * Encrypt a credential value. Returns original if no encryption key configured.
 */
function encryptCredential(value: string | null | undefined): string | null {
  if (!value) return null;
  const encKey = config.CREDENTIAL_ENCRYPTION_KEY;
  if (!encKey) return value;
  return encrypt(value, encKey);
}

/**
 * Decrypt a credential value. Returns original if decryption fails (plain text fallback).
 */
function decryptCredential(value: string | null | undefined): string | null {
  if (!value) return null;
  const encKey = config.CREDENTIAL_ENCRYPTION_KEY;
  if (!encKey) return value;
  // Check if it looks encrypted (iv:tag:ciphertext format)
  if (!value.includes(':')) return value;
  try {
    return decrypt(value, encKey);
  } catch {
    return value; // plain text fallback for pre-migration data
  }
}

/**
 * Decrypt username and password on a device record for API responses.
 */
function decryptDeviceCredentials(device: Record<string, unknown>): Record<string, unknown> {
  const result = { ...device };
  if (typeof result.username === 'string') {
    result.username = decryptCredential(result.username);
  }
  if (typeof result.password === 'string') {
    result.password = decryptCredential(result.password);
  }
  return result;
}

/**
 * Compute the remote (public) address for a device.
 * Devices behind a router are accessed via the site's WAN IP + the device's mapped port.
 */
function computeRemoteAddress(wanIp: string | null, port: number | null): string | null {
  if (!wanIp || !port) return null;
  return `${wanIp}:${port}`;
}

/**
 * Enrich a device row with its remote address from the site WAN IP.
 */
function enrichDevice(device: Record<string, unknown>, wanIp: string | null) {
  return {
    ...device,
    remoteAddress: computeRemoteAddress(wanIp as string | null, device.port as number | null),
    wanIp,
  };
}

/**
 * TCP connectivity check to a remote host:port.
 * Returns latency in ms or null if unreachable.
 */
function tcpPing(host: string, port: number, timeoutMs = 5000): Promise<{ reachable: boolean; latencyMs: number | null }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const latencyMs = Date.now() - start;
      socket.destroy();
      resolve({ reachable: true, latencyMs });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ reachable: false, latencyMs: null });
    });

    socket.on('error', () => {
      socket.destroy();
      resolve({ reachable: false, latencyMs: null });
    });

    socket.connect(port, host);
  });
}

export class DeviceService {
  /**
   * List devices for a tenant with optional filters and pagination.
   * Includes computed remoteAddress (WAN_IP:PORT) for each device.
   */
  async list(tenantId: string, filters?: DeviceFilters) {
    const conditions = [eq(devices.tenantId, tenantId)];

    if (filters?.siteId) {
      conditions.push(eq(devices.siteId, filters.siteId));
    }
    if (filters?.status) {
      conditions.push(eq(devices.status, filters.status));
    }
    if (filters?.brand) {
      conditions.push(eq(devices.brand, filters.brand));
    }
    if (filters?.type) {
      conditions.push(eq(devices.type, filters.type));
    }

    const whereClause = and(...conditions);
    const page = filters?.page ?? 1;
    const perPage = filters?.perPage ?? 100;
    const offset = (page - 1) * perPage;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(devices)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    const rows = await db
      .select({
        device: devices,
        wanIp: sites.wanIp,
      })
      .from(devices)
      .leftJoin(sites, eq(devices.siteId, sites.id))
      .where(whereClause)
      .orderBy(devices.createdAt)
      .limit(perPage)
      .offset(offset);

    const items = rows.map(r => enrichDevice(decryptDeviceCredentials(r.device), r.wanIp));

    return {
      items,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  /**
   * Get a single device by ID, scoped to tenant.
   * Includes computed remoteAddress.
   */
  async getById(id: string, tenantId: string) {
    const [row] = await db
      .select({
        device: devices,
        wanIp: sites.wanIp,
      })
      .from(devices)
      .leftJoin(sites, eq(devices.siteId, sites.id))
      .where(and(eq(devices.id, id), eq(devices.tenantId, tenantId)))
      .limit(1);

    if (!row) throw new NotFoundError('Device', id);
    return enrichDevice(decryptDeviceCredentials(row.device), row.wanIp);
  }

  /**
   * Create a new device.
   */
  async create(data: CreateDeviceInput, tenantId: string) {
    const [site] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.id, data.siteId), eq(sites.tenantId, tenantId)))
      .limit(1);

    if (!site) throw new NotFoundError('Site', data.siteId);

    const [device] = await db
      .insert(devices)
      .values({
        tenantId,
        siteId: data.siteId,
        name: data.name,
        deviceSlug: data.deviceSlug ?? null,
        brand: data.brand ?? 'generic',
        model: data.model ?? '',
        type: data.type,
        ipAddress: data.ip ?? null,
        port: data.port ?? null,
        username: encryptCredential(data.username) ?? null,
        password: encryptCredential(data.password) ?? null,
        subnetMask: data.subnetMask ?? null,
        gateway: data.gateway ?? null,
        operator: data.operator ?? null,
        serialNumber: data.serialNumber ?? null,
        appName: data.appName ?? null,
        appId: data.appId ?? null,
        extension: data.extension ?? null,
        outboundCall: data.outboundCall ?? null,
        connectionType: data.connectionType ?? null,
        channels: data.channels ?? 1,
        tags: data.tags ?? [],
        status: data.status ?? 'unknown',
      })
      .returning();

    return device;
  }

  /**
   * Partially update a device.
   */
  async update(id: string, data: UpdateDeviceInput, tenantId: string) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.brand !== undefined) updateData.brand = data.brand;
    if (data.model !== undefined) updateData.model = data.model;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.ip !== undefined) updateData.ipAddress = data.ip;
    if (data.port !== undefined) updateData.port = data.port;
    if (data.siteId !== undefined) updateData.siteId = data.siteId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.username !== undefined) updateData.username = encryptCredential(data.username);
    if (data.password !== undefined) updateData.password = encryptCredential(data.password);
    if (data.serialNumber !== undefined) updateData.serialNumber = data.serialNumber;
    if (data.deviceSlug !== undefined) updateData.deviceSlug = data.deviceSlug;
    if (data.subnetMask !== undefined) updateData.subnetMask = data.subnetMask;
    if (data.gateway !== undefined) updateData.gateway = data.gateway;
    if (data.operator !== undefined) updateData.operator = data.operator;
    if (data.appName !== undefined) updateData.appName = data.appName;
    if (data.appId !== undefined) updateData.appId = data.appId;
    if (data.extension !== undefined) updateData.extension = data.extension;
    if (data.outboundCall !== undefined) updateData.outboundCall = data.outboundCall;
    if (data.connectionType !== undefined) updateData.connectionType = data.connectionType;

    const [device] = await db
      .update(devices)
      .set(updateData)
      .where(and(eq(devices.id, id), eq(devices.tenantId, tenantId)))
      .returning();

    if (!device) throw new NotFoundError('Device', id);
    return device;
  }

  /**
   * Delete a device.
   */
  async delete(id: string, tenantId: string) {
    const [device] = await db
      .delete(devices)
      .where(and(eq(devices.id, id), eq(devices.tenantId, tenantId)))
      .returning();

    if (!device) throw new NotFoundError('Device', id);
  }

  /**
   * Touch the lastSeenAt timestamp (called after a successful health check).
   */
  async touchLastSeen(id: string, tenantId: string) {
    await db
      .update(devices)
      .set({ lastSeen: new Date(), status: 'online', updatedAt: new Date() })
      .where(and(eq(devices.id, id), eq(devices.tenantId, tenantId)));
  }

  /**
   * Real TCP health check to a device via its public (WAN) address.
   * Tests connectivity to WAN_IP:PORT.
   */
  async healthCheck(id: string, tenantId: string) {
    const [row] = await db
      .select({ device: devices, wanIp: sites.wanIp })
      .from(devices)
      .leftJoin(sites, eq(devices.siteId, sites.id))
      .where(and(eq(devices.id, id), eq(devices.tenantId, tenantId)))
      .limit(1);

    if (!row) throw new NotFoundError('Device', id);

    const d = row.device;
    const wanIp = row.wanIp;
    const port = d.port;

    const result: {
      deviceId: string;
      deviceName: string;
      status: string;
      lastSeen: Date | null;
      lanAddress: string | null;
      remoteAddress: string | null;
      reachable: boolean;
      latencyMs: number | null;
      checkedAt: string;
      error: string | null;
    } = {
      deviceId: d.id,
      deviceName: d.name,
      status: d.status,
      lastSeen: d.lastSeen,
      lanAddress: d.ipAddress ? `${d.ipAddress}:${port || ''}` : null,
      remoteAddress: computeRemoteAddress(wanIp, port),
      reachable: false,
      latencyMs: null,
      checkedAt: new Date().toISOString(),
      error: null,
    };

    if (!wanIp || !port) {
      result.error = !wanIp ? 'No WAN IP configured for this site' : 'No port mapped for this device';
      return result;
    }

    const ping = await tcpPing(wanIp, port);
    result.reachable = ping.reachable;
    result.latencyMs = ping.latencyMs;

    if (ping.reachable) {
      await this.touchLastSeen(id, tenantId);
      result.status = 'online';
    } else {
      result.error = `Device unreachable at ${wanIp}:${port}`;
    }

    return result;
  }

  /**
   * Batch health check for all devices in a site.
   */
  async siteHealthCheck(siteId: string, tenantId: string) {
    const [site] = await db
      .select({ id: sites.id, name: sites.name, wanIp: sites.wanIp })
      .from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.tenantId, tenantId)))
      .limit(1);

    if (!site) throw new NotFoundError('Site', siteId);

    const siteDevices = await db
      .select()
      .from(devices)
      .where(and(eq(devices.siteId, siteId), eq(devices.tenantId, tenantId)))
      .orderBy(devices.name);

    const checkableDevices = siteDevices.filter(d =>
      d.port && site.wanIp &&
      !['network_wan', 'network_lan', 'cloud_account_ewelink', 'cloud_account_hik', 'domotic'].includes(d.type)
    );

    const results = await Promise.allSettled(
      checkableDevices.map(async (d) => {
        const ping = await tcpPing(site.wanIp!, d.port!);
        if (ping.reachable) {
          await db.update(devices)
            .set({ lastSeen: new Date(), status: 'online', updatedAt: new Date() })
            .where(eq(devices.id, d.id));
        }
        return {
          deviceId: d.id,
          deviceName: d.name,
          type: d.type,
          remoteAddress: `${site.wanIp}:${d.port}`,
          reachable: ping.reachable,
          latencyMs: ping.latencyMs,
        };
      })
    );

    const checks = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return {
        deviceId: checkableDevices[i].id,
        deviceName: checkableDevices[i].name,
        type: checkableDevices[i].type,
        remoteAddress: `${site.wanIp}:${checkableDevices[i].port}`,
        reachable: false,
        latencyMs: null,
        error: 'Check failed',
      };
    });

    const online = checks.filter(c => c.reachable).length;
    const offline = checks.filter(c => !c.reachable).length;
    const skipped = siteDevices.length - checkableDevices.length;

    return {
      site: { id: site.id, name: site.name, wanIp: site.wanIp },
      summary: { total: siteDevices.length, checked: checkableDevices.length, online, offline, skipped },
      devices: checks,
      checkedAt: new Date().toISOString(),
    };
  }
}

export const deviceService = new DeviceService();
