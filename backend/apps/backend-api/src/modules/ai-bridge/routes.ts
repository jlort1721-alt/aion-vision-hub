import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { aiBridgeService } from './service.js';
import { chatRequestSchema, chatStreamRequestSchema, usageQuerySchema } from './schemas.js';
import type { ApiResponse } from '@aion/shared-contracts';

export async function registerAIBridgeRoutes(app: FastifyInstance) {
  // ── POST /chat — Send chat message to AI provider ───────────
  app.post(
    '/chat',
    { preHandler: [requireRole('tenant_admin', 'operator')] },
    async (request) => {
      const input = chatRequestSchema.parse(request.body);
      const result = await aiBridgeService.chat(input, request.tenantId, request.userId);

      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ── POST /chat/stream — Streaming chat response (SSE) ───────
  app.post(
    '/chat/stream',
    { preHandler: [requireRole('tenant_admin', 'operator')] },
    async (request, reply) => {
      const input = chatStreamRequestSchema.parse(request.body);

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      try {
        const stream = aiBridgeService.chatStream(input, request.tenantId, request.userId);

        for await (const chunk of stream) {
          const ssePayload = `data: ${JSON.stringify(chunk)}\n\n`;
          reply.raw.write(ssePayload);

          if (chunk.done) {
            break;
          }
        }
      } catch (error) {
        const errorPayload = {
          content: '',
          done: true,
          error: error instanceof Error ? error.message : 'Stream failed',
        };
        reply.raw.write(`data: ${JSON.stringify(errorPayload)}\n\n`);
      } finally {
        reply.raw.end();
      }
    },
  );

  // ── GET /usage — Get AI usage stats for tenant ──────────────
  app.get(
    '/usage',
    { preHandler: [requireRole('tenant_admin')] },
    async (request) => {
      const query = usageQuerySchema.parse(request.query);
      const usage = await aiBridgeService.getUsage(request.tenantId, query);

      return { success: true, data: usage } satisfies ApiResponse;
    },
  );
}
