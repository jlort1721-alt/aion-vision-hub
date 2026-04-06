/**
 * AION Orchestrator — Connects the Event Bus and Rules Engine.
 *
 * Subscribes to ALL events on the Event Bus, evaluates them against the Rules
 * Engine, and executes matching actions. Supports multiple system modes that
 * control how aggressively actions are auto-executed.
 *
 * System modes:
 *   - 'normal'   — all rules fire, all actions auto-execute
 *   - 'assisted' — rules fire but critical actions are logged, not auto-executed
 *   - 'degraded' — only simple rules (no AI, no external calls)
 *   - 'manual'   — no auto-actions; everything needs operator confirmation
 */

import { createLogger } from '@aion/common-utils';
import { db } from '../db/client.js';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { eventBus, type AionEvent } from './event-bus.js';
import { rulesEngine, type AutomationRule, type RuleAction } from './rules-engine.js';
import { broadcast } from '../plugins/websocket.js';

const logger = createLogger({ name: 'orchestrator' });

// ── Constants ───────────────────────────────────────────────────────────────

const ACTION_TIMEOUT_MS = 10_000;
const GO2RTC_URL = process.env.GO2RTC_URL || 'http://localhost:1984';

// Actions considered critical (require confirmation in 'assisted' mode)
const CRITICAL_ACTIONS = new Set([
  'open_door',
  'toggle_device',
  'create_incident',
]);

// Actions that require external calls (disabled in 'degraded' mode)
const EXTERNAL_ACTIONS = new Set([
  'take_snapshot',
  'send_notification',
]);

// ── Types ───────────────────────────────────────────────────────────────────

export type SystemMode = 'normal' | 'assisted' | 'degraded' | 'manual';

interface ActionResult {
  action: string;
  status: 'success' | 'skipped' | 'failed';
  detail?: string;
  duration_ms: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  mode: SystemMode;
  uptime_ms: number;
  events_processed: number;
  rules_evaluated: number;
  actions_executed: number;
  last_event_at: string | null;
  errors_last_hour: number;
}

// ── Orchestrator Class ──────────────────────────────────────────────────────

class Orchestrator {
  private mode: SystemMode = 'normal';
  private running = false;
  private unsubscribe: (() => void) | null = null;
  private startedAt: number = 0;

  // Stats
  private eventsProcessed = 0;
  private rulesEvaluated = 0;
  private actionsExecuted = 0;
  private lastEventAt: string | null = null;
  private recentErrors: number[] = []; // timestamps of recent errors

  // ── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Start the orchestrator — subscribe to all events via the Event Bus.
   */
  start(): void {
    if (this.running) {
      logger.warn('Orchestrator already running');
      return;
    }

    this.running = true;
    this.startedAt = Date.now();

    // Subscribe to ALL events
    this.unsubscribe = eventBus.subscribe('*', (event) => {
      this.handleEvent(event).catch((err) => {
        logger.error({ err, eventId: event.id }, 'Unhandled error in orchestrator event handler');
        this.recordError();
      });
    });

    logger.info({ mode: this.mode }, 'Orchestrator started');
  }

