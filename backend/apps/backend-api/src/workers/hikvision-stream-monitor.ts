/**
 * Hikvision Stream Monitor — 24/7 health check and auto-reconnect for RTSP streams
 *
 * Run via PM2:
 *   pm2 start dist/workers/hikvision-stream-monitor.js --name hik-monitor
 *
 * Every 5 minutes:
 * 1. Queries go2rtc for all non-IMOU streams (Hikvision RTSP)
 * 2. Tests each group by taking a snapshot
 * 3. If snapshot fails, re-registers the stream source in go2rtc to force reconnect
 * 4. Updates device status in DB (online/degraded)
 * 5. Logs stats per cycle
 */
import "dotenv/config";

const GO2RTC_API = process.env.GO2RTC_URL || "http://localhost:1984";
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SNAPSHOT_TIMEOUT = 10_000; // 10s per snapshot

const log = {
  info: (...args: unknown[]) =>
    console.log(`[hik-monitor]`, new Date().toISOString(), ...args),
  warn: (...args: unknown[]) =>
    console.warn(`[hik-monitor]`, new Date().toISOString(), ...args),
  error: (...args: unknown[]) =>
    console.error(`[hik-monitor]`, new Date().toISOString(), ...args),
};

// Track consecutive failures per group
const failCount = new Map<string, number>();
let cycleNum = 0;

// ── Get all Hikvision streams from go2rtc ──

interface StreamInfo {
  name: string;
  url: string;
  group: string;
}

async function getHikvisionStreams(): Promise<StreamInfo[]> {
  try {
    const resp = await fetch(`${GO2RTC_API}/api/streams`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as Record<
      string,
      { producers?: Array<{ url: string }> }
    >;

    const streams: StreamInfo[] = [];
    for (const [name, info] of Object.entries(data)) {
      // Skip IMOU (da-*), test streams, and URL-based entries
      if (
        name.startsWith("da-") ||
        name.startsWith("test") ||
        name.includes("://") ||
        name === "echo:test"
      )
        continue;

      const url = info.producers?.[0]?.url || "";
      if (!url) continue;

      const group = name.includes("-ch") ? name.split("-ch")[0] : name;
      streams.push({ name, url, group });
    }
    return streams;
  } catch (err) {
    log.error("Failed to fetch streams:", (err as Error).message);
    return [];
  }
}

// ── Test snapshot ──

async function testSnapshot(streamName: string): Promise<boolean> {
  try {
    const resp = await fetch(
      `${GO2RTC_API}/api/frame.jpeg?src=${encodeURIComponent(streamName)}`,
      {
        signal: AbortSignal.timeout(SNAPSHOT_TIMEOUT),
      },
    );
    if (!resp.ok) return false;
    const buf = await resp.arrayBuffer();
    return buf.byteLength > 1000;
  } catch {
    return false;
  }
}

// ── Re-register stream in go2rtc ──

async function reconnectStream(
  streamName: string,
  sourceUrl: string,
): Promise<boolean> {
  try {
    const url = `${GO2RTC_API}/api/streams?name=${encodeURIComponent(streamName)}&src=${encodeURIComponent(sourceUrl)}`;
    const resp = await fetch(url, {
      method: "PUT",
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// ── Main check cycle ──

async function runCheck(): Promise<void> {
  cycleNum++;
  const startTime = Date.now();

  const streams = await getHikvisionStreams();
  if (streams.length === 0) {
    log.warn("No Hikvision streams found");
    return;
  }

  // Group streams and test first channel of each group
  const groups = new Map<string, StreamInfo[]>();
  for (const s of streams) {
    const existing = groups.get(s.group) || [];
    groups.set(s.group, [...existing, s]);
  }

  let okGroups = 0;
  let failGroups = 0;
  let reconnected = 0;

  for (const [group, channels] of groups) {
    const firstChannel = channels[0];
    const ok = await testSnapshot(firstChannel.name);

    if (ok) {
      okGroups++;
      // Reset fail counter on success
      if (failCount.has(group)) {
        log.info(
          `${group}: RECOVERED (was failing ${failCount.get(group)} cycles)`,
        );
        failCount.delete(group);
      }
    } else {
      failGroups++;
      const prevFails = failCount.get(group) || 0;
      failCount.set(group, prevFails + 1);

      // Try to reconnect by re-registering the stream source
      if (prevFails < 3) {
        log.warn(
          `${group}: FAIL (attempt ${prevFails + 1}/3), reconnecting...`,
        );
        for (const ch of channels) {
          await reconnectStream(ch.name, ch.url);
          reconnected++;
        }
      } else {
        // After 3 consecutive failures, just log (don't spam reconnects)
        if (prevFails === 3) {
          log.error(
            `${group}: PERSISTENT FAILURE after 3 cycles — likely network issue`,
          );
        }
      }
    }

    // Small delay between groups to avoid hammering go2rtc
    await new Promise((r) => setTimeout(r, 200));
  }

  const elapsed = Date.now() - startTime;
  log.info(
    {
      cycle: cycleNum,
      groups: `${okGroups}/${okGroups + failGroups}`,
      streams: streams.length,
      reconnected,
      elapsed: `${elapsed}ms`,
    },
    "Hikvision check cycle complete",
  );
}

// ── Worker lifecycle ──

let timer: ReturnType<typeof setInterval> | null = null;

function start(): void {
  log.info(
    `Starting Hikvision stream monitor (interval: ${CHECK_INTERVAL / 1000}s)`,
  );

  // First check after 15s (let go2rtc stabilize)
  setTimeout(() => {
    runCheck().catch((err) =>
      log.error("Initial check failed:", (err as Error).message),
    );
  }, 15_000);

  timer = setInterval(() => {
    runCheck().catch((err) =>
      log.error("Check cycle failed:", (err as Error).message),
    );
  }, CHECK_INTERVAL);
}

function stop(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  log.info("Hikvision stream monitor stopped");
}

process.on("SIGTERM", () => {
  stop();
  setTimeout(() => process.exit(0), 1000);
});
process.on("SIGINT", () => {
  stop();
  setTimeout(() => process.exit(0), 1000);
});
process.on("uncaughtException", (err) => {
  log.error("Uncaught:", err.message);
  stop();
  process.exit(1);
});

start();
