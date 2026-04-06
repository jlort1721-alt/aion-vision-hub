/**
 * System Watchdog Service — monitors health of all platform services
 *
 * Periodically checks PostgreSQL, Redis, go2rtc, Nginx, Face Recognition,
 * Asterisk, and eWeLink MCP. Reports status and logs critical/warning events
 * when services go down.
 */
import { createLogger } from '@aion/common-utils';
import { db } from '../db/client.js';
import { sql } from 'drizzle-orm';
import { sendAlert } from '../lib/telegram-alerter.js';

const logger = createLogger({ name: 'system-watchdog' });

const CHECK_TIMEOUT_MS = 5_000;

// ── Types ───────────────────────────────────────────────────────────────────

export interface ServiceCheck {
  name: string;
  critical: boolean;
  healthy: boolean;
  lastCheck: string;
  responseMs: number;
  message?: string;
}

export interface WatchdogStatus {
  healthy: boolean;
  criticalDown: string[];
  warningDown: string[];
  services: ServiceCheck[];
  lastFullCheck: string;
}

// ── Utility ─────────────────────────────────────────────────────────────────

/**
 * Execute a health check function with a timeout.
 * Returns { ok, ms, message } regardless of outcome.
 */
async function timedCheck(
  fn: () => Promise<string | void>,
  timeoutMs = CHECK_TIMEOUT_MS,
): Promise<{ ok: boolean; ms: number; message: string }> {
  const start = Date.now();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ok: false, ms: timeoutMs, message: `Timeout after ${timeoutMs}ms` });
    }, timeoutMs);

    fn()
      .then((msg: string | void) => {
        clearTimeout(timer);
        resolve({ ok: true, ms: Date.now() - start, message: (msg as string) || 'OK' });
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        const message = err instanceof Error ? err.message : String(err);
        resolve({ ok: false, ms: Date.now() - start, message });
      });
  });
}

// ── Individual Checks ───────────────────────────────────────────────────────

async function checkPostgres(): Promise<string | void> {
  await db.execute(sql`SELECT 1`);
}

async function checkRedis(): Promise<string | void> {
  // Dynamic import — redis may be null if not configured
  const { redis } = await import('../lib/redis.js');
  if (!redis) {
    return 'Redis not configured (REDIS_URL not set)';
  }
  const pong = await redis.ping();
  if (pong !== 'PONG') {
    throw new Error(`Unexpected ping response: ${pong}`);
  }
}

async function checkGo2rtc(): Promise<string | void> {
  const url = process.env.GO2RTC_URL || 'http://localhost:1984';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const resp = await fetch(`${url}/api/streams`, { signal: controller.signal });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const streams = await resp.json() as Record<string, unknown>;
    const count = Object.keys(streams).length;
    return `${count} stream(s) active`;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkNginx(): Promise<string | void> {
  const url = process.env.NGINX_HEALTH_URL || 'http://localhost:80';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok && resp.status !== 301 && resp.status !== 302) {
      throw new Error(`HTTP ${resp.status}`);
    }
    return `HTTP ${resp.status}`;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkFaceRecognition(): Promise<string | void> {
  const url = process.env.FACE_RECOGNITION_URL || 'http://localhost:5050';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const resp = await fetch(`${url}/health`, { signal: controller.signal });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function checkAsterisk(): Promise<string | void> {
  // Check if Asterisk process is running via /proc or ps
  // On macOS/Linux, a simple approach is to check the AMI port (default 5038)
  // or just attempt a TCP connection to the SIP port (5060)
  const asteriskPort = process.env.ASTERISK_AMI_PORT || '5038';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const resp = await fetch(`http://localhost:${asteriskPort}/`, {
      signal: controller.signal,
    });
    // Asterisk AMI will respond on the TCP port even with an error — that's fine,
    // it means the process is alive
    return `Listening on port ${asteriskPort} (HTTP ${resp.status})`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A "connection refused" means the process is down.
    // A fetch error that isn't "connection refused" could still mean it's up
    // (AMI doesn't speak HTTP). Check for ECONNREFUSED specifically.
    if (message.includes('ECONNREFUSED') || message.includes('connect ECONNREFUSED')) {
      throw new Error(`Asterisk not reachable on port ${asteriskPort}`);
    }
    // Other errors (e.g. parse error from non-HTTP response) mean the port IS open
    return `Port ${asteriskPort} open (non-HTTP response)`;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkEwelinkMcp(): Promise<string | void> {
  const url = process.env.EWELINK_MCP_URL;
  if (!url) {
    return 'eWeLink MCP not configured (EWELINK_MCP_URL not set)';
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    // Send a minimal JSON-RPC ping to the MCP endpoint
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 0 }),
      signal: controller.signal,
    });
    if (!resp.ok && resp.status !== 400) {
      // 400 is acceptable — it means the server is up but rejects the method
      throw new Error(`HTTP ${resp.status}`);
    }
    return 'MCP endpoint reachable';
  } finally {
    clearTimeout(timeout);
  }
}

// ── Service Definition Registry ─────────────────────────────────────────────

interface ServiceDefinition {
  name: string;
  critical: boolean;
  check: () => Promise<string | void>;
}