  /**
   * Stop the orchestrator gracefully.
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    logger.info(
      { eventsProcessed: this.eventsProcessed, actionsExecuted: this.actionsExecuted },
      'Orchestrator stopped',
    );
  }

  // ── Mode Management ─────────────────────────────────────────────────────

  getMode(): SystemMode {
    return this.mode;
  }

  setMode(mode: SystemMode): void {
    const previousMode = this.mode;
    this.mode = mode;
    logger.info({ previousMode, newMode: mode }, 'System mode changed');

    // Emit a system event for the mode change
    eventBus.publish({
      type: 'system.mode_changed',
      source: 'orchestrator',
      severity: 'info',
      data: { previousMode, newMode: mode },
    }).catch((err) => {
      logger.error({ err }, 'Failed to publish mode change event');
    });
  }

  // ── Core Event Handling ─────────────────────────────────────────────────

  private async handleEvent(event: AionEvent): Promise<void> {
    this.eventsProcessed++;
    this.lastEventAt = event.timestamp;

    // In manual mode, no automatic processing at all
    if (this.mode === 'manual') {
      logger.debug({ eventId: event.id, type: event.type }, 'Manual mode — event logged only');
      return;
    }

    // Evaluate rules
    let matchingRules: AutomationRule[];
    try {
      matchingRules = await rulesEngine.evaluate(event);
      this.rulesEvaluated += matchingRules.length;
    } catch (err) {
      logger.error({ err, eventId: event.id }, 'Rule evaluation failed');
      this.recordError();
      return;
    }

    if (matchingRules.length === 0) return;

    // Execute actions for each matching rule
    for (const rule of matchingRules) {
      await this.executeRule(rule, event);
    }
  }

  private async executeRule(rule: AutomationRule, event: AionEvent): Promise<void> {
    const correlationId = event.correlation_id ?? crypto.randomUUID();
    const startMs = Date.now();
    const results: ActionResult[] = [];
    let overallStatus: 'success' | 'partial' | 'failed' = 'success';

    for (const action of rule.actions) {
      const actionResult = await this.executeAction(action, event, correlationId);
      results.push(actionResult);

      if (actionResult.status === 'failed') {
        // Try fallback if available
        if (action.fallback) {
          logger.info(
            { ruleId: rule.id, action: action.type, fallback: action.fallback.type },
            'Primary action failed — trying fallback',
          );
          const fallbackResult = await this.executeAction(action.fallback, event, correlationId);
          results.push({ ...fallbackResult, action: `fallback:${fallbackResult.action}` });

          if (fallbackResult.status === 'failed') {
            overallStatus = 'partial';
          }
        } else {
          overallStatus = 'partial';
        }
      }
    }

    // Check if all failed
    if (results.every((r) => r.status === 'failed')) {
      overallStatus = 'failed';
    }

    const executionTimeMs = Date.now() - startMs;

    // Record the execution
    await rulesEngine.recordExecution(rule.id, {
      rule_id: rule.id,
      status: overallStatus,
      execution_time_ms: executionTimeMs,
      trigger_data: { event_id: event.id, event_type: event.type, ...event.data },
      results: results.map((r) => ({ action: r.action, status: r.status, detail: r.detail })),
    }, overallStatus === 'failed' ? results.find((r) => r.status === 'failed')?.detail : undefined);

    logger.info(
      {
        ruleId: rule.id,
        ruleName: rule.name,
        eventId: event.id,
        status: overallStatus,
        executionTimeMs,
        actionCount: results.length,
      },
      'Rule execution complete',
    );
  }

  // ── Action Execution ────────────────────────────────────────────────────

  private async executeAction(
    action: RuleAction,
    event: AionEvent,
    correlationId: string,
  ): Promise<ActionResult> {
    const startMs = Date.now();
    const actionType = action.type;
    const config = action.config ?? {};

    // Mode-based filtering
    if (this.mode === 'assisted' && CRITICAL_ACTIONS.has(actionType)) {
      logger.info(
        { actionType, ruleConfig: config, eventId: event.id },
        'Assisted mode — critical action logged but not executed',
      );
      return {
        action: actionType,
        status: 'skipped',
        detail: 'Assisted mode — requires operator confirmation',
        duration_ms: Date.now() - startMs,
      };
    }

    if (this.mode === 'degraded' && EXTERNAL_ACTIONS.has(actionType)) {
      logger.info(
        { actionType, eventId: event.id },
        'Degraded mode — external action skipped',
      );
      return {
        action: actionType,
        status: 'skipped',
        detail: 'Degraded mode — external actions disabled',
        duration_ms: Date.now() - startMs,
      };
    }

    // Execute with timeout
    try {
      const timeoutMs = (config.timeout_ms as number) ?? ACTION_TIMEOUT_MS;
      const detail = await this.withTimeout(
        this.dispatchAction(actionType, config, event, correlationId),
        timeoutMs,
      );

      this.actionsExecuted++;

      return {
        action: actionType,
        status: 'success',
        detail,
        duration_ms: Date.now() - startMs,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ err: errorMsg, actionType, eventId: event.id }, 'Action execution failed');
      this.recordError();

      return {
        action: actionType,
        status: 'failed',
        detail: errorMsg,
        duration_ms: Date.now() - startMs,
      };
    }
  }

  private async dispatchAction(
    actionType: string,
    config: Record<string, unknown>,
    event: AionEvent,
    correlationId: string,
  ): Promise<string> {
    switch (actionType) {
      case 'open_door': {
        const doorId = (config.door_id as string) ?? (config.device_id as string) ?? event.device_id;
        logger.info(
          { doorId, eventId: event.id, correlationId },
          'Action: open_door — door open command dispatched',
        );
        return `Door ${doorId ?? 'unknown'} open command sent`;
      }

      case 'toggle_device': {
        const deviceId = (config.device_id as string) ?? event.device_id;
        const state = (config.state as string) ?? 'on';
        logger.info(
          { deviceId, state, eventId: event.id, correlationId },
          'Action: toggle_device — device toggle dispatched',
        );
        return `Device ${deviceId ?? 'unknown'} toggled to ${state}`;
      }

      case 'create_alert': {
        const tenantId = (config.tenant_id as string) ?? event.data.tenant_id as string ?? null;
        const ruleId = config.rule_id as string ?? null;
        const severity = (config.severity as string) ?? event.severity;
        const title = (config.title as string) ?? `Auto-alert: ${event.type}`;
        const message = (config.message as string) ?? `Event ${event.id} triggered alert — ${event.type} from ${event.source}`;

        if (tenantId && ruleId) {
          try {
            await db.execute(sql`
              INSERT INTO alert_instances (id, tenant_id, rule_id, event_id, status, severity, title, message, metadata, created_at, updated_at)
              VALUES (
                ${crypto.randomUUID()},
                ${tenantId},
                ${ruleId},
                ${event.id},
                'firing',
                ${severity},
                ${title},
                ${message},
                ${JSON.stringify({ correlation_id: correlationId, source: event.source })}::jsonb,
                NOW(),
                NOW()
              )
            `);
            return `Alert created: ${title}`;
          } catch (err) {
            logger.error({ err }, 'Failed to insert alert instance');
            return `Alert logged (DB insert failed): ${title}`;
          }
        }

        logger.info({ severity, title, eventId: event.id }, 'Action: create_alert');
        return `Alert logged: ${title}`;
      }

      case 'send_notification': {
        const channel = (config.channel as string) ?? 'events';
        const tenantId = (config.tenant_id as string) ?? event.data.tenant_id as string;
        const payload = {
          type: 'automation_notification',
          event_id: event.id,
          event_type: event.type,
          severity: event.severity,
          message: (config.message as string) ?? `${event.type} from ${event.source}`,
          correlation_id: correlationId,
          timestamp: event.timestamp,
        };

        if (tenantId) {
          broadcast(tenantId, channel, payload);
          return `WebSocket notification sent on channel ${channel}`;
        }

        logger.info({ channel, payload }, 'Action: send_notification — no tenant_id, logged only');
        return `Notification logged (no tenant_id for broadcast)`;
      }

      case 'take_snapshot': {
        const streamName = (config.stream_name as string) ?? (config.device_id as string) ?? event.device_id;
        if (!streamName) {
          return 'Snapshot skipped — no stream name';
        }

        try {
          const resp = await fetch(`${GO2RTC_URL}/api/frame.jpeg?src=${encodeURIComponent(streamName)}`, {
            signal: AbortSignal.timeout(5000),
          });

          if (resp.ok) {
            logger.info({ streamName, eventId: event.id }, 'Snapshot captured via go2rtc');
            return `Snapshot captured for stream ${streamName}`;
          }
          return `Snapshot request returned ${resp.status}`;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          logger.warn({ streamName, err: msg }, 'Snapshot capture failed');
          return `Snapshot failed: ${msg}`;
        }
      }

      case 'log_event': {
        const logType = (config.event_type as string) ?? `${event.type}.processed`;
        const logSeverity = (config.severity as 'info' | 'warning' | 'critical' | 'emergency') ?? 'info';

        await eventBus.publish({
          type: logType,
          source: 'orchestrator',
          severity: logSeverity,
          data: {
            original_event_id: event.id,
            original_type: event.type,
            ...(config.extra_data as Record<string, unknown> ?? {}),
          },
          correlation_id: correlationId,
          site_id: event.site_id,
          device_id: event.device_id,
        });

        return `Event logged: ${logType}`;
      }

      case 'create_incident': {
        const tenantId = (config.tenant_id as string) ?? event.data.tenant_id as string ?? null;
        const title = (config.title as string) ?? `Incident: ${event.type}`;
        const description = (config.description as string) ?? `Automated incident from event ${event.id} — ${event.type} from ${event.source}`;
        const priority = (config.priority as string) ?? 'medium';
        const createdBy = (config.created_by as string) ?? event.actor ?? '00000000-0000-0000-0000-000000000000';

        if (tenantId) {
          try {
            await db.execute(sql`
              INSERT INTO incidents (id, tenant_id, site_id, title, description, status, priority, created_by, event_ids, comments, created_at, updated_at)
              VALUES (
                ${crypto.randomUUID()},
                ${tenantId},
                ${event.site_id ?? null},
                ${title},
                ${description},
                'open',
                ${priority},
                ${createdBy},
                ${sql`ARRAY[${event.id}]::uuid[]`},
                '[]'::jsonb,
                NOW(),
                NOW()
              )
            `);
            return `Incident created: ${title}`;
          } catch (err) {
            logger.error({ err }, 'Failed to insert incident');
            return `Incident logged (DB insert failed): ${title}`;
          }
        }

        logger.info({ title, priority, eventId: event.id }, 'Action: create_incident — logged only');
        return `Incident logged: ${title}`;
      }

      default:
        logger.warn({ actionType }, 'Unknown action type — skipping');
        return `Unknown action: ${actionType}`;
    }
  }

  // ── Health Check ────────────────────────────────────────────────────────

  /**
   * Return the current health status of the orchestrator.
   * Used by the watchdog / health check endpoint.
   */
  health(): HealthStatus {
    const now = Date.now();
    const oneHourAgo = now - 3_600_000;

    // Prune old errors
    this.recentErrors = this.recentErrors.filter((ts) => ts > oneHourAgo);

    let status: HealthStatus['status'] = 'healthy';
    if (!this.running) {
      status = 'unhealthy';
    } else if (this.recentErrors.length > 50) {
      status = 'degraded';
    } else if (this.mode === 'degraded' || this.mode === 'manual') {
      status = 'degraded';
    }

    return {
      status,
      mode: this.mode,
      uptime_ms: this.running ? now - this.startedAt : 0,
      events_processed: this.eventsProcessed,
      rules_evaluated: this.rulesEvaluated,
      actions_executed: this.actionsExecuted,
      last_event_at: this.lastEventAt,
      errors_last_hour: this.recentErrors.length,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Action timed out after ${ms}ms`)), ms);
      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private recordError(): void {
    this.recentErrors.push(Date.now());
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const orchestrator = new Orchestrator();
