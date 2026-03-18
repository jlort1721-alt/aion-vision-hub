import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { db } from '../../db/client.js';
import { cloudAccountService } from './service.js';
import type { ApiResponse } from '@aion/shared-contracts';

export async function registerCloudAccountRoutes(app: FastifyInstance) {
  // ── GET /mapping — Cloud account mapping with risk analysis ────
  app.get(
    '/mapping',
    { preHandler: [requireRole('tenant_admin', 'operator', 'viewer')] },
    async (request) => {
      const mapping = await cloudAccountService.getAccountMapping(db, request.tenantId);

      return {
        success: true,
        data: mapping,
      } satisfies ApiResponse;
    },
  );

  // ── GET /inventory — Device inventory summary ─────────────────
  app.get(
    '/inventory',
    { preHandler: [requireRole('tenant_admin', 'operator', 'viewer')] },
    async (request) => {
      const inventory = await cloudAccountService.getDeviceInventorySummary(db, request.tenantId);

      return {
        success: true,
        data: inventory,
      } satisfies ApiResponse;
    },
  );

  // ── GET /pending — Pending devices list ───────────────────────
  app.get(
    '/pending',
    { preHandler: [requireRole('tenant_admin', 'operator', 'viewer')] },
    async (request) => {
      const pending = await cloudAccountService.getPendingDevices(db, request.tenantId);

      return {
        success: true,
        data: { items: pending, total: pending.length },
      } satisfies ApiResponse;
    },
  );
}
