/**
 * IMOU Stream Manager — Maintains live HLS streams from Dahua XVR via IMOU Cloud P2P
 *
 * Flow:
 * 1. Get IMOU access token
 * 2. For each online XVR: bindDeviceLive (streamId=0 INTEGER) for each channel
 * 3. Extract HLS URLs from response
 * 4. Register HLS URLs in go2rtc via API
 * 5. Refresh every 20 minutes (URLs expire ~30min)
 *
 * No DSS Express, no Windows, no port forwarding needed.
 */
import crypto from 'crypto';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'imou-stream-manager' });

const APP_ID = process.env.IMOU_APP_ID || '';
const APP_SECRET = process.env.IMOU_APP_SECRET || '';
const API_BASE = 'https://openapi-or.easy4ip.com/openapi';
const REFRESH_INTERVAL = 20 * 60 * 1000; // 20 minutes

interface ImouDevice {
  serial: string;
  name: string;
  user: string;
}

const DEVICES: ImouDevice[] = [
  { serial: 'AL02505PAJD40E7', name: 'alborada', user: 'admin' },
  { serial: 'AK01E46PAZ0BA9C', name: 'brescia', user: 'admin' },
  { serial: 'AL02505PAJDC6A4', name: 'pbonito', user: 'admin' },
  { serial: 'BB01B89PAJ5DDCD', name: 'terrabamba', user: 'admin' },
  { serial: 'AJ00421PAZF2E60', name: 'danubios', user: 'admin' },
  { serial: 'AH0306CPAZ5EA1A', name: 'danubios2', user: 'CLAVE' },
  { serial: 'AL02505PAJ638AA', name: 'terrazzino', user: 'admin' },
  { serial: 'AH0306CPAZ5E9FA', name: 'terrazzino2', user: 'admin' },
  { serial: 'AH1020EPAZ39E67', name: 'quintas', user: 'admin' },
  { serial: 'AB081E4PAZD6D5B', name: 'santana', user: 'admin' },
  { serial: 'AE01C60PAZA4D94', name: 'hospital', user: 'admin' },
  { serial: '9B02D09PAZ4C0D2', name: 'factory', user: 'admin' },
];

function generateNonce(): string {
  return crypto.randomBytes(8).toString('hex');
}

function sign(ts: number, nonce: string): string {
  return crypto.createHash('md5').update(`time:${ts},nonce:${nonce},appSecret:${APP_SECRET}`).digest('hex');
}

async function imouApi(endpoint: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const ts = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();

  const body = JSON.stringify({
    system: { ver: '1.0', sign: sign(ts, nonce), appId: APP_ID, time: ts, nonce },
    params,
  });

  const resp = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(15000),
  });

  return await resp.json() as Record<string, unknown>;
}

async function getToken(): Promise<string> {
  const resp = await imouApi('accessToken', { phone: '', email: '' });
  const result = resp.result as Record<string, unknown>;
  const data = result.data as Record<string, unknown>;
  return data.accessToken as string;
}

async function getOnlineChannels(token: string, serial: string): Promise<string[]> {
  try {
    const resp = await imouApi('deviceOnline', { token, deviceId: serial });
    const result = resp.result as Record<string, unknown>;
    if (result.code !== '0') return [];
    const data = result.data as Record<string, unknown>;
    const channels = data.channels as Array<Record<string, string>>;
    return channels.filter(ch => ch.onLine === '1').map(ch => ch.channelId);
  } catch {
    return [];
  }
}

async function bindLiveStream(token: string, serial: string, channelId: string): Promise<string | null> {
  try {
    const resp = await imouApi('bindDeviceLive', {
      token,
      deviceId: serial,
      channelId,
      streamId: 0, // INTEGER 0, not string "0" — this is critical
    });

    const result = resp.result as Record<string, unknown>;
    if (result.code !== '0' && result.code !== 'LV1001') return null;

    const data = result.data as Record<string, unknown>;
    const streams = data.streams as Array<Record<string, string>> | undefined;

    if (streams && streams.length > 0) {
      return streams[0].hls || null;
    }

    return null;
  } catch {
    return null;
  }
}

async function getLiveStreamUrl(token: string, serial: string, channelId: string): Promise<string | null> {
  try {
    const resp = await imouApi('getLiveStreamInfo', { token, deviceId: serial, channelId });
    const result = resp.result as Record<string, unknown>;
    if (result.code !== '0') return null;

    const data = result.data as Record<string, unknown>;
    const streams = data.streams as Array<Record<string, string>> | undefined;

    if (streams && streams.length > 0) {
      return streams[0].hls || null;
    }
    return null;
  } catch {
    return null;
  }
}

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const GO2RTC_YAML = '/etc/go2rtc/go2rtc.yaml';

