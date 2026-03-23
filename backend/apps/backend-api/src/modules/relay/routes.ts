/**
 * Universal Relay Control Routes
 *
 * Provides a unified API for controlling relays across all supported backends:
 * eWeLink/Sonoff, HTTP relays, Raspberry Pi GPIO, ZKTeco, Hikvision, Dahua.
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { executeRelay, getSupportedBackends } from '../../services/relay-controller.js';
import type { RelayConfig, RelayAction } from '../../services/relay-controller.js';

export async function registerRelayRoutes(app: FastifyInstance) {

  // ── POST /execute — Execute a relay action ──
  app.post<{ Body: { config: RelayConfig; action: RelayAction } }>(
    '/execute',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Relay Control'],
        summary: 'Execute relay action (open/close gate, door, barrier)',
        description: 'Supports eWeLink, HTTP relay, Raspberry Pi GPIO, ZKTeco, Hikvision, Dahua',
      },
    },
    async (request, reply) => {
      const { config, action } = request.body;

      if (!config?.backend) {
        return reply.code(400).send({ success: false, error: 'Backend de relé no especificado' });
      }

      const result = await executeRelay(config, action);

      await request.audit('relay.execute', 'relay', config.backend, {
        action: action.action,
        success: result.success,
        backend: config.backend,
      });

      if (!result.success) {
        return reply.code(502).send({ success: false, error: result.error, data: result });
      }

      return reply.send({ success: true, data: result });
    },
  );

  // ── POST /gate/open — Simplified gate open (pulse) ──
  app.post<{ Body: { config: RelayConfig; durationMs?: number } }>(
    '/gate/open',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Relay Control'],
        summary: 'Open gate/door (pulse relay ON for configured duration, then OFF)',
      },
    },
    async (request, reply) => {
      const { config, durationMs } = request.body;

      const result = await executeRelay(config, {
        action: 'pulse',
        durationMs: durationMs || config.pulseDurationMs || 3000,
      });

      await request.audit('relay.gate.open', 'relay', config.backend, {
        durationMs: durationMs || 3000,
        success: result.success,
      });

      return reply.send({ success: result.success, data: result, error: result.error });
    },
  );

  // ── POST /test — Test relay connectivity ──
  app.post<{ Body: { config: RelayConfig } }>(
    '/test',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: {
        tags: ['Relay Control'],
        summary: 'Test relay backend connectivity without activating it',
      },
    },
    async (request, reply) => {
      const { config } = request.body;
      const start = Date.now();

      try {
        switch (config.backend) {
          case 'ewelink':
            if (!config.ewelinkDeviceId) return reply.send({ success: false, reachable: false, error: 'ewelinkDeviceId faltante' });
            // Just check eWeLink health
            const eweResp = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/ewelink/health`);
            return reply.send({ success: true, reachable: eweResp.ok, latencyMs: Date.now() - start, backend: 'ewelink' });

          case 'http_relay':
            if (!config.httpUrl) return reply.send({ success: false, reachable: false, error: 'httpUrl faltante' });
            const httpResp = await fetch(config.httpUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) }).catch(() => null);
            return reply.send({ success: true, reachable: !!httpResp?.ok, latencyMs: Date.now() - start, backend: 'http_relay' });

          case 'raspberry_pi': {
            const port = config.piPort || 5000;
            const piResp = await fetch(`http://${config.piHost}:${port}/health`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
            const piData = piResp ? await piResp.json().catch(() => null) : null;
            return reply.send({
              success: true,
              reachable: !!piResp?.ok,
              latencyMs: Date.now() - start,
              backend: 'raspberry_pi',
              gpioAvailable: piData?.gpio_available || false,
              pins: piData?.pins || [],
            });
          }

          case 'zkteco':
            if (!config.zktecoIp) return reply.send({ success: false, reachable: false, error: 'zktecoIp faltante' });
            const zkResp = await fetch(`http://${config.zktecoIp}/`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
            return reply.send({ success: true, reachable: !!zkResp, latencyMs: Date.now() - start, backend: 'zkteco' });

          default:
            return reply.send({ success: false, error: `Backend no soportado: ${config.backend}` });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error';
        return reply.send({ success: false, reachable: false, error: msg, latencyMs: Date.now() - start });
      }
    },
  );

  // ── GET /backends — List supported relay backends ──
  app.get(
    '/backends',
    {
      schema: {
        tags: ['Relay Control'],
        summary: 'List all supported relay control backends',
      },
    },
    async (_request, reply) => {
      return reply.send({ success: true, data: getSupportedBackends() });
    },
  );
}
