import type { FastifyInstance } from 'fastify';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'clave-bridge' });

// CLAVE API base URL (same VPS, internal)
const CLAVE_API = process.env.CLAVE_API_URL || 'http://localhost:8002/api/v1';

export async function registerClaveBridgeRoutes(app: FastifyInstance) {
  // Receive voice commands from CLAVE
  app.post('/voice-command', async (request, reply) => {
    const { text, operator_id, context: _context } = request.body as {
      text: string;
      operator_id: string;
      context?: Record<string, unknown>;
    };
    logger.info({ operator_id, text: text.slice(0, 50) }, 'Voice command from CLAVE');

    // Process through AI bridge
    try {
      const aiModule = await import('../ai-bridge/service.js');
      const result = await aiModule.aiBridgeService.chat(
        { messages: [{ role: 'user', content: text }] },
        request.tenantId || 'default',
        operator_id,
      );
      return reply.send({ success: true, data: result });
    } catch (err) {
      logger.warn({ err }, 'AI bridge unavailable, returning echo');
      return reply.send({ success: true, data: { response: text, tools_used: [] } });
    }
  });

  // Push event to CLAVE (called internally when events happen)
  app.post('/push-event', async (request, reply) => {
    const event = request.body as Record<string, unknown>;
    try {
      const resp = await fetch(`${CLAVE_API}/events/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      return reply.send({ success: true, pushed: resp.ok });
    } catch {
      return reply.send({ success: false, error: 'CLAVE unreachable' });
    }
  });

  // Get CLAVE status
  app.get('/status', async (_request, reply) => {
    try {
      const resp = await fetch(`${CLAVE_API}/health`);
      const data = (await resp.json()) as Record<string, unknown>;
      return reply.send({ success: true, data: { clave: 'connected', ...data } });
    } catch {
      return reply.send({ success: true, data: { clave: 'disconnected' } });
    }
  });

  // Request CLAVE voice announcement
  app.post('/announce', async (request, reply) => {
    const { message, operator_id } = request.body as {
      message: string;
      operator_id?: string;
    };
    try {
      const resp = await fetch(`${CLAVE_API}/voice/announce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, operator_id }),
      });
      return reply.send({ success: true, announced: resp.ok });
    } catch {
      return reply.send({ success: false, error: 'CLAVE voice unavailable' });
    }
  });

  // Get CLAVE operator health (IAO)
  app.get('/operator/:id/health', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const resp = await fetch(`${CLAVE_API}/biometrics/iao/${id}`);
      const data = (await resp.json()) as Record<string, unknown>;
      return reply.send({ success: true, data });
    } catch {
      return reply.send({ success: true, data: { iao: null, status: 'unavailable' } });
    }
  });
}