/** Batch-write all Dahua HLS streams to go2rtc YAML and restart the service */
async function syncStreamsToYaml(streams: Map<string, string>): Promise<number> {
  if (streams.size === 0) return 0;

  try {
    // Read current YAML
    const yamlContent = readFileSync(GO2RTC_YAML, 'utf-8');
    const lines = yamlContent.split('\n');

    // Remove old da- entries (except da-brescia which uses RTSP direct from YAML)
    const cleanedLines = lines.filter(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('da-') && !trimmed.startsWith('da-brescia')) return false;
      return true;
    });

    // Find the "streams:" section and add new entries after it
    const newEntries: string[] = [];
    for (const [key, hlsUrl] of streams) {
      if (key.startsWith('da-brescia')) continue; // Brescia uses RTSP direct
      // H.264 transcode — Dahua XVRs send H.265/HEVC which browsers cannot decode
      newEntries.push(`  ${key}: "ffmpeg:${hlsUrl}#video=h264"`);
    }

    // Insert after "streams:" line
    const streamsIdx = cleanedLines.findIndex(l => l.trim() === 'streams:');
    if (streamsIdx >= 0) {
      cleanedLines.splice(streamsIdx + 1, 0, ...newEntries);
    }

    // Write back
    writeFileSync(GO2RTC_YAML, cleanedLines.join('\n'));

    // Restart go2rtc to pick up new config
    try {
      execSync('sudo systemctl restart go2rtc', { timeout: 10000 });
    } catch {
      logger.warn('Could not restart go2rtc via systemctl — streams may not load until manual restart');
    }

    logger.info({ count: newEntries.length }, 'Wrote Dahua HLS streams to go2rtc YAML');
    return newEntries.length;
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Failed to write go2rtc YAML');
    return 0;
  }
}

// NOTE: go2rtc PUT /api/streams does NOT persist — streams vanish without consumers.
// Use syncStreamsToYaml() instead which writes to the YAML config and restarts go2rtc.

export class ImouStreamManager {
  private refreshTimer: NodeJS.Timeout | null = null;
  private activeStreams = new Map<string, string>();
  private running = false;

  isConfigured(): boolean {
    return !!APP_ID && !!APP_SECRET;
  }

  async start(intervalMs = REFRESH_INTERVAL): Promise<void> {
    if (!this.isConfigured()) {
      logger.warn('IMOU not configured — skipping stream manager');
      return;
    }

    this.running = true;
    logger.info('IMOU Stream Manager starting');

    // Initial bind
    await this.refreshAllStreams();

    // Periodic refresh
    this.refreshTimer = setInterval(() => {
      this.refreshAllStreams().catch(err => {
        logger.error({ err: (err as Error).message }, 'Stream refresh failed');
      });
    }, intervalMs);

    logger.info({ interval: intervalMs / 1000 }, 'IMOU Stream Manager running');
  }

  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.running = false;
    logger.info('IMOU Stream Manager stopped');
  }

  async refreshAllStreams(): Promise<{ total: number; online: number; streams: number }> {
    if (!this.isConfigured()) return { total: 0, online: 0, streams: 0 };

    const token = await getToken();
    let totalDevices = 0;
    let onlineDevices = 0;
    let totalStreams = 0;

    for (const device of DEVICES) {
      totalDevices++;

      const channels = await getOnlineChannels(token, device.serial);
      if (channels.length === 0) continue;

      onlineDevices++;
      logger.debug({ device: device.name, channels: channels.length }, 'Device online');

      for (const chId of channels) {
        let hlsUrl = await getLiveStreamUrl(token, device.serial, chId);
        if (!hlsUrl) {
          hlsUrl = await bindLiveStream(token, device.serial, chId);
        }

        if (hlsUrl) {
          const streamKey = `da-${device.name}-ch${chId}`;
          this.activeStreams.set(streamKey, hlsUrl);
          totalStreams++;
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Batch-write all collected HLS streams to go2rtc YAML + restart
    if (this.activeStreams.size > 0) {
      const written = await syncStreamsToYaml(this.activeStreams);
      logger.info({ written }, 'Synced Dahua streams to go2rtc YAML');
    }

    logger.info({
      devices: `${onlineDevices}/${totalDevices}`,
      streams: totalStreams,
    }, 'IMOU streams refreshed');

    return { total: totalDevices, online: onlineDevices, streams: totalStreams };
  }

  getStatus(): { running: boolean; streams: number; devices: number } {
    return {
      running: this.running,
      streams: this.activeStreams.size,
      devices: DEVICES.length,
    };
  }
}

export const imouStreamManager = new ImouStreamManager();
