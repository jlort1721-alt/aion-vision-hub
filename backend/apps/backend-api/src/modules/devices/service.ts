import { eq, and, sql } from 'drizzle-orm';
import net from 'net';
import { db } from '../../db/client.js';
import { devices, sites, streams } from '../../db/schema/index.js';
import { config } from '../../config/env.js';
import { encrypt, decrypt, createLogger } from '@aion/common-utils';
import { NotFoundError } from '@aion/shared-contracts';
import type { StreamProfile } from '@aion/shared-contracts';
import type { CreateDeviceInput, UpdateDeviceInput, DeviceFilters } from './schemas.js';

const logger = createLogger({ name: 'device-service' });

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
 * Decrypt username and password on a device record (internal use only).
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
 * Strip sensitive credentials from a device record for public API responses.
 * Replaces username/password with a `credentials_available` boolean flag.
 */
function stripCredentials(device: Record<string, unknown>): Record<string, unknown> {
  const { username, password, ...safe } = device;
  return {
    ...safe,
    credentials_available: Boolean(username || password),
  };
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

    const items = rows.map(r => stripCredentials(enrichDevice(decryptDeviceCredentials(r.device), r.wanIp)));

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
    return stripCredentials(enrichDevice(decryptDeviceCredentials(row.device), row.wanIp));
  }

  /**
   * Get a single device by ID with credentials included (internal use only).
   * Used by routes that need device credentials for stream registration, validation, etc.
   */
  async getByIdWithCredentials(id: string, tenantId: string) {
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
   * Get decrypted credentials for a device (admin-only endpoint).
   * Returns { username, password } with actual values.
   */
  async getCredentials(id: string, tenantId: string) {
    const [row] = await db
      .select({
        username: devices.username,
        password: devices.password,
      })
      .from(devices)
      .where(and(eq(devices.id, id), eq(devices.tenantId, tenantId)))
      .limit(1);

    if (!row) throw new NotFoundError('Device', id);

    return {
      username: decryptCredential(row.username) ?? null,
      password: decryptCredential(row.password) ?? null,
    };
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

  /**
   * Get all channels/streams for a device, scoped by tenant.
   */
  async getChannels(deviceId: string, tenantId: string) {
    // Verify device belongs to tenant
    const [device] = await db
      .select({ id: devices.id })
      .from(devices)
      .where(and(eq(devices.id, deviceId), eq(devices.tenantId, tenantId)))
      .limit(1);

    if (!device) throw new NotFoundError('Device', deviceId);

    const rows = await db
      .select()
      .from(streams)
      .where(and(eq(streams.deviceId, deviceId), eq(streams.tenantId, tenantId)));

    return rows;
  }

  /**
   * Sync channels/streams from a device adapter into the streams table.
   *
   * 1. Uses adapter (via provided stream profiles) to query device for channels.
   *    If no profiles are provided, generates default profiles based on device.channels.
   * 2. Compares with existing stream records in DB.
   * 3. Creates new, updates existing, disables removed stream records.
   * 4. Returns a sync result summary.
   */
  async syncChannels(
    deviceId: string,
    tenantId: string,
    adapterProfiles?: StreamProfile[],
  ) {
    // Verify device belongs to tenant and get device info
    const [row] = await db
      .select({ device: devices })
      .from(devices)
      .where(and(eq(devices.id, deviceId), eq(devices.tenantId, tenantId)))
      .limit(1);

    if (!row) throw new NotFoundError('Device', deviceId);
    const device = row.device;

    // Get existing streams from DB
    const existingStreams = await db
      .select()
      .from(streams)
      .where(and(eq(streams.deviceId, deviceId), eq(streams.tenantId, tenantId)));

    // Build profiles list: use adapter profiles if provided, otherwise generate defaults
    const profiles: StreamProfile[] = adapterProfiles ?? this.generateDefaultProfiles(device);

    // Build a key for matching: channel + type
    const profileKey = (channel: number, type: string) => `${channel}:${type}`;

    const existingMap = new Map(
      existingStreams.map((s) => [profileKey(s.channel, s.type), s]),
    );

    const profileMap = new Map(
      profiles.map((p) => [profileKey(p.channel ?? 1, p.type), p]),
    );

    let created = 0;
    let updated = 0;
    let disabled = 0;

    // Create or update streams from adapter profiles
    for (const profile of profiles) {
      const key = profileKey(profile.channel ?? 1, profile.type);
      const existing = existingMap.get(key);

      if (existing) {
        // Update existing stream if any property changed
        const needsUpdate =
          existing.codec !== profile.codec ||
          existing.resolution !== profile.resolution ||
          existing.fps !== profile.fps ||
          existing.bitrate !== (profile.bitrate ?? null) ||
          existing.urlTemplate !== profile.url ||
          !existing.isActive;

        if (needsUpdate) {
          await db
            .update(streams)
            .set({
              codec: profile.codec,
              resolution: profile.resolution,
              fps: profile.fps,
              bitrate: profile.bitrate ?? null,
              urlTemplate: profile.url,
              isActive: true,
            })
            .where(eq(streams.id, existing.id));
          updated++;
        }
      } else {
        // Create new stream record
        await db.insert(streams).values({
          deviceId,
          tenantId,
          channel: profile.channel ?? 1,
          type: profile.type,
          codec: profile.codec,
          resolution: profile.resolution,
          fps: profile.fps,
          bitrate: profile.bitrate ?? null,
          urlTemplate: profile.url,
          protocol: 'rtsp',
          isActive: true,
        });
        created++;
      }
    }

    // Disable streams that no longer exist in the adapter profiles
    for (const [key, existing] of existingMap) {
      if (!profileMap.has(key) && existing.isActive) {
        await db
          .update(streams)
          .set({ isActive: false })
          .where(eq(streams.id, existing.id));
        disabled++;
      }
    }

    const result = {
      deviceId,
      channels: profiles.length,
      created,
      updated,
      disabled,
      total: existingStreams.length + created,
      syncedAt: new Date().toISOString(),
    };

    logger.info({ syncResult: result }, 'Channel sync completed');

    return result;
  }

  /**
   * Generate default stream profiles for a device based on its channel count.
   * Used as a fallback when the adapter doesn't provide profiles.
   */
  private generateDefaultProfiles(device: Record<string, unknown>): StreamProfile[] {
    const channelCount = (device.channels as number) ?? 1;
    const profiles: StreamProfile[] = [];

    for (let ch = 1; ch <= channelCount; ch++) {
      profiles.push({
        type: 'main',
        url: '',
        codec: 'H.264',
        resolution: '1920x1080',
        fps: 25,
        channel: ch,
      });
      profiles.push({
        type: 'sub',
        url: '',
        codec: 'H.264',
        resolution: '640x480',
        fps: 15,
        channel: ch,
      });
    }

    return profiles;
  }
}

export const deviceService = new DeviceService();
