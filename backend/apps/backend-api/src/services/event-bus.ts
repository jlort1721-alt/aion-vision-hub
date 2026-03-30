/**
 * AION Event Bus — Central nervous system of the platform.
 *
 * Every action in the platform generates an event that flows through this bus.
 * Events are published to a Redis Stream (`aion:events`) for real-time
 * distribution and simultaneously persisted to the PostgreSQL `event_log` table
 * for audit and replay.
 *
 * Subscribers register patterns with wildcard support:
 *   - '*' matches everything
 *   - 'access.*' matches 'access.granted', 'access.denied', etc.
 *   - 'camera.offline' matches exactly 'camera.offline'
 */

import { createLogger } from '@aion/common-utils';
import { db } from '../db/client.js';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { redis } from '../lib/redis.js';

const logger = createLogger({ name: 'event-bus' });

// ── Constants ───────────────────────────────────────────────────────────────

const STREAM_KEY = 'aion:events';
const STREAM_MAX_LEN = 50_000; // cap Redis Stream to prevent unbounded growth

// ── Types ───────────────────────────────────────────────────────────────────

export type EventSeverity = 'info' | 'warning' | 'critical' | 'emergency';

export interface AionEvent {
  id: string;
  type: string;
  source: string;
  severity: EventSeverity;
  timestamp: string;
  site_id?: string;
  device_id?: string;
  data: Record<string, unknown>;
  correlation_id?: string;
  actor?: string;
}

export type EventInput = Omit<AionEvent, 'id' | 'timestamp' | 'source' | 'severity'> & {
  id?: string;
  timestamp?: string;
  source?: string;
  severity?: EventSeverity;
};

export type EventHandler = (event: AionEvent) => void | Promise<void>;

interface Subscription {
  pattern: string;
  regex: RegExp;
  handler: EventHandler;
}

export interface EventHistoryOptions {
  type?: string;
  source?: string;
  severity?: EventSeverity;
  site_id?: string;
  device_id?: string;
  correlation_id?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a wildcard pattern to a RegExp.
 *   '*' alone  → matches any string
 *   'access.*' → matches 'access.granted', 'access.denied.foo', etc.
 */
function patternToRegex(pattern: string): RegExp {
  if (pattern === '*') return /^.+$/;
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

// ── Event Bus Class ─────────────────────────────────────────────────────────

class EventBus {
  private subscriptions: Subscription[] = [];
  private redisPolling = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRedisId = '$'; // only new messages

  // ── Publish ─────────────────────────────────────────────────────────────

  /**
   * Publish an event. Assigns a UUID id and ISO timestamp if not provided.
   * Writes to Redis Stream + PostgreSQL event_log in parallel, then
   * dispatches to local subscribers.
   */
  async publish(input: EventInput): Promise<AionEvent> {
    const event: AionEvent = {
      id: input.id ?? crypto.randomUUID(),
      type: input.type,
      source: input.source ?? 'unknown',
      severity: input.severity ?? 'info',
      timestamp: input.timestamp ?? new Date().toISOString(),
      site_id: input.site_id,
      device_id: input.device_id,
      data: input.data,
      correlation_id: input.correlation_id,
      actor: input.actor,
    };

    logger.info(
      { eventId: event.id, type: event.type, severity: event.severity, source: event.source },
      'Event published',
    );

    // Fire persistence in parallel — neither should block the other
    const redisPromise = this.publishToRedis(event);
    const pgPromise = this.persistToPostgres(event);

    await Promise.allSettled([redisPromise, pgPromise]);

    // Dispatch to local in-process subscribers (non-blocking)
    this.dispatch(event);

    return event;
  }

  // ── Subscribe ───────────────────────────────────────────────────────────

  /**
   * Register a handler for events matching `pattern`.
   * Returns an unsubscribe function.
   */
  subscribe(pattern: string, handler: EventHandler): () => void {
    const sub: Subscription = {
      pattern,
      regex: patternToRegex(pattern),
      handler,
    };
    this.subscriptions.push(sub);
    logger.debug({ pattern }, 'Subscription registered');

    // Start Redis polling if not already running and Redis is available
    if (!this.redisPolling) {
      this.startRedisPolling();
    }

    return () => {
      const idx = this.subscriptions.indexOf(sub);
      if (idx !== -1) this.subscriptions.splice(idx, 1);
      logger.debug({ pattern }, 'Subscription removed');
    };
  }

  // ── History ─────────────────────────────────────────────────────────────

  /**
   * Query persisted event_log with optional filters.
   */
  async getHistory(options: EventHistoryOptions = {}): Promise<{ events: AionEvent[]; total: number }> {
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (options.type) {
      conditions.push(`type = $${paramIndex++}`);
      params.push(options.type);
    }
    if (options.source) {
      conditions.push(`source = $${paramIndex++}`);
      params.push(options.source);
    }
    if (options.severity) {
      conditions.push(`severity = $${paramIndex++}`);
      params.push(options.severity);
    }
    if (options.site_id) {
      conditions.push(`site_id = $${paramIndex++}`);
      params.push(options.site_id);
    }
    if (options.device_id) {
      conditions.push(`device_id = $${paramIndex++}`);
      params.push(options.device_id);
    }
    if (options.correlation_id) {
      conditions.push(`correlation_id = $${paramIndex++}`);
      params.push(options.correlation_id);
    }
    if (options.from) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(options.from);
    }
    if (options.to) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(options.to);
    }

    const where = conditions.join(' AND ');
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    try {
      const countResult = await db.execute(
        sql.raw(`SELECT count(*)::int AS total FROM event_log WHERE ${where}`),
      );
      const total = (countResult as unknown as Array<{ total: number }>)[0]?.total ?? 0;

      const rows = await db.execute(
        sql.raw(
          `SELECT id, type, source, severity, timestamp, site_id, device_id, data, correlation_id, actor
           FROM event_log
           WHERE ${where}
           ORDER BY timestamp DESC
           LIMIT ${limit} OFFSET ${offset}`,
        ),
      );

      const events = (rows as unknown as AionEvent[]).map((row) => ({
        id: row.id,
        type: row.type,
        source: row.source,
        severity: row.severity,
        timestamp: row.timestamp,
        site_id: row.site_id,
        device_id: row.device_id,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
        correlation_id: row.correlation_id,
        actor: row.actor,
      }));

      return { events, total };
    } catch (err) {
      logger.error({ err }, 'Failed to query event history');
      return { events: [], total: 0 };
    }
  }

