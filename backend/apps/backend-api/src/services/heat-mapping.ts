/**
 * Heat Mapping Service -- Traffic analysis and zone activity visualization
 * Uses access_logs + event data to generate heat map data per zone/time
 * No external dependencies -- pure PostgreSQL aggregation
 */
import { db } from '../db/client.js';
import { sql } from 'drizzle-orm';
import { createLogger } from '@aion/common-utils';

const _logger = createLogger({ name: 'heat-mapping' });

export class HeatMappingService {
  /** Get hourly event density by site for the last N days */
  async getEventHeatmap(tenantId: string, days = 7): Promise<Record<string, unknown>[]> {
    try {
      const results = await db.execute(sql`
        SELECT s.name as site_name, EXTRACT(HOUR FROM e.created_at) as hour,
               EXTRACT(DOW FROM e.created_at) as day_of_week, count(*) as event_count
        FROM events e JOIN sites s ON e.site_id = s.id
        WHERE e.tenant_id = ${tenantId} AND e.created_at > NOW() - ${days + ' days'}::interval
        GROUP BY s.name, EXTRACT(HOUR FROM e.created_at), EXTRACT(DOW FROM e.created_at)
        ORDER BY s.name, day_of_week, hour
      `);
      return results as unknown as Record<string, unknown>[];
    } catch {
      return [];
    }
  }

  /** Get access traffic by hour for a site */
  async getAccessHeatmap(tenantId: string, siteId?: string): Promise<Record<string, unknown>[]> {
    try {
      if (siteId) {
        const results = await db.execute(sql`
          SELECT EXTRACT(HOUR FROM created_at) as hour, EXTRACT(DOW FROM created_at) as day,
                 count(*) as total, count(*) FILTER (WHERE direction = 'in') as entries,
                 count(*) FILTER (WHERE direction = 'out') as exits
          FROM access_logs WHERE tenant_id = ${tenantId} AND site_id = ${siteId}
            AND created_at > NOW() - INTERVAL '30 days'
          GROUP BY hour, day ORDER BY day, hour
        `);
        return results as unknown as Record<string, unknown>[];
      }
      const results = await db.execute(sql`
        SELECT EXTRACT(HOUR FROM created_at) as hour, EXTRACT(DOW FROM created_at) as day,
               count(*) as total, count(*) FILTER (WHERE direction = 'in') as entries,
               count(*) FILTER (WHERE direction = 'out') as exits
        FROM access_logs WHERE tenant_id = ${tenantId}
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY hour, day ORDER BY day, hour
      `);
      return results as unknown as Record<string, unknown>[];
    } catch {
      return [];
    }
  }

  /** Get device activity zones */
  async getDeviceActivityZones(tenantId: string): Promise<Record<string, unknown>[]> {
    try {
      const results = await db.execute(sql`
        SELECT s.name as site_name, d.type as device_type, count(e.id) as event_count,
               max(e.created_at) as last_event
        FROM devices d
        LEFT JOIN events e ON e.device_id = d.id AND e.created_at > NOW() - INTERVAL '7 days'
        JOIN sites s ON d.site_id = s.id
        WHERE d.tenant_id = ${tenantId}
        GROUP BY s.name, d.type
        ORDER BY event_count DESC
      `);
      return results as unknown as Record<string, unknown>[];
    } catch {
      return [];
    }
  }
}

export const heatMapping = new HeatMappingService();
