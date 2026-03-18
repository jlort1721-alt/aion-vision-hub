import { createHmac } from 'crypto';
import { NotFoundError, AppError, ErrorCodes } from '@aion/shared-contracts';
import type { StreamRegistration, SignedStreamUrl } from '@aion/shared-contracts';
import type { RegisterStreamInput, StreamUrlInput } from './schemas.js';
import { config } from '../../config/env.js';
import { redis } from '../../lib/redis.js';

/**
 * Sign a stream token payload with HMAC-SHA256.
 * Format: base64url(payload).base64url(signature)
 */
function signStreamToken(payload: Record<string, unknown>): string {
  const data = JSON.stringify(payload);
  const dataB64 = Buffer.from(data).toString('base64url');
  const signature = createHmac('sha256', config.JWT_SECRET).update(dataB64).digest('base64url');
  return `${dataB64}.${signature}`;
}

/**
 * Verify and decode a stream token.
 * Returns the decoded payload if valid and not expired, null otherwise.
 */
export function verifyStreamToken(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [dataB64, sig] = parts;
  const expectedSig = createHmac('sha256', config.JWT_SECRET).update(dataB64).digest('base64url');

  // Constant-time comparison via Buffer.equals
  if (!Buffer.from(sig).equals(Buffer.from(expectedSig))) return null;

  try {
    const payload = JSON.parse(Buffer.from(dataB64, 'base64url').toString()) as Record<string, unknown>;
    if (typeof payload.exp === 'number' && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── Stream Registry (Redis-backed with in-memory fallback) ──

type RegistryEntry = StreamRegistration & { tenantId: string };

/** In-memory fallback when Redis is not configured. */
const memoryRegistry = new Map<string, RegistryEntry>();

const REDIS_PREFIX = 'stream:';
const STREAM_TTL_SECONDS = 600; // 10 min — gateways re-register periodically

function registryKey(tenantId: string, deviceId: string): string {
  return `${tenantId}:${deviceId}`;
}

async function registryGet(key: string): Promise<RegistryEntry | null> {
  if (redis) {
    const data = await redis.get(`${REDIS_PREFIX}${key}`);
    if (!data) return null;
    const entry = JSON.parse(data) as RegistryEntry;
    entry.registeredAt = new Date(entry.registeredAt);
    entry.lastStateChange = new Date(entry.lastStateChange);
    return entry;
  }
  return memoryRegistry.get(key) ?? null;
}

async function registrySet(key: string, entry: RegistryEntry): Promise<void> {
  if (redis) {
    await redis.set(`${REDIS_PREFIX}${key}`, JSON.stringify(entry), 'EX', STREAM_TTL_SECONDS);
  } else {
    memoryRegistry.set(key, entry);
  }
}

async function registryDel(key: string): Promise<boolean> {
  if (redis) {
    const count = await redis.del(`${REDIS_PREFIX}${key}`);
    return count > 0;
  }
  return memoryRegistry.delete(key);
}

async function registryListByTenant(tenantId: string): Promise<RegistryEntry[]> {
  if (redis) {
    const keys = await redis.keys(`${REDIS_PREFIX}${tenantId}:*`);
    if (!keys.length) return [];
    const pipeline = redis.pipeline();
    for (const k of keys) pipeline.get(k);
    const results = await pipeline.exec();
    return (results ?? [])
      .filter(([err, val]: [Error | null, unknown]) => !err && val)
      .map(([, val]: [Error | null, unknown]) => {
        const entry = JSON.parse(val as string) as RegistryEntry;
        entry.registeredAt = new Date(entry.registeredAt);
        entry.lastStateChange = new Date(entry.lastStateChange);
        return entry;
      });
  }
  const results: RegistryEntry[] = [];
  for (const entry of memoryRegistry.values()) {
    if (entry.tenantId === tenantId) results.push(entry);
  }
  return results;
}

// ── Service ─────────────────────────────────────────────────

export class StreamService {
  /**
   * List all registered stream entries for a tenant.
   */
  async list(tenantId: string) {
    return registryListByTenant(tenantId);
  }

  /**
   * Register (or re-register) stream profiles coming from a gateway.
   */
  async register(data: RegisterStreamInput, tenantId: string) {
    const key = registryKey(tenantId, data.deviceId);

    const registration: RegistryEntry = {
      tenantId,
      deviceId: data.deviceId,
      gatewayId: data.gatewayId ?? '',
      siteId: data.siteId,
      profiles: data.profiles.map((p) => ({
        type: p.type,
        url: p.url,
        codec: p.codec,
        resolution: p.resolution,
        fps: p.fps,
        bitrate: p.bitrate,
        channel: p.channel,
      })),
      activeProfile: data.activeProfile,
      state: 'live',
      registeredAt: new Date(),
      lastStateChange: new Date(),
    };

    await registrySet(key, registration);
    return registration;
  }

  /**
   * Generate a time-limited signed URL for a specific stream.
   */
  async getStreamUrl(
    deviceId: string,
    params: StreamUrlInput,
    tenantId: string,
  ): Promise<SignedStreamUrl> {
    const key = registryKey(tenantId, deviceId);
    const entry = await registryGet(key);

    if (!entry) {
      throw new NotFoundError('Stream registration', deviceId);
    }

    if (entry.state !== 'live' && entry.state !== 'degraded') {
      throw new AppError(
        ErrorCodes.STREAM_UNAVAILABLE,
        `Stream for device ${deviceId} is currently ${entry.state}`,
        503,
      );
    }

    // Find the requested profile
    const profile = entry.profiles.find(
      (p) =>
        p.type === params.type &&
        (params.channel === undefined || p.channel === params.channel),
    );

    if (!profile) {
      throw new AppError(
        ErrorCodes.STREAM_NOT_FOUND,
        `No ${params.type} stream profile found for device ${deviceId}`,
        404,
      );
    }

    // Generate HMAC-SHA256 signed stream token (5 min TTL)
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const token = signStreamToken({ deviceId, tenantId, type: params.type, exp: expiresAt });

    // Build the mediated URL depending on requested protocol
    let url: string;
    switch (params.protocol) {
      case 'hls':
        url = `/mediamtx/${tenantId}/${deviceId}/${params.type}/index.m3u8?token=${token}`;
        break;
      case 'webrtc':
        url = `/mediamtx/${tenantId}/${deviceId}/${params.type}/whep?token=${token}`;
        break;
      case 'rtsp':
      default:
        url = profile.url;
        break;
    }

    return {
      url,
      token,
      expiresAt,
      protocol: params.protocol,
      deviceId,
      streamType: params.type,
    };
  }

  /**
   * Remove a stream registration (e.g. when a device goes offline).
   */
  async unregister(deviceId: string, tenantId: string) {
    const key = registryKey(tenantId, deviceId);
    return registryDel(key);
  }
}

export const streamService = new StreamService();
