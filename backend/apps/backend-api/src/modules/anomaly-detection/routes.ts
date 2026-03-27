import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { detectAnomalies, getBaseline, buildBaseline } from './service.js';

export async function registerAnomalyDetectionRoutes(app: FastifyInstance) {

  // GET /anomalies — List detected anomalies (current scan)
  app.get(
    '/',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Anomaly Detection'], summary: 'Detect and list current anomalies' },
    },
    async (request, reply) => {
      const anomalies = await detectAnomalies(request.tenantId);
      return reply.send({ success: true, data: anomalies, meta: { count: anomalies.length, scannedAt: new Date().toISOString() } });
    },
  );

  // GET /anomalies/baseline — View current baseline
  app.get(
    '/baseline',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Anomaly Detection'], summary: 'View baseline statistics' },
    },
    async (request, reply) => {
      const baseline = await getBaseline(request.tenantId);
      return reply.send({ success: true, data: baseline });
    },
  );

  // POST /anomalies/scan — Force manual scan
  app.post(
    '/scan',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Anomaly Detection'], summary: 'Trigger manual anomaly scan' },
    },
    async (request, reply) => {
      const anomalies = await detectAnomalies(request.tenantId);

      await request.audit('anomaly.manual_scan', 'anomaly_detection', undefined, {
        anomalyCount: anomalies.length,
      });

      return reply.send({ success: true, data: anomalies });
    },
  );

  // POST /anomalies/rebuild-baseline — Force baseline rebuild
  app.post(
    '/rebuild-baseline',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Anomaly Detection'], summary: 'Rebuild anomaly detection baseline' },
    },
    async (request, reply) => {
      const baseline = await buildBaseline(request.tenantId);

      await request.audit('anomaly.rebuild_baseline', 'anomaly_detection', undefined, {
        avgEventsPerHour: baseline.avgEventsPerHour,
      });

      return reply.send({ success: true, data: baseline });
    },
  );
}
