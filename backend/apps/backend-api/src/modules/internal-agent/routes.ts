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
}
