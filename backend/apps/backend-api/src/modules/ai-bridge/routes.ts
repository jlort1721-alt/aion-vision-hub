import type { FastifyInstance } from 'fastify';
import { eq, and, sql, gte } from 'drizzle-orm';
import { requireRole } from '../../plugins/auth.js';
import { aiBridgeService } from './service.js';
import { chatRequestSchema, chatStreamRequestSchema, usageQuerySchema } from './schemas.js';
import { db } from '../../db/client.js';
import { events, incidents, devices } from '../../db/schema/index.js';
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

  // ── GET /shift-summary — AI-generated shift summary ────────
  app.get(
    '/shift-summary',
    { preHandler: [requireRole('tenant_admin', 'operator')] },
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
}
