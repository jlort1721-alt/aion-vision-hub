/**
 * IMOU Stream Manager — Maintains live HLS streams from Dahua XVR via IMOU Cloud P2P
 *
 * Resilience features for 24/7 operation:
 * - Token caching (72h expiry, refreshes 1h before expiry)
 * - Retry with backoff on token/API failures (3 attempts)
 * - Per-device try/catch — one device failure doesn't stop others
 * - 15-minute refresh cycle (URLs expire ~30min, gives margin)
 * - Detailed logging per cycle with stats
 * - Health status exposure for monitoring
 */
import crypto from "crypto";
import { createLogger } from "@aion/common-utils";

const logger = createLogger({ name: "imou-stream-manager" });

const APP_ID = process.env.IMOU_APP_ID || "";
const APP_SECRET = process.env.IMOU_APP_SECRET || "";
const API_BASE = "https://openapi-or.easy4ip.com/openapi";
const GO2RTC_API = "http://localhost:1984/api/streams";
const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes (URLs expire ~30min)

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

// ── Token Cache ─────────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

function generateNonce(): string {
  return crypto.randomBytes(8).toString("hex");
}

function signRequest(ts: number, nonce: string): string {
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
      sign: signRequest(ts, nonce),
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
  // Return cached token if still valid (refresh 1 hour before expiry)
  if (cachedToken && Date.now() / 1000 < cachedToken.expiresAt - 3600) {
    return cachedToken.token;
  }

  // Retry up to 3 times with backoff
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await imouApi("accessToken", { phone: "", email: "" });
      const result = resp.result as Record<string, unknown>;

      if (result.code !== "0") {
        logger.warn(
          { code: result.code, msg: result.msg, attempt },
          "IMOU token request failed",
        );
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        throw new Error(`IMOU token error: ${result.msg}`);
      }

      const data = result.data as Record<string, unknown>;
      const token = data.accessToken as string;
      const expireTime = data.expireTime as number;

      cachedToken = { token, expiresAt: Date.now() / 1000 + expireTime };
      logger.info(
        { expiresIn: `${Math.round(expireTime / 3600)}h` },
        "IMOU token refreshed",
      );
      return token;
    } catch (err) {
      if (attempt < 2) {
        logger.warn(
          { attempt, err: (err as Error).message },
          "IMOU token attempt failed, retrying",
        );
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      } else {
        // If we have a cached token (even expired), use it as last resort
        if (cachedToken) {
          logger.warn("Using expired cached IMOU token as fallback");
          return cachedToken.token;
        }
        throw err;
      }
    }
  }
  throw new Error("Failed to get IMOU token after 3 attempts");
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
      streamId: 0,
    });
    const result = resp.result as Record<string, unknown>;
    if (result.code !== "0" && result.code !== "LV1001") return null;
    const data = result.data as Record<string, unknown>;
    const streams = data.streams as Array<Record<string, string>> | undefined;
    return streams?.[0]?.hls || null;
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
    return streams?.[0]?.hls || null;
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

// ── Manager Class ───────────────────────────────────────

export class ImouStreamManager {
  private refreshTimer: NodeJS.Timeout | null = null;
  private activeStreams = new Map<string, string>();
  private running = false;
  private cycleCount = 0;
  private lastRefreshAt: Date | null = null;
  private lastRefreshResult: {
    total: number;
    online: number;
    streams: number;
    errors: number;
  } | null = null;

  isConfigured(): boolean {
    return !!APP_ID && !!APP_SECRET;
  }

  async start(intervalMs = REFRESH_INTERVAL): Promise<void> {
    if (!this.isConfigured()) {
      logger.warn("IMOU not configured — skipping stream manager");
      return;
    }

    this.running = true;
    logger.info(
      { interval: `${intervalMs / 1000}s`, devices: DEVICES.length },
      "IMOU Stream Manager starting",
    );

    // Initial bind (with short delay to let API stabilize)
    setTimeout(() => {
      this.refreshAllStreams().catch((err) => {
        logger.error(
          { err: (err as Error).message },
          "Initial IMOU refresh failed",
        );
      });
    }, 5000);

    // Periodic refresh
    this.refreshTimer = setInterval(() => {
      this.refreshAllStreams().catch((err) => {
        logger.error(
          { err: (err as Error).message },
          "IMOU refresh cycle failed",
        );
      });
    }, intervalMs);
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
    errors: number;
  }> {
    if (!this.isConfigured())
      return { total: 0, online: 0, streams: 0, errors: 0 };

    const startTime = Date.now();
    this.cycleCount++;
    let totalDevices = 0;
    let onlineDevices = 0;
    let totalStreams = 0;
    let errorCount = 0;

    let token: string;
    try {
      token = await getToken();
    } catch (err) {
      logger.error(
        { err: (err as Error).message, cycle: this.cycleCount },
        "IMOU token fetch failed — skipping cycle",
      );
      return { total: DEVICES.length, online: 0, streams: 0, errors: 1 };
    }

    for (const device of DEVICES) {
      totalDevices++;

      try {
        const channels = await getOnlineChannels(token, device.serial);
        if (channels.length === 0) {
          logger.debug(
            { device: device.name },
            "Device offline or no channels",
          );
          continue;
        }

        onlineDevices++;

        for (const chId of channels) {
          // First try existing stream URL, then bind new
          let hlsUrl = await getLiveStreamUrl(token, device.serial, chId);
          if (!hlsUrl) {
            hlsUrl = await bindLiveStream(token, device.serial, chId);
          }

          if (hlsUrl) {
            const streamKey = `da-${device.name}-ch${chId}`;
            const added = await addToGo2rtc(streamKey, hlsUrl);
            if (added) {
              this.activeStreams.set(streamKey, hlsUrl);
              totalStreams++;
            } else {
              logger.warn({ streamKey }, "Failed to register stream in go2rtc");
              errorCount++;
            }
          }

          // Rate limit: 300ms between API calls
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch (err) {
        errorCount++;
        logger.error(
          { device: device.name, err: (err as Error).message },
          "Device refresh failed, continuing",
        );
      }
    }

    const elapsed = Date.now() - startTime;
    this.lastRefreshAt = new Date();
    this.lastRefreshResult = {
      total: totalDevices,
      online: onlineDevices,
      streams: totalStreams,
      errors: errorCount,
    };

    logger.info(
      {
        cycle: this.cycleCount,
        devices: `${onlineDevices}/${totalDevices}`,
        streams: totalStreams,
        errors: errorCount,
        elapsed: `${elapsed}ms`,
      },
      "IMOU refresh cycle complete",
    );

    return {
      total: totalDevices,
      online: onlineDevices,
      streams: totalStreams,
      errors: errorCount,
    };
  }

  getStatus(): {
    running: boolean;
    streams: number;
    devices: number;
    cycleCount: number;
    lastRefreshAt: string | null;
    lastResult: {
      total: number;
      online: number;
      streams: number;
      errors: number;
    } | null;
  } {
    return {
      running: this.running,
      streams: this.activeStreams.size,
      devices: DEVICES.length,
      cycleCount: this.cycleCount,
      lastRefreshAt: this.lastRefreshAt?.toISOString() || null,
      lastResult: this.lastRefreshResult,
    };
  }
}

export const imouStreamManager = new ImouStreamManager();
