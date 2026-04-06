/**
 * Heat Mapping Service -- Traffic analysis and zone activity visualization
 * Uses access_logs + event data to generate heat map data per zone/time
 * No external dependencies -- pure PostgreSQL aggregation
 */
import { db } from '../db/client.js';
import { sql } from 'drizzle-orm';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'heat-mapping' });

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
    } catch (err) {
      logger.error({ err }, 'Failed to get event heatmap');
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
    } catch (err) {
      logger.error({ err }, 'Failed to get access heatmap');
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
    } catch (err) {
      logger.error({ err }, 'Failed to get device activity zones');
      return [];
    }
  }

  /** Get event density by site zones -- group by site_id and hour of day */
  async getZoneDensity(tenantId: string, days = 7): Promise<Record<string, unknown>[]> {
    try {
      const results = await db.execute(sql`
        SELECT s.id as site_id, s.name as site_name,
               EXTRACT(HOUR FROM e.created_at)::int as hour,
               count(*)::int as event_count
        FROM events e
        JOIN sites s ON e.site_id = s.id
        WHERE e.tenant_id = ${tenantId}
          AND e.created_at > NOW() - ${days + ' days'}::interval
        GROUP BY s.id, s.name, EXTRACT(HOUR FROM e.created_at)
        ORDER BY s.name, hour
      `);
      return results as unknown as Record<string, unknown>[];
    } catch (err) {
      logger.error({ err }, 'Failed to get zone density');
      return [];
    }
  }

  /** Get 24-hour activity pattern -- events per hour across all sites */
  async getHourlyPattern(tenantId: string, days = 7): Promise<Record<string, unknown>[]> {
    try {
      const results = await db.execute(sql`
        SELECT EXTRACT(HOUR FROM e.created_at)::int as hour,
               count(*)::int as event_count,
               count(DISTINCT e.site_id)::int as active_sites,
               count(DISTINCT e.device_id)::int as active_devices
        FROM events e
        WHERE e.tenant_id = ${tenantId}
          AND e.created_at > NOW() - ${days + ' days'}::interval
        GROUP BY EXTRACT(HOUR FROM e.created_at)
        ORDER BY hour
      `);
      return results as unknown as Record<string, unknown>[];
    } catch (err) {
      logger.error({ err }, 'Failed to get hourly pattern');
      return [];
    }
  }

  /** Get 7-day weekly pattern -- events per day of week */
  async getWeeklyPattern(tenantId: string, weeks = 4): Promise<Record<string, unknown>[]> {
    try {
      const results = await db.execute(sql`
        SELECT EXTRACT(DOW FROM e.created_at)::int as day_of_week,
               CASE EXTRACT(DOW FROM e.created_at)::int
                 WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday'
                 WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
                 WHEN 6 THEN 'Saturday'
               END as day_name,
               count(*)::int as event_count,
               round(count(*)::numeric / ${weeks}, 1)::float as avg_per_week
        FROM events e
        WHERE e.tenant_id = ${tenantId}
          AND e.created_at > NOW() - ${weeks * 7 + ' days'}::interval
        GROUP BY EXTRACT(DOW FROM e.created_at)
        ORDER BY day_of_week
      `);
      return results as unknown as Record<string, unknown>[];
    } catch (err) {
      logger.error({ err }, 'Failed to get weekly pattern');
      return [];
    }
  }

  /** Get access log density by hour and site */
  async getAccessTraffic(tenantId: string, days = 30): Promise<Record<string, unknown>[]> {
    try {
      const results = await db.execute(sql`
        SELECT s.id as site_id, s.name as site_name,
               EXTRACT(HOUR FROM al.created_at)::int as hour,
               count(*)::int as total,
               count(*) FILTER (WHERE al.direction = 'in')::int as entries,
               count(*) FILTER (WHERE al.direction = 'out')::int as exits
        FROM access_logs al
        JOIN sites s ON al.site_id = s.id
        WHERE al.tenant_id = ${tenantId}
          AND al.created_at > NOW() - ${days + ' days'}::interval
        GROUP BY s.id, s.name, EXTRACT(HOUR FROM al.created_at)
        ORDER BY s.name, hour
      `);
      return results as unknown as Record<string, unknown>[];
    } catch (err) {
      logger.error({ err }, 'Failed to get access traffic');
      return [];
    }
  }
}

export const heatMapping = new HeatMappingService();
