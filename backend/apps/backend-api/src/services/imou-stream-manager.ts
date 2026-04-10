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
import crypto from "crypto";
import { createLogger } from "@aion/common-utils";

const logger = createLogger({ name: "imou-stream-manager" });

const APP_ID = process.env.IMOU_APP_ID || "";
const APP_SECRET = process.env.IMOU_APP_SECRET || "";
const API_BASE = "https://openapi-or.easy4ip.com/openapi";
const GO2RTC_API = "http://localhost:1984/api/streams";
const REFRESH_INTERVAL = 20 * 60 * 1000; // 20 minutes

interface ImouDevice {
  serial: string;
  name: string;
  user: string;
}

const DEVICES: ImouDevice[] = [
  { serial: "AL02505PAJD40E7", name: "alborada", user: "admin" },
  { serial: "AK01E46PAZ0BA9C", name: "brescia", user: "admin" },
  { serial: "AL02505PAJDC6A4", name: "pbonito", user: "admin" },
  { serial: "BB01B89PAJ5DDCD", name: "terrabamba", user: "admin" },
  { serial: "AJ00421PAZF2E60", name: "danubios", user: "admin" },
  { serial: "AH0306CPAZ5EA1A", name: "danubios2", user: "CLAVE" },
  { serial: "AL02505PAJ638AA", name: "terrazzino", user: "admin" },
  { serial: "AH0306CPAZ5E9FA", name: "terrazzino2", user: "admin" },
  { serial: "AH1020EPAZ39E67", name: "quintas", user: "admin" },
  { serial: "AB081E4PAZD6D5B", name: "santana", user: "admin" },
  { serial: "AE01C60PAZA4D94", name: "hospital", user: "admin" },
  { serial: "9B02D09PAZ4C0D2", name: "factory", user: "admin" },
];

function generateNonce(): string {
  return crypto.randomBytes(8).toString("hex");
}

function sign(ts: number, nonce: string): string {
  return crypto
    .createHash("md5")
    .update(`time:${ts},nonce:${nonce},appSecret:${APP_SECRET}`)
    .digest("hex");
}

async function imouApi(
  endpoint: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const ts = Math.floor(Date.now() / 1000);
  const nonce = generateNonce();

  const body = JSON.stringify({
    system: {
      ver: "1.0",
      sign: sign(ts, nonce),
      appId: APP_ID,
      time: ts,
      nonce,
    },
    params,
  });

  const resp = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(15000),
  });

  return (await resp.json()) as Record<string, unknown>;
}

async function getToken(): Promise<string> {
  const resp = await imouApi("accessToken", { phone: "", email: "" });
  const result = resp.result as Record<string, unknown>;
  const data = result.data as Record<string, unknown>;
  return data.accessToken as string;
}

async function getOnlineChannels(
  token: string,
  serial: string,
): Promise<string[]> {
  try {
    const resp = await imouApi("deviceOnline", { token, deviceId: serial });
    const result = resp.result as Record<string, unknown>;
    if (result.code !== "0") return [];
    const data = result.data as Record<string, unknown>;
    const channels = data.channels as Array<Record<string, string>>;
    return channels.filter((ch) => ch.onLine === "1").map((ch) => ch.channelId);
  } catch {
    return [];
  }
}

async function bindLiveStream(
  token: string,
  serial: string,
  channelId: string,
): Promise<string | null> {
  try {
    const resp = await imouApi("bindDeviceLive", {
      token,
      deviceId: serial,
      channelId,
      streamId: 0, // INTEGER 0, not string "0" — this is critical
    });

    const result = resp.result as Record<string, unknown>;
    if (result.code !== "0" && result.code !== "LV1001") return null;

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

async function getLiveStreamUrl(
  token: string,
  serial: string,
  channelId: string,
): Promise<string | null> {
  try {
    const resp = await imouApi("getLiveStreamInfo", {
      token,
      deviceId: serial,
      channelId,
    });
    const result = resp.result as Record<string, unknown>;
    if (result.code !== "0") return null;

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

async function addToGo2rtc(
  streamKey: string,
  hlsUrl: string,
): Promise<boolean> {
  try {
    // go2rtc 1.9.4 uses query params: PUT /api/streams?name=KEY&src=URL
    const url = `${GO2RTC_API}?name=${encodeURIComponent(streamKey)}&src=${encodeURIComponent(hlsUrl)}`;
    const resp = await fetch(url, {
      method: "PUT",
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export class ImouStreamManager {
  private refreshTimer: NodeJS.Timeout | null = null;
  private activeStreams = new Map<string, string>();
  private running = false;

  isConfigured(): boolean {
    return !!APP_ID && !!APP_SECRET;
  }

  async start(intervalMs = REFRESH_INTERVAL): Promise<void> {
    if (!this.isConfigured()) {
      logger.warn("IMOU not configured — skipping stream manager");
      return;
    }

    this.running = true;
    logger.info("IMOU Stream Manager starting");

    // Initial bind
    await this.refreshAllStreams();

    // Periodic refresh
    this.refreshTimer = setInterval(() => {
      this.refreshAllStreams().catch((err) => {
        logger.error({ err: (err as Error).message }, "Stream refresh failed");
      });
    }, intervalMs);

    logger.info({ interval: intervalMs / 1000 }, "IMOU Stream Manager running");
  }

  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.running = false;
    logger.info("IMOU Stream Manager stopped");
  }

  async refreshAllStreams(): Promise<{
    total: number;
    online: number;
    streams: number;
  }> {
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
      logger.debug(
        { device: device.name, channels: channels.length },
        "Device online",
      );

      for (const chId of channels) {
        // First try to get existing stream URL
        let hlsUrl = await getLiveStreamUrl(token, device.serial, chId);

        // If no existing stream, bind new one
        if (!hlsUrl) {
          hlsUrl = await bindLiveStream(token, device.serial, chId);
        }

        if (hlsUrl) {
          const streamKey = `da-${device.name}-ch${chId}`;
          const added = await addToGo2rtc(streamKey, hlsUrl);

          if (added) {
            this.activeStreams.set(streamKey, hlsUrl);
            totalStreams++;
          }
        }

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    logger.info(
      {
        devices: `${onlineDevices}/${totalDevices}`,
        streams: totalStreams,
      },
      "IMOU streams refreshed",
    );

    return {
      total: totalDevices,
      online: onlineDevices,
      streams: totalStreams,
    };
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
