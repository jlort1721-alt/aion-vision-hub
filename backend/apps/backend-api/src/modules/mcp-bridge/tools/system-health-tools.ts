/**
 * MCP Tools — System Health & Watchdog
 * Provides tools for checking VPS health, service status, and resource usage.
 */
import type { MCPServerTool } from './index.js';
import { db } from '../../../db/client.js';
import { sql } from 'drizzle-orm';

export const systemHealthTools: MCPServerTool[] = [
  {
    name: 'check_system_health',
    description: 'Check overall system health: database connectivity, go2rtc status, Redis, and stream counts.',
    parameters: {},
    execute: async () => {
      const checks: Record<string, { status: string; detail?: string; latencyMs?: number }> = {};

      // Database
      const dbStart = Date.now();
      try {
        await db.execute(sql`SELECT 1 as ok`);
        checks.database = { status: 'healthy', latencyMs: Date.now() - dbStart };
      } catch (e) {
        checks.database = { status: 'down', detail: (e as Error).message, latencyMs: Date.now() - dbStart };
      }

      // go2rtc
      const g2Start = Date.now();
      try {
        const resp = await fetch('http://localhost:1984/api/streams', { signal: AbortSignal.timeout(5000) });
        const data = await resp.json() as Record<string, unknown>;
        checks.go2rtc = { status: 'healthy', detail: `${Object.keys(data).length} streams`, latencyMs: Date.now() - g2Start };
      } catch (e) {
        checks.go2rtc = { status: 'down', detail: (e as Error).message, latencyMs: Date.now() - g2Start };
      }

      // Redis
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        checks.redis = { status: 'configured', detail: 'URL present' };
      } else {
        checks.redis = { status: 'unconfigured', detail: 'REDIS_URL not set' };
      }

      const healthy = Object.values(checks).filter(c => c.status === 'healthy').length;
      const total = Object.keys(checks).length;

      return {
        status: healthy === total ? 'healthy' : healthy > 0 ? 'degraded' : 'down',
        checks,
        summary: `${healthy}/${total} services healthy`,
      };
    },
  },
  {
    name: 'get_table_counts',
    description: 'Get record counts for key database tables to assess data health.',
    parameters: {},
    execute: async () => {
      const tables = ['profiles', 'sites', 'devices', 'cameras', 'events', 'incidents',
        'residents', 'vehicles', 'intercom_devices', 'alert_rules', 'automation_rules'];
      const counts: Record<string, number> = {};

      for (const table of tables) {
        try {
          const result = await db.execute(sql.raw(`SELECT count(*) as c FROM ${table}`));
          counts[table] = Number((result as unknown as Array<{ c: string }>)[0]?.c ?? 0);
        } catch {
          counts[table] = -1; // table missing
        }
      }

      return counts;
    },
  },
  {
    name: 'get_recent_audit_logs',
    description: 'Get recent audit log entries for monitoring activity.',
    parameters: {
      limit: { type: 'number', description: 'Max entries (default 20)', required: false },
      action_filter: { type: 'string', description: 'Filter by action prefix (e.g. "mcp.tool")', required: false },
    },
    execute: async (params, ctx) => {
      const limit = Number(params.limit) || 20;
      const filter = params.action_filter as string | undefined;

      let query = `SELECT action, entity_type, entity_id, created_at, user_email FROM audit_logs WHERE tenant_id = '${ctx.tenantId}'`;
      if (filter) query += ` AND action LIKE '${filter}%'`;
      query += ` ORDER BY created_at DESC LIMIT ${limit}`;

      const result = await db.execute(sql.raw(query));
      return { logs: result, count: (result as unknown[]).length };
    },
  },
];
