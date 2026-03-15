import { createLogger } from '@aion/common-utils';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { pushSubscriptions } from '../../db/schema/index.js';

const logger = createLogger({ name: 'push-service' });

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

class PushService {
  private webPush: any = null;
  private initialized = false;

  private async getWebPush() {
    if (this.initialized) return this.webPush;
    this.initialized = true;

    try {
      this.webPush = await (import('web-push' as string) as Promise<any>);

      const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
      const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@aionvisionhub.com';

      if (vapidPublicKey && vapidPrivateKey) {
        this.webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
        logger.info('web-push VAPID details configured');
      } else {
        logger.warn('VAPID keys not configured — push notifications will not be sent');
        this.webPush = null;
      }
    } catch {
      logger.warn('web-push package not available — push notifications disabled');
      this.webPush = null;
    }

    return this.webPush;
  }

  // ── Subscribe ─────────────────────────────────────────────

  async subscribe(
    tenantId: string,
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string,
  ) {
    // Upsert: deactivate existing subscription with same endpoint, then insert
    await db
      .update(pushSubscriptions)
      .set({ isActive: false })
      .where(
        and(
          eq(pushSubscriptions.tenantId, tenantId),
          sql`${pushSubscriptions.subscription}->>'endpoint' = ${subscription.endpoint}`,
        ),
      );

    const [result] = await db
      .insert(pushSubscriptions)
      .values({
        tenantId,
        userId,
        subscription,
        userAgent: userAgent ?? null,
        isActive: true,
      })
      .returning();

    logger.info({ tenantId, userId, endpoint: subscription.endpoint }, 'Push subscription created');
    return result;
  }

  // ── Unsubscribe ───────────────────────────────────────────

  async unsubscribe(tenantId: string, userId: string, endpoint: string) {
    const [result] = await db
      .update(pushSubscriptions)
      .set({ isActive: false })
      .where(
        and(
          eq(pushSubscriptions.tenantId, tenantId),
          eq(pushSubscriptions.userId, userId),
          sql`${pushSubscriptions.subscription}->>'endpoint' = ${endpoint}`,
        ),
      )
      .returning();

    logger.info({ tenantId, userId, endpoint }, 'Push subscription deactivated');
    return result;
  }

  // ── Get Subscriptions ─────────────────────────────────────

  async getSubscriptions(tenantId: string, userId?: string) {
    const conditions = [
      eq(pushSubscriptions.tenantId, tenantId),
      eq(pushSubscriptions.isActive, true),
    ];

    if (userId) {
      conditions.push(eq(pushSubscriptions.userId, userId));
    }

    return db
      .select()
      .from(pushSubscriptions)
      .where(and(...conditions))
      .orderBy(desc(pushSubscriptions.createdAt));
  }

  // ── Send to User ──────────────────────────────────────────

  async sendToUser(tenantId: string, userId: string, payload: PushPayload) {
    const wp = await this.getWebPush();
    if (!wp) {
      logger.warn({ tenantId, userId }, 'web-push not available, skipping push notification');
      return { sent: 0, failed: 0 };
    }

    const subscriptions = await this.getSubscriptions(tenantId, userId);

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: {
        url: payload.url,
      },
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        await wp.sendNotification(
          sub.subscription as { endpoint: string; keys: { p256dh: string; auth: string } },
          notificationPayload,
        );
        sent++;

        // Update lastUsedAt
        await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptions.id, sub.id));
      } catch (error) {
        failed++;
        logger.error({ error, subscriptionId: sub.id }, 'Failed to send push notification');

        // If subscription is gone (410), deactivate it
        if (error && typeof error === 'object' && 'statusCode' in error && (error as { statusCode: number }).statusCode === 410) {
          await db
            .update(pushSubscriptions)
            .set({ isActive: false })
            .where(eq(pushSubscriptions.id, sub.id));
          logger.info({ subscriptionId: sub.id }, 'Deactivated expired push subscription');
        }
      }
    }

    logger.info({ tenantId, userId, sent, failed }, 'Push notifications sent to user');
    return { sent, failed };
  }

  // ── Send to Tenant ────────────────────────────────────────

  async sendToTenant(tenantId: string, payload: PushPayload) {
    const wp = await this.getWebPush();
    if (!wp) {
      logger.warn({ tenantId }, 'web-push not available, skipping push notification');
      return { sent: 0, failed: 0 };
    }

    const subscriptions = await this.getSubscriptions(tenantId);

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: {
        url: payload.url,
      },
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        await wp.sendNotification(
          sub.subscription as { endpoint: string; keys: { p256dh: string; auth: string } },
          notificationPayload,
        );
        sent++;

        await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptions.id, sub.id));
      } catch (error) {
        failed++;
        logger.error({ error, subscriptionId: sub.id }, 'Failed to send push notification');

        if (error && typeof error === 'object' && 'statusCode' in error && (error as { statusCode: number }).statusCode === 410) {
          await db
            .update(pushSubscriptions)
            .set({ isActive: false })
            .where(eq(pushSubscriptions.id, sub.id));
          logger.info({ subscriptionId: sub.id }, 'Deactivated expired push subscription');
        }
      }
    }

    logger.info({ tenantId, sent, failed }, 'Push notifications sent to tenant');
    return { sent, failed };
  }

  // ── Cleanup Stale ─────────────────────────────────────────

  async cleanupStale(tenantId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.tenantId, tenantId),
          sql`${pushSubscriptions.lastUsedAt} IS NULL`,
          sql`${pushSubscriptions.createdAt} < ${thirtyDaysAgo}`,
        ),
      )
      .returning();

    logger.info({ tenantId, removed: result.length }, 'Cleaned up stale push subscriptions');
    return { removed: result.length };
  }
}

export const pushService = new PushService();
