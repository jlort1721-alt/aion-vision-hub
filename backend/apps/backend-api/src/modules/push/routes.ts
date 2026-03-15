import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { pushService } from './service.js';
import {
  subscribeSchema,
  unsubscribeSchema,
  sendPushSchema,
} from './schemas.js';
import type {
  SubscribeInput,
  UnsubscribeInput,
  SendPushInput,
} from './schemas.js';

export async function registerPushRoutes(app: FastifyInstance) {
  // ── VAPID Public Key (no auth required) ───────────────────

  app.get(
    '/vapid-public-key',
    { config: { public: true } },
    async (_request, reply) => {
      const key = process.env.VAPID_PUBLIC_KEY || '';
      return reply.send({ success: true, data: { vapidPublicKey: key } });
    },
  );

  // ── Subscribe ─────────────────────────────────────────────

  app.post<{ Body: SubscribeInput }>(
    '/subscribe',
    async (request, reply) => {
      const { subscription } = subscribeSchema.parse(request.body);
      const userAgent = request.headers['user-agent'];
      const data = await pushService.subscribe(
        request.tenantId,
        request.userId,
        subscription,
        userAgent,
      );
      return reply.code(201).send({ success: true, data });
    },
  );

  // ── Unsubscribe ───────────────────────────────────────────

  app.post<{ Body: UnsubscribeInput }>(
    '/unsubscribe',
    async (request, reply) => {
      const { endpoint } = unsubscribeSchema.parse(request.body);
      const data = await pushService.unsubscribe(
        request.tenantId,
        request.userId,
        endpoint,
      );
      return reply.send({ success: true, data });
    },
  );

  // ── List Subscriptions ────────────────────────────────────

  app.get(
    '/subscriptions',
    async (request, reply) => {
      const data = await pushService.getSubscriptions(
        request.tenantId,
        request.userId,
      );
      return reply.send({ success: true, data });
    },
  );

  // ── Send Push Notification (tenant_admin+) ────────────────

  app.post<{ Body: SendPushInput }>(
    '/send',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { title, body, url, userIds } = sendPushSchema.parse(request.body);
      const payload = { title, body, url };

      let result;
      if (userIds && userIds.length > 0) {
        // Send to specific users
        let totalSent = 0;
        let totalFailed = 0;
        for (const uid of userIds) {
          const r = await pushService.sendToUser(request.tenantId, uid, payload);
          totalSent += r.sent;
          totalFailed += r.failed;
        }
        result = { sent: totalSent, failed: totalFailed };
      } else {
        // Send to entire tenant
        result = await pushService.sendToTenant(request.tenantId, payload);
      }

      await request.audit('push.send', 'push_notifications', undefined, {
        title,
        userIds,
        sent: result.sent,
        failed: result.failed,
      });

      return reply.send({ success: true, data: result });
    },
  );
}