  // ── Shutdown ────────────────────────────────────────────────────────────

  /**
   * Clean up polling timers and subscriptions.
   */
  shutdown(): void {
    this.redisPolling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.subscriptions = [];
    logger.info('Event bus shut down');
  }

  // ── Internal: Redis Stream ──────────────────────────────────────────────

  private async publishToRedis(event: AionEvent): Promise<void> {
    if (!redis) return;

    try {
      await redis.xadd(
        STREAM_KEY,
        'MAXLEN',
        '~',
        String(STREAM_MAX_LEN),
        '*',
        'id', event.id,
        'type', event.type,
        'source', event.source,
        'severity', event.severity,
        'timestamp', event.timestamp,
        'site_id', event.site_id ?? '',
        'device_id', event.device_id ?? '',
        'data', JSON.stringify(event.data),
        'correlation_id', event.correlation_id ?? '',
        'actor', event.actor ?? '',
      );
    } catch (err) {
      logger.error({ err, eventId: event.id }, 'Failed to publish event to Redis Stream');
    }
  }

  private startRedisPolling(): void {
    if (!redis || this.redisPolling) return;

    this.redisPolling = true;
    this.pollRedisStream();
  }

  private async pollRedisStream(): Promise<void> {
    if (!this.redisPolling || !redis) return;

    try {
      const results = await redis.xread(
        'COUNT', '100',
        'BLOCK', '2000',
        'STREAMS', STREAM_KEY, this.lastRedisId,
      );

      if (results) {
        for (const [, messages] of results) {
          for (const [msgId, fields] of messages) {
            this.lastRedisId = msgId;

            // Convert flat field array to object
            const obj: Record<string, string> = {};
            for (let i = 0; i < fields.length; i += 2) {
              obj[fields[i]] = fields[i + 1];
            }

            const event: AionEvent = {
              id: obj.id || crypto.randomUUID(),
              type: obj.type || 'unknown',
              source: obj.source || 'redis',
              severity: (obj.severity as EventSeverity) || 'info',
              timestamp: obj.timestamp || new Date().toISOString(),
              site_id: obj.site_id || undefined,
              device_id: obj.device_id || undefined,
              data: obj.data ? JSON.parse(obj.data) : {},
              correlation_id: obj.correlation_id || undefined,
              actor: obj.actor || undefined,
            };

            // Only dispatch — don't re-persist (the publisher already did)
            this.dispatch(event);
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Redis Stream polling error');
    }

    // Schedule next poll
    if (this.redisPolling) {
      this.pollTimer = setTimeout(() => this.pollRedisStream(), 100);
    }
  }

  // ── Internal: PostgreSQL persistence ────────────────────────────────────

  private async persistToPostgres(event: AionEvent): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO event_log (id, type, source, severity, timestamp, site_id, device_id, data, correlation_id, actor)
        VALUES (
          ${event.id},
          ${event.type},
          ${event.source},
          ${event.severity},
          ${event.timestamp},
          ${event.site_id ?? null},
          ${event.device_id ?? null},
          ${JSON.stringify(event.data)}::jsonb,
          ${event.correlation_id ?? null},
          ${event.actor ?? null}
        )
        ON CONFLICT (id) DO NOTHING
      `);
    } catch (err) {
      // Table might not exist yet — log and continue gracefully
      logger.error({ err, eventId: event.id }, 'Failed to persist event to PostgreSQL');
    }
  }

  // ── Internal: Dispatch to subscribers ───────────────────────────────────

  private dispatch(event: AionEvent): void {
    for (const sub of this.subscriptions) {
      if (!sub.regex.test(event.type)) continue;

      try {
        const result = sub.handler(event);
        // If the handler returns a promise, catch its errors
        if (result && typeof result === 'object' && 'catch' in result) {
          (result as Promise<void>).catch((err) => {
            logger.error(
              { err, pattern: sub.pattern, eventType: event.type },
              'Async event handler error',
            );
          });
        }
      } catch (err) {
        logger.error(
          { err, pattern: sub.pattern, eventType: event.type },
          'Sync event handler error',
        );
      }
    }
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const eventBus = new EventBus();
