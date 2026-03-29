import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { internalAgent } from './service.js';

export async function registerInternalAgentRoutes(app: FastifyInstance) {
  // Get latest health reports
  app.get('/status', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (_request, reply) => {
    const reports = internalAgent.getLatestReports();
    const score = internalAgent.getOverallScore();
    return reply.send({
      success: true,
      data: {
        score,
        status: score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical',
        reports,
        lastCheck: reports[0]?.timestamp || null,
      },
    });
  });

  // Force immediate health check
  app.post('/check', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (_request, reply) => {
    const reports = await internalAgent.runHealthCheck();
    return reply.send({ success: true, data: { reports, score: internalAgent.getOverallScore() } });
  });

  // Get proactive alerts (anomaly detection)
  app.get('/proactive', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (_request, reply) => {
    const alerts = internalAgent.getProactiveAlerts();
    return reply.send({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        lastAnalysis: new Date().toISOString(),
      },
    });
  });

  // Force immediate proactive analysis
  app.post('/proactive', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (_request, reply) => {
    const alerts = await internalAgent.runProactiveAnalysis();
    return reply.send({ success: true, data: { alerts, count: alerts.length } });
  });

  // Get predictive intelligence
  app.get('/predictions', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (_request, reply) => {
    const predictions = await internalAgent.getPredictions();
    return reply.send({
      success: true,
      data: {
        predictions,
        count: predictions.length,
        generatedAt: new Date().toISOString(),
      },
    });
  });
}
