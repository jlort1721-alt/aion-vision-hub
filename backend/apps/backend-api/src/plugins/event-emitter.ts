/**
 * AION Event Emitter Plugin — Automatically publishes events to the Event Bus
 * when key API actions happen (POST/PATCH/DELETE on monitored routes).
 *
 * This bridges the gap between REST API actions and the Event Bus,
 * allowing the Rules Engine and Orchestrator to react to platform activity.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { eventBus } from '../services/event-bus.js';
import type { EventSeverity } from '../services/event-bus.js';

interface RouteEventMapping {
  method: string;
  pathPrefix: string;
  eventType: string;
  severity: EventSeverity;
  source: string;
}

/** Routes that should emit events when actions are performed */
const EVENT_MAPPINGS: RouteEventMapping[] = [
  // Emergency
  { method: 'POST', pathPrefix: '/emergency/activations', eventType: 'emergency.activated', severity: 'emergency', source: 'emergency' },

  // Visitors
  { method: 'POST', pathPrefix: '/visitors', eventType: 'visitor.registered', severity: 'info', source: 'visitors' },

  // Patrols
  { method: 'POST', pathPrefix: '/patrols/logs', eventType: 'patrol.log.created', severity: 'info', source: 'patrols' },

  // Shifts
  { method: 'POST', pathPrefix: '/shifts', eventType: 'shift.updated', severity: 'info', source: 'shifts' },
  { method: 'PATCH', pathPrefix: '/shifts', eventType: 'shift.updated', severity: 'info', source: 'shifts' },

  // Intercom calls
  { method: 'POST', pathPrefix: '/intercom/sessions/inbound', eventType: 'intercom.call.inbound', severity: 'info', source: 'intercom' },

  // Access control
  { method: 'POST', pathPrefix: '/access-control/logs', eventType: 'access.log.created', severity: 'info', source: 'access-control' },

  // Device reboots
  { method: 'POST', pathPrefix: '/reboots', eventType: 'device.reboot.requested', severity: 'warning', source: 'reboots' },

  // Incidents
  { method: 'POST', pathPrefix: '/incidents', eventType: 'incident.created', severity: 'warning', source: 'incidents' },

  // Alerts
  { method: 'POST', pathPrefix: '/alerts/rules', eventType: 'alert.rule.created', severity: 'info', source: 'alerts' },

  // Automation
  { method: 'POST', pathPrefix: '/automation/rules', eventType: 'automation.rule.created', severity: 'info', source: 'automation' },

  // Contracts
  { method: 'POST', pathPrefix: '/contracts', eventType: 'contract.created', severity: 'info', source: 'contracts' },
];

async function eventEmitterPlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only emit for successful mutations
    const method = request.method;
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return;
    const statusCode = reply.statusCode;
    if (statusCode < 200 || statusCode >= 300) return;

    const url = request.url.split('?')[0]; // strip query params

    for (const mapping of EVENT_MAPPINGS) {
      if (method === mapping.method && url.startsWith(mapping.pathPrefix)) {
        const body = request.body as Record<string, unknown> | undefined;

        eventBus.publish({
          type: mapping.eventType,
          source: mapping.source,
          severity: mapping.severity,
          site_id: (body?.site_id as string) || (request as unknown as { siteId?: string }).siteId,
          data: {
            method,
            path: url,
            body: body ? sanitizeBody(body) : undefined,
            userId: (request as unknown as { userId?: string }).userId,
            tenantId: (request as unknown as { tenantId?: string }).tenantId,
          },
        }).catch(() => {
          // Non-blocking — event emission should never break the API
        });

        break; // only one event per request
      }
    }
  });
}

/** Remove sensitive fields before including in event data */
function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...body };
  const sensitiveKeys = ['password', 'password_hash', 'token', 'secret', 'api_key', 'credentials'];
  for (const key of sensitiveKeys) {
    if (key in sanitized) sanitized[key] = '[REDACTED]';
  }
  return sanitized;
}

export default fp(eventEmitterPlugin, { name: 'event-emitter' });
