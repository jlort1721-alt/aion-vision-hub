import { NotFoundError, AppError, ErrorCodes } from '@aion/shared-contracts';
import type { StreamRegistration, SignedStreamUrl } from '@aion/shared-contracts';
import type { RegisterStreamInput, StreamUrlInput } from './schemas.js';

/**
 * In-memory stream registry.
 * Key: `${tenantId}:${deviceId}`
 *
 * In production this would be backed by Redis or a similar fast store
 * so that state is shared across API instances.
 */
const streamRegistry = new Map<string, StreamRegistration & { tenantId: string }>();

function registryKey(tenantId: string, deviceId: string): string {
  return `${tenantId}:${deviceId}`;
}

export class StreamService {
  /**
   * List all registered stream entries for a tenant.
   */
  list(tenantId: string) {
    const results: Array<StreamRegistration & { tenantId: string }> = [];
    for (const entry of streamRegistry.values()) {
      if (entry.tenantId === tenantId) {
        results.push(entry);
      }
    }
    return results;
  }

  /**
   * Register (or re-register) stream profiles coming from a gateway.
   */
  register(data: RegisterStreamInput, tenantId: string) {
    const key = registryKey(tenantId, data.deviceId);

    const registration: StreamRegistration & { tenantId: string } = {
      tenantId,
      deviceId: data.deviceId,
      gatewayId: data.gatewayId,
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

    streamRegistry.set(key, registration);
    return registration;
  }

  /**
   * Generate a time-limited signed URL for a specific stream.
   */
  getStreamUrl(
    deviceId: string,
    params: StreamUrlInput,
    tenantId: string,
  ): SignedStreamUrl {
    const key = registryKey(tenantId, deviceId);
    const entry = streamRegistry.get(key);

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

    // Generate a signed token (placeholder — use HMAC or JWT in production)
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    const token = Buffer.from(
      JSON.stringify({ deviceId, type: params.type, exp: expiresAt }),
    ).toString('base64url');

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
  unregister(deviceId: string, tenantId: string) {
    const key = registryKey(tenantId, deviceId);
    return streamRegistry.delete(key);
  }
}

export const streamService = new StreamService();
