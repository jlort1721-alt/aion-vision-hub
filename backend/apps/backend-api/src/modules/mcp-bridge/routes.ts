import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { mcpBridgeService } from './service.js';
import { executeToolSchema } from './schemas.js';
import type { ApiResponse } from '@aion/shared-contracts';

export async function registerMCPBridgeRoutes(app: FastifyInstance) {
  // ── GET /tools — List available MCP tools for tenant ────────
  app.get(
    '/tools',
    { preHandler: [requireRole('tenant_admin', 'operator')] },
    async (request) => {
      const tools = await mcpBridgeService.listTools(request.tenantId);

      return {
        success: true,
        data: tools,
        meta: { total: tools.length, page: 1, perPage: tools.length, totalPages: 1 },
      } satisfies ApiResponse;
    },
  );

  // ── GET /connectors — List MCP connectors for tenant ────────
  app.get(
    '/connectors',
    { preHandler: [requireRole('tenant_admin', 'operator')] },
    async (request) => {
      const connectors = await mcpBridgeService.listConnectors(request.tenantId);

      return {
        success: true,
        data: connectors,
        meta: { total: connectors.length, page: 1, perPage: connectors.length, totalPages: 1 },
      } satisfies ApiResponse;
    },
  );

  // ── POST /execute — Execute an MCP tool ─────────────────────
  app.post(
    '/execute',
    { preHandler: [requireRole('tenant_admin', 'operator')] },
    async (request) => {
      const input = executeToolSchema.parse(request.body);
      const result = await mcpBridgeService.execute(request.tenantId, input, request.userId);

      await request.audit('mcp.execute', 'mcp-tool', input.toolName, {
        success: result.success,
        executionMs: result.executionMs,
      });

      return { success: true, data: result } satisfies ApiResponse;
    },
  );
}
