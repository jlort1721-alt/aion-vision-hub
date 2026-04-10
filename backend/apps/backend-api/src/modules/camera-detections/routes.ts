import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { requireRole } from '../../plugins/auth.js';
import { cameraDetectionService } from './service.js';
import { createDetectionSchema, listDetectionsFilterSchema, reviewDetectionSchema } from './schemas.js';
import type { ApiResponse } from '@aion/shared-contracts';

async function cameraDetectionRoutes(app: FastifyInstance) {
  // GET / — List detections with filters
  app.get(
    '/',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const filters = listDetectionsFilterSchema.parse(request.query);
      const { items, meta } = await cameraDetectionService.list(request.tenantId, filters);
      return { success: true, data: items, meta } satisfies ApiResponse;
    },
  );

  // GET /stats — Detection statistics (BEFORE /:id to avoid param conflict)
  app.get(
    '/stats',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const query = request.query as Record<string, string>;
      const filters = {
        siteId: query.siteId,
        cameraId: query.cameraId,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      };
      const stats = await cameraDetectionService.getStats(request.tenantId, filters);
      return { success: true, data: stats } satisfies ApiResponse;
    },
  );

  // GET /:id — Get single detection
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const row = await cameraDetectionService.getById(request.params.id, request.tenantId);
      return { success: true, data: row } satisfies ApiResponse;
    },
  );

  // POST / — Create detection
  app.post(
    '/',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const input = createDetectionSchema.parse(request.body);
      const row = await cameraDetectionService.create(input, request.tenantId);
      request.audit('camera-detection.create', 'camera_detection', row.id, { type: row.type, cameraId: row.cameraId });
      return reply.code(201).send({ success: true, data: row } satisfies ApiResponse);
    },
  );

  // PATCH /:id/review — Mark detection as reviewed
  app.patch<{ Params: { id: string } }>(
    '/:id/review',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request) => {
      const input = reviewDetectionSchema.parse(request.body);
      const row = await cameraDetectionService.markReviewed(
        request.params.id,
        request.tenantId,
        request.userId,
        input.notes,
      );
      request.audit('camera-detection.review', 'camera_detection', row.id, { reviewedBy: request.userId });
      return { success: true, data: row } satisfies ApiResponse;
    },
  );
}

export const registerCameraDetectionRoutes = fp(cameraDetectionRoutes, {
  name: 'camera-detection-routes',
});
