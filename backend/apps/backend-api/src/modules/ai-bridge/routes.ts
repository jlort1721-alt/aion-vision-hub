import type { FastifyInstance } from 'fastify';
import { eq, and, sql, gte } from 'drizzle-orm';
import { requireRole } from '../../plugins/auth.js';
import { aiBridgeService } from './service.js';
import type { ToolStreamEvent } from './service.js';
import { chatRequestSchema, chatStreamRequestSchema, usageQuerySchema } from './schemas.js';
import { db } from '../../db/client.js';
import { events, incidents, devices } from '../../db/schema/index.js';
import type { ApiResponse } from '@aion/shared-contracts';

export async function registerAIBridgeRoutes(app: FastifyInstance) {
  // ── POST /chat — Send chat message to AI provider ───────────
  app.post(
    '/chat',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request) => {
      const input = chatRequestSchema.parse(request.body);

      const result = input.enableTools
        ? await aiBridgeService.chatWithTools(input, request.tenantId, request.userId)
        : await aiBridgeService.chat(input, request.tenantId, request.userId);

      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ── POST /chat/stream — Streaming chat response (SSE) ───────
  app.post(
    '/chat/stream',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request, reply) => {
      const input = chatStreamRequestSchema.parse(request.body);

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      try {
        if (input.enableTools) {
          // ── Tool-calling stream ──────────────────────────────
          const stream: AsyncGenerator<ToolStreamEvent> =
            aiBridgeService.chatStreamWithTools(input, request.tenantId, request.userId);

          for await (const event of stream) {
            const ssePayload = `data: ${JSON.stringify(event)}\n\n`;
            reply.raw.write(ssePayload);

            if (event.type === 'content' && event.done) {
              break;
            }
          }
        } else {
          // ── Plain stream (no tools) ──────────────────────────
          const stream = aiBridgeService.chatStream(input, request.tenantId, request.userId);

          for await (const chunk of stream) {
            const ssePayload = `data: ${JSON.stringify(chunk)}\n\n`;
            reply.raw.write(ssePayload);

            if (chunk.done) {
              break;
            }
          }
        }
      } catch (error) {
        const errorPayload = {
          type: 'content',
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

  // ── POST /feedback — Record user feedback on AI responses ───
  app.post(
    '/feedback',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { messageIndex, rating, comment } = request.body as {
        messageIndex: number;
        rating: 1 | -1;
        comment?: string;
      };
      // Log to audit trail (ai_feedback table will be added later)
      await request.audit('ai.feedback', 'ai_sessions', 'feedback', {
        messageIndex,
        rating,
        comment,
      });
      return reply.send({ success: true });
    },
  );

  // ── GET /usage — Get AI usage stats for tenant ──────────────
  app.get(
    '/usage',
    { preHandler: [requireRole('super_admin', 'tenant_admin')] },
    async (request) => {
      const query = usageQuerySchema.parse(request.query);
      const usage = await aiBridgeService.getUsage(request.tenantId, query);

      return { success: true, data: usage } satisfies ApiResponse;
    },
  );

  // ── GET /shift-summary — AI-generated shift summary ────────
  app.get(
    '/shift-summary',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request) => {
      const now = new Date();
      const last8h = new Date(now.getTime() - 8 * 60 * 60 * 1000);
      const tenantId = request.tenantId;

      // Query events from last 8 hours
      const [eventStats] = await db
        .select({
          total: sql<number>`count(*)::int`,
          critical: sql<number>`count(*) filter (where ${events.severity} = 'critical')::int`,
          high: sql<number>`count(*) filter (where ${events.severity} = 'high')::int`,
          medium: sql<number>`count(*) filter (where ${events.severity} = 'medium')::int`,
          low: sql<number>`count(*) filter (where ${events.severity} = 'low')::int`,
        })
        .from(events)
        .where(and(
          eq(events.tenantId, tenantId),
          gte(events.createdAt, last8h),
        ));

      // Event types summary
      const eventTypeRows = await db
        .select({
          type: events.eventType,
          count: sql<number>`count(*)::int`,
        })
        .from(events)
        .where(and(
          eq(events.tenantId, tenantId),
          gte(events.createdAt, last8h),
        ))
        .groupBy(events.eventType);

      const eventTypesSummary = eventTypeRows
        .map((r) => `${r.type}: ${r.count}`)
        .join(', ') || 'Ninguno';

      // Query incidents from last 8 hours
      const [incidentStats] = await db
        .select({
          total: sql<number>`count(*)::int`,
          open: sql<number>`count(*) filter (where ${incidents.status} in ('open', 'investigating'))::int`,
          resolved: sql<number>`count(*) filter (where ${incidents.status} in ('resolved', 'closed'))::int`,
        })
        .from(incidents)
        .where(and(
          eq(incidents.tenantId, tenantId),
          gte(incidents.createdAt, last8h),
        ));

      // Device status summary
      const [deviceStats] = await db
        .select({
          total: sql<number>`count(*)::int`,
          online: sql<number>`count(*) filter (where ${devices.status} = 'online')::int`,
          offline: sql<number>`count(*) filter (where ${devices.status} = 'offline')::int`,
        })
        .from(devices)
        .where(eq(devices.tenantId, tenantId));

      const stats = {
        events: {
          total: eventStats?.total ?? 0,
          critical: eventStats?.critical ?? 0,
          high: eventStats?.high ?? 0,
          medium: eventStats?.medium ?? 0,
          low: eventStats?.low ?? 0,
          types: eventTypesSummary,
        },
        incidents: {
          total: incidentStats?.total ?? 0,
          open: incidentStats?.open ?? 0,
          resolved: incidentStats?.resolved ?? 0,
        },
        devices: {
          total: deviceStats?.total ?? 0,
          online: deviceStats?.online ?? 0,
          offline: deviceStats?.offline ?? 0,
        },
      };

      // Build the prompt
      const prompt = `Eres el asistente operativo de una central de monitoreo de seguridad.
Genera un resumen ejecutivo del turno basado en estos datos:

EVENTOS (últimas 8 horas): ${stats.events.total} total
- Críticos: ${stats.events.critical}
- Altos: ${stats.events.high}
- Medios: ${stats.events.medium}
- Bajos: ${stats.events.low}
Tipos: ${stats.events.types}

INCIDENTES: ${stats.incidents.total}
- Abiertos: ${stats.incidents.open}
- Resueltos: ${stats.incidents.resolved}

DISPOSITIVOS: ${stats.devices.total} total, ${stats.devices.online} en línea, ${stats.devices.offline} fuera de línea

Genera:
1. Resumen ejecutivo (2-3 oraciones)
2. Eventos destacados
3. Estado de dispositivos
4. Recomendaciones para el siguiente turno
5. Nivel de alerta general (BAJO/MEDIO/ALTO/CRÍTICO)

Responde en español, formato markdown.`;

      // Call AI service
      const aiResult = await aiBridgeService.chat(
        {
          messages: [
            { role: 'system', content: 'Eres un asistente de seguridad operacional experto.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.5,
          maxTokens: 2048,
        },
        tenantId,
        request.userId,
      );

      return {
        success: true,
        data: {
          summary: aiResult.content,
          generatedAt: now.toISOString(),
          stats,
        },
      } satisfies ApiResponse;
    },
  );

  // ══════════════════════════════════════════════════════════════
  // Conversation Persistence CRUD
  // ══════════════════════════════════════════════════════════════

  // ── GET /conversations — List user's conversations ───────────
  app.get(
    '/conversations',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request) => {
      const query = request.query as { limit?: string };
      const limit = Math.min(Math.max(parseInt(query.limit || '20', 10) || 20, 1), 100);

      const rows = await db.execute(
        sql`SELECT id, user_id, tenant_id, title, messages, tools_used, token_count, created_at, updated_at
            FROM ai_conversations
            WHERE user_id = ${request.userId} AND tenant_id = ${request.tenantId}
            ORDER BY updated_at DESC
            LIMIT ${limit}`,
      );

      return { success: true, data: rows as unknown as Record<string, unknown>[] } satisfies ApiResponse;
    },
  );

  // ── GET /conversations/:id — Get a specific conversation ─────
  app.get(
    '/conversations/:id',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const rows = await db.execute(
        sql`SELECT id, user_id, tenant_id, title, messages, tools_used, token_count, created_at, updated_at
            FROM ai_conversations
            WHERE id = ${id}::uuid AND user_id = ${request.userId} AND tenant_id = ${request.tenantId}`,
      );
      const row = (rows as unknown as Record<string, unknown>[])[0];
      if (!row) {
        return reply.status(404).send({ success: false, error: 'Conversation not found' });
      }

      return { success: true, data: row } satisfies ApiResponse;
    },
  );

  // ── POST /conversations — Create a new conversation ──────────
  app.post(
    '/conversations',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request) => {
      const body = request.body as {
        title?: string;
        messages?: Array<{ role: string; content: string }>;
      };
      const title = body.title || null;
      const messages = JSON.stringify(body.messages || []);

      const rows = await db.execute(
        sql`INSERT INTO ai_conversations (user_id, tenant_id, title, messages)
            VALUES (${request.userId}, ${request.tenantId}, ${title}, ${messages}::jsonb)
            RETURNING id, user_id, tenant_id, title, messages, tools_used, token_count, created_at, updated_at`,
      );

      return { success: true, data: (rows as unknown as Record<string, unknown>[])[0] } satisfies ApiResponse;
    },
  );

  // ── PATCH /conversations/:id — Update (add messages) ─────────
  app.patch(
    '/conversations/:id',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        title?: string;
        messages?: Array<{ role: string; content: string }>;
        tools_used?: string[];
        token_count?: number;
      };

      const messagesJson = body.messages ? JSON.stringify(body.messages) : null;
      const title = body.title ?? null;
      const toolsUsed = body.tools_used ?? null;
      const tokenCount = body.token_count ?? null;

      const rows = await db.execute(
        sql`UPDATE ai_conversations
            SET messages = COALESCE(${messagesJson}::jsonb, messages),
                title = COALESCE(${title}, title),
                tools_used = COALESCE(${toolsUsed}::text[], tools_used),
                token_count = COALESCE(${tokenCount}::int, token_count),
                updated_at = NOW()
            WHERE id = ${id}::uuid AND user_id = ${request.userId} AND tenant_id = ${request.tenantId}
            RETURNING id, user_id, tenant_id, title, messages, tools_used, token_count, created_at, updated_at`,
      );
      const row = (rows as unknown as Record<string, unknown>[])[0];
      if (!row) {
        return reply.status(404).send({ success: false, error: 'Conversation not found' });
      }

      return { success: true, data: row } satisfies ApiResponse;
    },
  );

  // ── DELETE /conversations/:id — Delete a conversation ────────
  app.delete(
    '/conversations/:id',
    { preHandler: [requireRole('super_admin', 'tenant_admin', 'operator')] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const rows = await db.execute(
        sql`DELETE FROM ai_conversations
            WHERE id = ${id}::uuid AND user_id = ${request.userId} AND tenant_id = ${request.tenantId}
            RETURNING id`,
      );
      const row = (rows as unknown as Record<string, unknown>[])[0];
      if (!row) {
        return reply.status(404).send({ success: false, error: 'Conversation not found' });
      }

      return { success: true, data: { deleted: true } } satisfies ApiResponse;
    },
  );
}
