import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { createLogger } from '@aion/common-utils';
import { fetchWithTimeout } from '../../lib/http-client.js';

const logger = createLogger({ name: 'clave-bridge' });

// CLAVE API base URL (same VPS, internal) — SECURITY: validated against allowlist
const CLAVE_API = process.env.CLAVE_API_URL || 'http://localhost:8002/api/v1';
const ALLOWED_CLAVE_HOSTS = ['localhost', '127.0.0.1', '::1'];

function validateClaveUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_CLAVE_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

import { z } from 'zod';

const VoiceCommandSchema = z.object({
  text: z.string().min(1).max(2000),
  operator_id: z.string().min(1).max(100),
  context: z.record(z.string(), z.unknown()).optional(),
});

const PushEventSchema = z.object({
  type: z.string().min(1).max(100),
  data: z.record(z.string(), z.unknown()).optional(),
  source: z.string().max(100).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
}).passthrough();

const AnnounceSchema = z.object({
  message: z.string().min(1).max(1000),
  operator_id: z.string().max(100).optional(),
});

export async function registerClaveBridgeRoutes(app: FastifyInstance) {
  // Receive voice commands from CLAVE
  app.post('/voice-command', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { text, operator_id, context: _context } = VoiceCommandSchema.parse(request.body);
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

  // Push event to CLAVE — SECURITY: restricted to admin + SSRF validated
  app.post('/push-event', { preHandler: [requireRole('tenant_admin', 'super_admin')] }, async (request, reply) => {
    const event = PushEventSchema.parse(request.body);

    // SECURITY: Validate CLAVE_API URL is internal only (SSRF protection)
    if (!validateClaveUrl(CLAVE_API)) {
      logger.error({ url: CLAVE_API }, 'SSRF blocked: CLAVE_API_URL points to non-local host');
      return reply.code(500).send({ success: false, error: 'Invalid CLAVE API configuration' });
    }

    try {
      const resp = await fetchWithTimeout(`${CLAVE_API}/events/push`, {
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
  app.get('/status', { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] }, async (_request, reply) => {
    try {
      const resp = await fetchWithTimeout(`${CLAVE_API}/health`);
      const data = (await resp.json()) as Record<string, unknown>;
      return reply.send({ success: true, data: { clave: 'connected', ...data } });
    } catch {
      return reply.send({ success: true, data: { clave: 'disconnected' } });
    }
  });

  // Request CLAVE voice announcement
  app.post('/announce', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { message, operator_id } = AnnounceSchema.parse(request.body);
    try {
      const resp = await fetchWithTimeout(`${CLAVE_API}/voice/announce`, {
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
  app.get('/operator/:id/health', { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const resp = await fetchWithTimeout(`${CLAVE_API}/biometrics/iao/${id}`);
      const data = (await resp.json()) as Record<string, unknown>;
      return reply.send({ success: true, data });
    } catch {
      return reply.send({ success: true, data: { iao: null, status: 'unavailable' } });
    }
  });
}
