import { request } from 'undici';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';
import { DeviceManager } from './device-manager.js';
import { maskCredentialsInUrl } from '../utils/digest-auth.js';
import type { IPlaybackAdapter, RecordingSearchResult } from '../adapters/types.js';

interface PlaybackSession {
  deviceId: string;
  channel: number;
  startTime: string;
  endTime: string;
  rtspUrl: string;
  webrtcUrl: string;
  hlsUrl: string;
  mediamtxPath: string;
  createdAt: Date;
}

/**
 * PlaybackManager — manages NVR/device recording playback sessions.
 *
 * Workflow:
 *   1. Client searches recordings via searchRecordings()
 *   2. Client requests playback via startPlayback()
 *   3. Service resolves playback RTSP URL from brand adapter
 *   4. Registers the RTSP URL in MediaMTX as a source
 *   5. Returns WebRTC + HLS URLs to the client
 *   6. Client stops playback via stopPlayback()
 *
 * The playback RTSP URL format differs by brand:
 *   Hikvision: rtsp://...@ip/Streaming/tracks/101?starttime=...&endtime=...
 *   Dahua:     rtsp://...@ip/cam/playback?channel=1&starttime=...&endtime=...
 *   ONVIF:     rtsp://...@ip/onvif/replay?starttime=...
 */
export class PlaybackManager {
  private deviceManager: DeviceManager;
  private sessions = new Map<string, PlaybackSession>();

  constructor(deviceManager: DeviceManager) {
    this.deviceManager = deviceManager;
  }

  async searchRecordings(
    deviceId: string,
    channel: number,
    startTime: string,
    endTime: string,
  ): Promise<RecordingSearchResult> {
    const device = this.deviceManager.getDevice(deviceId);
    if (!device) {
      return { segments: [], totalCount: 0, totalDurationSeconds: 0 };
    }

    const adapter = device.adapter as Partial<IPlaybackAdapter>;
    if (typeof adapter.searchRecordings !== 'function') {
      logger.warn({ deviceId, brand: device.config.brand }, 'Adapter does not support playback search');
      return { segments: [], totalCount: 0, totalDurationSeconds: 0 };
    }

    return adapter.searchRecordings(deviceId, channel, startTime, endTime);
  }

  async startPlayback(
    deviceId: string,
    channel: number,
    startTime: string,
    endTime: string,
  ): Promise<{ webrtcUrl: string; hlsUrl: string } | null> {
    const sessionKey = `${deviceId}:playback:${channel}:${startTime}:${endTime}`;

    // Return existing session if one is active for the same time window
    const existing = this.sessions.get(sessionKey);
    if (existing) {
      return { webrtcUrl: existing.webrtcUrl, hlsUrl: existing.hlsUrl };
    }

    const device = this.deviceManager.getDevice(deviceId);
    if (!device) {
      logger.warn({ deviceId }, 'Playback: device not found');
      return null;
    }

    const adapter = device.adapter as Partial<IPlaybackAdapter>;
    if (typeof adapter.getPlaybackUrl !== 'function') {
      logger.warn({ deviceId }, 'Playback: adapter does not support getPlaybackUrl');
      return null;
    }

    const rtspUrl = adapter.getPlaybackUrl(deviceId, channel, startTime, endTime);
    if (!rtspUrl) {
      logger.warn({ deviceId }, 'Playback: failed to get RTSP URL');
      return null;
    }

    // Register in MediaMTX
    const safeName = deviceId.replace(/[^a-zA-Z0-9-]/g, '_');
    const pathName = `aion/${safeName}/playback_ch${channel}`;

    try {
      await request(`${config.MEDIAMTX_API_URL}/v3/config/paths/add/${pathName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: rtspUrl,
          sourceOnDemand: true,
          sourceOnDemandCloseAfter: '60s',
        }),
        headersTimeout: 5000,
        bodyTimeout: 5000,
      });
    } catch (err) {
      logger.error({ deviceId, err }, 'Failed to register playback stream in MediaMTX');
      return null;
    }

    const mediamtxHost = new URL(config.MEDIAMTX_API_URL).hostname;
    const webrtcUrl = `http://${mediamtxHost}:${config.MEDIAMTX_WEBRTC_PORT}/${pathName}`;
    const hlsUrl = `http://${mediamtxHost}:${config.MEDIAMTX_HLS_PORT}/${pathName}/index.m3u8`;

    this.sessions.set(sessionKey, {
      deviceId,
      channel,
      startTime,
      endTime,
      rtspUrl,
      webrtcUrl,
      hlsUrl,
      mediamtxPath: pathName,
      createdAt: new Date(),
    });

    logger.info(
      { deviceId, channel, path: pathName, rtspUrl: maskCredentialsInUrl(rtspUrl) },
      'Playback session started',
    );

    return { webrtcUrl, hlsUrl };
  }

  async stopPlayback(deviceId: string, channel: number): Promise<void> {
    // Find session by device+channel prefix (key includes time range)
    const prefix = `${deviceId}:playback:${channel}:`;
    const matchingKey = [...this.sessions.keys()].find((k) => k.startsWith(prefix));
    if (!matchingKey) return;

    const session = this.sessions.get(matchingKey)!;
    try {
      await request(`${config.MEDIAMTX_API_URL}/v3/config/paths/delete/${session.mediamtxPath}`, {
        method: 'DELETE',
        headersTimeout: 5000,
        bodyTimeout: 5000,
      });
    } catch (err) {
      logger.warn({ deviceId, err }, 'Failed to remove playback path from MediaMTX');
    }

    this.sessions.delete(matchingKey);
    logger.info({ deviceId, channel }, 'Playback session stopped');
  }

  async stopAll(): Promise<void> {
    for (const [key, session] of this.sessions) {
      try {
        await request(`${config.MEDIAMTX_API_URL}/v3/config/paths/delete/${session.mediamtxPath}`, {
          method: 'DELETE',
          headersTimeout: 3000,
          bodyTimeout: 3000,
        });
      } catch { /* best-effort */ }
      this.sessions.delete(key);
    }
    logger.info('All playback sessions stopped');
  }

  listSessions(): PlaybackSession[] {
    return Array.from(this.sessions.values());
  }
}
