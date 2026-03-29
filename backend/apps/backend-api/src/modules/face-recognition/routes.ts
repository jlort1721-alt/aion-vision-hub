import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { faceRecognition } from '../../services/face-recognition.js';

export async function registerFaceRecognitionRoutes(app: FastifyInstance) {
  app.get('/status', {
    preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
  }, async (_req, reply) => {
    return reply.send({ success: true, data: faceRecognition.getStatus() });
  });
}
