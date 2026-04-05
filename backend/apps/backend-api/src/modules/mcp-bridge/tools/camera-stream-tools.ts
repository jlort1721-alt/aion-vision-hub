/**
 * MCP Tools — Camera & Stream Management
 * Provides tools for querying cameras, streams, go2rtc status, and snapshots.
 */
import type { MCPServerTool } from './index.js';
import { db } from '../../../db/client.js';
import { sql } from 'drizzle-orm';

const GO2RTC_API = 'http://localhost:1984/api';

export const cameraStreamTools: MCPServerTool[] = [
  {
    name: 'list_cameras',
    description: 'List all cameras with site and device info. Optionally filter by site or status.',
    parameters: {
      site_id: { type: 'string', description: 'Filter by site UUID', required: false },
      status: { type: 'string', description: 'Filter by status', enum: ['online', 'offline', 'unknown'], required: false },
      limit: { type: 'number', description: 'Max results (default 50)', required: false },
    },
    execute: async (params, ctx) => {
      const limit = Number(params.limit) || 50;
      let query = `SELECT c.id, c.name, c.stream_key, c.status, c.channel_number, c.brand, s.name as site_name
        FROM cameras c LEFT JOIN sites s ON c.site_id = s.id
        WHERE c.tenant_id = '${ctx.tenantId}'`;
      if (params.site_id) query += ` AND c.site_id = '${params.site_id}'`;
      if (params.status) query += ` AND c.status = '${params.status}'`;
      query += ` ORDER BY s.name, c.channel_number LIMIT ${limit}`;

      const rows = await db.execute(sql.raw(query));
      return { cameras: rows, total: (rows as unknown[]).length };
    },
  },
  {
    name: 'get_stream_status',
    description: 'Get go2rtc stream status for a specific camera by its stream_key.',
    parameters: {
      stream_key: { type: 'string', description: 'Stream key (e.g. da-brescia-ch0)', required: true },
    },
    execute: async (params) => {
      const key = params.stream_key as string;
      const resp = await fetch(`${GO2RTC_API}/streams?src=${encodeURIComponent(key)}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return { error: `go2rtc returned ${resp.status}` };
      const data = (await resp.json()) as Record<string, unknown>;
      const producers = (data.producers ?? []) as Array<{ url: string }>;
      const consumers = (data.consumers ?? []) as unknown[];
      return {
        stream_key: key,
        hasProducer: producers.length > 0,
        producerUrl: producers[0]?.url || null,
        consumerCount: consumers.length,
      };
    },
  },
  {
    name: 'get_go2rtc_summary',
    description: 'Get a summary of all go2rtc streams grouped by site prefix.',
    parameters: {},
    execute: async () => {
      const resp = await fetch(`${GO2RTC_API}/streams`, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return { error: `go2rtc returned ${resp.status}` };
      const data = (await resp.json()) as Record<string, { producers?: Array<{ url: string }>; consumers?: unknown[] }>;
      const total = Object.keys(data).length;
      const groups: Record<string, { total: number; withProducer: number }> = {};
      for (const [key, val] of Object.entries(data)) {
        const prefix = key.includes('-ch') ? key.split('-ch')[0] : key.split('-').slice(0, -1).join('-') || key;
        if (!groups[prefix]) groups[prefix] = { total: 0, withProducer: 0 };
        groups[prefix].total++;
        if (val.producers && val.producers.length > 0) groups[prefix].withProducer++;
      }
      return { totalStreams: total, groups };
    },
  },
  {
    name: 'get_camera_snapshot',
    description: 'Check if a camera snapshot is available via go2rtc. Returns size in bytes.',
    parameters: {
      stream_key: { type: 'string', description: 'Stream key', required: true },
    },
    execute: async (params) => {
      const key = params.stream_key as string;
      const resp = await fetch(`${GO2RTC_API}/frame.jpeg?src=${encodeURIComponent(key)}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) return { available: false, error: `HTTP ${resp.status}` };
      const buffer = await resp.arrayBuffer();
      return {
        available: buffer.byteLength > 1000,
        sizeBytes: buffer.byteLength,
        stream_key: key,
      };
    },
  },
];
