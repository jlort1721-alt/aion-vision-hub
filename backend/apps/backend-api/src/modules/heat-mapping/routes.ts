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

  /** GET /analytics/heatmap/zones -- Device activity zones */
  app.get('/zones', {
    preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
  }, async (request, reply) => {
    const data = await heatMapping.getDeviceActivityZones(request.tenantId);
    return reply.send({ success: true, data });
  });
}