const SERVICE_DEFINITIONS: ServiceDefinition[] = [
  { name: 'PostgreSQL',        critical: true,  check: checkPostgres },
  { name: 'Redis',             critical: false, check: checkRedis },
  { name: 'go2rtc',            critical: true,  check: checkGo2rtc },
  { name: 'Nginx',             critical: false, check: checkNginx },
  { name: 'Face Recognition',  critical: false, check: checkFaceRecognition },
  { name: 'Asterisk',          critical: false, check: checkAsterisk },
  { name: 'eWeLink MCP',       critical: false, check: checkEwelinkMcp },
];

// ── Watchdog Service ────────────────────────────────────────────────────────

class SystemWatchdogService {
  private intervalId: NodeJS.Timeout | null = null;
  private serviceStatus: Map<string, ServiceCheck> = new Map();
  private lastFullCheck: string = '';
  private previousHealthState: Map<string, boolean> = new Map();

  /**
   * Start periodic health checking.
   * @param intervalMs Check interval in milliseconds (default: 60000)
   */
  start(intervalMs = 60_000): void {
    if (this.intervalId) {
      logger.warn('Watchdog already running — stopping previous instance');
      this.stop();
    }

    logger.info({ intervalMs }, 'System watchdog started');

    // Run immediately on start, then on interval
    void this.runAll();
    this.intervalId = setInterval(() => void this.runAll(), intervalMs);
  }

  /**
   * Stop periodic health checking.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('System watchdog stopped');
    }
  }

  /**
   * Run all service checks. Each check is independent — one failure won't
   * prevent others from running.
   */
  async runAll(): Promise<WatchdogStatus> {
    const timestamp = new Date().toISOString();
    this.lastFullCheck = timestamp;

    const results = await Promise.all(
      SERVICE_DEFINITIONS.map(async (svc) => {
        const result = await timedCheck(svc.check);

        const check: ServiceCheck = {
          name: svc.name,
          critical: svc.critical,
          healthy: result.ok,
          lastCheck: timestamp,
          responseMs: result.ms,
          message: result.message,
        };

        this.serviceStatus.set(svc.name, check);

        // Detect state transitions and log appropriately
        const previouslyHealthy = this.previousHealthState.get(svc.name);

        if (previouslyHealthy !== undefined && previouslyHealthy !== result.ok) {
          if (!result.ok) {
            // Service just went down
            if (svc.critical) {
              logger.error(
                { service: svc.name, responseMs: result.ms, error: result.message },
                'CRITICAL service went DOWN',
              );
              void sendAlert('critical', `${svc.name} DOWN`, `Service failed health check: ${result.message}`);
            } else {
              logger.warn(
                { service: svc.name, responseMs: result.ms, error: result.message },
                'Non-critical service went DOWN',
              );
              void sendAlert('warning', `${svc.name} degraded`, `Non-critical service down: ${result.message}`);
            }
          } else {
            // Service recovered
            logger.info(
              { service: svc.name, responseMs: result.ms },
              'Service recovered — now healthy',
            );
            void sendAlert('info', `${svc.name} recovered`, `Service is healthy again (${result.ms}ms)`);
          }
        } else if (previouslyHealthy === undefined && !result.ok) {
          // First check and already down
          if (svc.critical) {
            logger.error(
              { service: svc.name, responseMs: result.ms, error: result.message },
              'CRITICAL service is DOWN on first check',
            );
            void sendAlert('critical', `${svc.name} DOWN on startup`, `Service unavailable: ${result.message}`);
          } else {
            logger.warn(
              { service: svc.name, responseMs: result.ms, error: result.message },
              'Non-critical service is DOWN on first check',
            );
          }
        }

        this.previousHealthState.set(svc.name, result.ok);

        return check;
      }),
    );

    const criticalDown = results
      .filter((s) => s.critical && !s.healthy)
      .map((s) => s.name);

    const warningDown = results
      .filter((s) => !s.critical && !s.healthy)
      .map((s) => s.name);

    const overallHealthy = criticalDown.length === 0;

    const status: WatchdogStatus = {
      healthy: overallHealthy,
      criticalDown,
      warningDown,
      services: results,
      lastFullCheck: timestamp,
    };

    // Summary log
    const healthyCount = results.filter((s) => s.healthy).length;
    const totalCount = results.length;

    if (overallHealthy && warningDown.length === 0) {
      logger.info(
        { healthy: healthyCount, total: totalCount },
        'All services healthy',
      );
    } else if (overallHealthy) {
      logger.warn(
        { healthy: healthyCount, total: totalCount, warnings: warningDown },
        'System operational — some non-critical services down',
      );
    } else {
      logger.error(
        { healthy: healthyCount, total: totalCount, critical: criticalDown, warnings: warningDown },
        'System degraded — critical services down',
      );
    }

    return status;
  }

  /**
   * Get the current cached status of all services.
   * Does NOT trigger a new check — use runAll() for that.
   */
  getStatus(): WatchdogStatus {
    const services = Array.from(this.serviceStatus.values());

    const criticalDown = services
      .filter((s) => s.critical && !s.healthy)
      .map((s) => s.name);

    const warningDown = services
      .filter((s) => !s.critical && !s.healthy)
      .map((s) => s.name);

    return {
      healthy: criticalDown.length === 0,
      criticalDown,
      warningDown,
      services,
      lastFullCheck: this.lastFullCheck,
    };
  }

  /**
   * Check if the watchdog is currently running.
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}

export const systemWatchdog = new SystemWatchdogService();
