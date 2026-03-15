import { request } from 'undici';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';
import { maskCredentialsInUrl } from '../utils/digest-auth.js';
import { DeviceManager } from './device-manager.js';

interface ActiveStream {
  deviceId: string;
  streamType: 'main' | 'sub';
  channel: number;
  rtspUrl: string;
  webrtcPath: string;
  startedAt: Date;
  lastHealthCheck?: Date;
  healthy: boolean;
}

/**
 * StreamManager — manages RTSP → WebRTC/HLS proxy sessions via MediaMTX.
 *
 * When a client requests a live stream, this service:
 * 1. Resolves the RTSP URL from the device adapter
 * 2. Verifies MediaMTX is reachable
 * 3. Registers the RTSP source in MediaMTX via its REST API
 * 4. Returns WebRTC + HLS endpoint URLs for the browser
 *
 * MediaMTX REST API (v3):
 *   POST /v3/config/paths/add/{name}   — register RTSP source
 *   DELETE /v3/config/paths/delete/{name} — remove source
 *   GET /v3/paths/list                  — list active paths
 */
export class StreamManager {
  private activeStreams = new Map<string, ActiveStream>();
  private deviceManager: DeviceManager;
  private mediamtxHealthy = false;
  private mediamtxHost: string;

  constructor(deviceManager: DeviceManager) {
    this.deviceManager = deviceManager;
    this.mediamtxHost = new URL(config.MEDIAMTX_API_URL).hostname;
  }

  /**
   * Check if MediaMTX is reachable. Called at startup and periodically.
   */
  async checkMediaMTXHealth(): Promise<boolean> {
    try {
      const { statusCode } = await request(`${config.MEDIAMTX_API_URL}/v3/paths/list`, {
        method: 'GET',
        headersTimeout: 3000,
        bodyTimeout: 3000,
      });
      this.mediamtxHealthy = statusCode === 200;
    } catch {
      this.mediamtxHealthy = false;
    }

    if (!this.mediamtxHealthy) {
      logger.warn({ url: config.MEDIAMTX_API_URL }, 'MediaMTX is not reachable');
    }
    return this.mediamtxHealthy;
  }

  isMediaMTXHealthy(): boolean {
    return this.mediamtxHealthy;
  }

  async startStream(
    deviceId: string,
    streamType: 'main' | 'sub' = 'sub',
    channel = 1,
  ): Promise<{ webrtcUrl: string; hlsUrl: string } | null> {
    const key = `${deviceId}:${streamType}:${channel}`;

    // Return existing stream if already active
    const existing = this.activeStreams.get(key);
    if (existing) {
      return {
        webrtcUrl: `http://${this.mediamtxHost}:${config.MEDIAMTX_WEBRTC_PORT}/${existing.webrtcPath}`,
        hlsUrl: `http://${this.mediamtxHost}:${config.MEDIAMTX_HLS_PORT}/${existing.webrtcPath}/index.m3u8`,
      };
    }

    // Pre-flight: verify MediaMTX is reachable
    if (!this.mediamtxHealthy) {
      await this.checkMediaMTXHealth();
      if (!this.mediamtxHealthy) {
        logger.error({ deviceId }, 'Cannot start stream: MediaMTX is not reachable');
        return null;
      }
    }

    // Resolve RTSP URL from device adapter
    const rtspUrl = this.deviceManager.getStreamUrl(deviceId, streamType, channel);
    if (!rtspUrl) {
      logger.warn({ deviceId, streamType }, 'No RTSP URL available from adapter');
      return null;
    }

    // Build safe MediaMTX path name
    const safeName = deviceId.replace(/[^a-zA-Z0-9-]/g, '_');
    const pathName = `aion/${safeName}/${streamType}`;

    try {
      const { statusCode, body } = await request(
        `${config.MEDIAMTX_API_URL}/v3/config/paths/add/${pathName}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: rtspUrl,
            sourceOnDemand: true,
            sourceOnDemandCloseAfter: '30s',
          }),
          headersTimeout: 5000,
          bodyTimeout: 5000,
        },
      );

      // MediaMTX returns 200 on success, 400 if path already exists
      if (statusCode !== 200 && statusCode !== 400) {
        const text = await body.text();
        logger.error({ deviceId, statusCode, response: text }, 'MediaMTX path registration failed');
        return null;
      }
      // Drain body if we didn't read it
      if (statusCode === 200) await body.text();

      this.activeStreams.set(key, {
        deviceId,
        streamType,
        channel,
        rtspUrl,
        webrtcPath: pathName,
        startedAt: new Date(),
        healthy: true,
      });

      logger.info(
        { deviceId, pathName, rtspUrl: maskCredentialsInUrl(rtspUrl) },
        'Stream registered in MediaMTX',
      );

      return {
        webrtcUrl: `http://${this.mediamtxHost}:${config.MEDIAMTX_WEBRTC_PORT}/${pathName}`,
        hlsUrl: `http://${this.mediamtxHost}:${config.MEDIAMTX_HLS_PORT}/${pathName}/index.m3u8`,
      };
    } catch (err) {
      logger.error({ deviceId, err }, 'Failed to register stream in MediaMTX');
      return null;
    }
  }

  async stopStream(deviceId: string, streamType: 'main' | 'sub' = 'sub', channel = 1): Promise<void> {
    const key = `${deviceId}:${streamType}:${channel}`;
    const stream = this.activeStreams.get(key);
    if (!stream) return;

    try {
      await request(`${config.MEDIAMTX_API_URL}/v3/config/paths/delete/${stream.webrtcPath}`, {
        method: 'DELETE',
        headersTimeout: 3000,
        bodyTimeout: 3000,
      });
    } catch (err) {
      logger.warn({ deviceId, err }, 'Failed to remove stream from MediaMTX');
    }

    this.activeStreams.delete(key);
    logger.info({ deviceId, streamType, channel }, 'Stream stopped');
  }

  listActive(): ActiveStream[] {
    return Array.from(this.activeStreams.values());
  }

  async stopAll(): Promise<void> {
    for (const [key, stream] of this.activeStreams) {
      try {
        await request(`${config.MEDIAMTX_API_URL}/v3/config/paths/delete/${stream.webrtcPath}`, {
          method: 'DELETE',
          headersTimeout: 3000,
          bodyTimeout: 3000,
        });
      } catch {
        // Best-effort cleanup
      }
      this.activeStreams.delete(key);
    }
    logger.info('All streams stopped');
  }

  /**
   * Check health of all active streams by verifying their paths in MediaMTX.
   * Call this periodically to detect stale/dead streams.
   */
  async healthCheckStreams(): Promise<void> {
    if (!this.mediamtxHealthy) return;

    try {
      const { statusCode, body } = await request(`${config.MEDIAMTX_API_URL}/v3/paths/list`, {
        method: 'GET',
        headersTimeout: 3000,
        bodyTimeout: 3000,
      });

      if (statusCode !== 200) return;

      const data = JSON.parse(await body.text());
      const activePaths = new Set<string>();
      for (const item of data.items || []) {
        activePaths.add(item.name);
      }

      for (const [, stream] of this.activeStreams) {
        const wasHealthy = stream.healthy;
        stream.healthy = activePaths.has(stream.webrtcPath);
        stream.lastHealthCheck = new Date();

        if (wasHealthy && !stream.healthy) {
          logger.warn({ deviceId: stream.deviceId, path: stream.webrtcPath }, 'Stream no longer active in MediaMTX');
        }
      }
    } catch (err) {
      logger.debug({ err }, 'Stream health check failed');
    }
  }
}
