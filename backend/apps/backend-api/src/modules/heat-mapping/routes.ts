import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { heatMapping } from '../../services/heat-mapping.js';

export async function registerHeatMappingRoutes(app: FastifyInstance) {
  /** GET /analytics/heatmap/events -- Event density by site/hour */
  app.get('/events', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (request, reply) => {
    const { days } = request.query as { days?: string };
    const data = await heatMapping.getEventHeatmap(request.tenantId, days ? parseInt(days) : 7);
    return reply.send({ success: true, data });
  });

  /** GET /analytics/heatmap/access -- Access traffic by hour */
  app.get('/access', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (request, reply) => {
    const { siteId } = request.query as { siteId?: string };
    const data = await heatMapping.getAccessHeatmap(request.tenantId, siteId);
    return reply.send({ success: true, data });
  });

  /** GET /analytics/heatmap/zones -- Event density by site zones (site_id + hour) */
  app.get('/zones', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (request, reply) => {
    const { days } = request.query as { days?: string };
    const data = await heatMapping.getZoneDensity(request.tenantId, days ? parseInt(days) : 7);
    return reply.send({ success: true, data });
  });

  /** GET /analytics/heatmap/device-zones -- Device activity zones (legacy) */
  app.get('/device-zones', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (request, reply) => {
    const data = await heatMapping.getDeviceActivityZones(request.tenantId);
    return reply.send({ success: true, data });
  });

  /** GET /analytics/heatmap/hourly -- 24-hour activity pattern */
  app.get('/hourly', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (request, reply) => {
    const { days } = request.query as { days?: string };
    const data = await heatMapping.getHourlyPattern(request.tenantId, days ? parseInt(days) : 7);
    return reply.send({ success: true, data });
  });

  /** GET /analytics/heatmap/weekly -- 7-day weekly pattern */
  app.get('/weekly', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (request, reply) => {
    const { weeks } = request.query as { weeks?: string };
    const data = await heatMapping.getWeeklyPattern(request.tenantId, weeks ? parseInt(weeks) : 4);
    return reply.send({ success: true, data });
  });

  /** GET /analytics/heatmap/access-traffic -- Access log density by hour and site */
  app.get('/access-traffic', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (request, reply) => {
    const { days } = request.query as { days?: string };
    const data = await heatMapping.getAccessTraffic(request.tenantId, days ? parseInt(days) : 30);
    return reply.send({ success: true, data });
  });
}
