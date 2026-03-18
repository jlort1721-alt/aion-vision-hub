import { createLogger } from '@aion/common-utils';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { pushSubscriptions } from '../../db/schema/index.js';
import { config } from '../../config/env.js';

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

      const vapidPublicKey = config.VAPID_PUBLIC_KEY;
      const vapidPrivateKey = config.VAPID_PRIVATE_KEY;
      const vapidSubject = config.VAPID_SUBJECT;

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
    _userAgent?: string,
  ) {
    // Upsert: remove existing subscription with same endpoint, then insert
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.tenantId, tenantId),
          eq(pushSubscriptions.endpoint, subscription.endpoint),
        ),
      );

    const [result] = await db
      .insert(pushSubscriptions)
      .values({
        tenantId,
        userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      })
      .returning();

    logger.info({ tenantId, userId, endpoint: subscription.endpoint }, 'Push subscription created');
    return result;
  }

  // ── Unsubscribe ───────────────────────────────────────────

  async unsubscribe(tenantId: string, userId: string, endpoint: string) {
    const [result] = await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.tenantId, tenantId),
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint),
        ),
      )
      .returning();

    logger.info({ tenantId, userId, endpoint }, 'Push subscription removed');
    return result;
  }

  // ── Get Subscriptions ─────────────────────────────────────

  async getSubscriptions(tenantId: string, userId?: string) {
    const conditions = [
      eq(pushSubscriptions.tenantId, tenantId),
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
        const pushSub = {
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
        };
        await wp.sendNotification(pushSub, notificationPayload);
        sent++;
      } catch (error) {
        failed++;
        logger.error({ error, subscriptionId: sub.id }, 'Failed to send push notification');

        // If subscription is gone (410), remove it
        if (error && typeof error === 'object' && 'statusCode' in error && (error as { statusCode: number }).statusCode === 410) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
          logger.info({ subscriptionId: sub.id }, 'Removed expired push subscription');
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
        const pushSub = {
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
        };
        await wp.sendNotification(pushSub, notificationPayload);
        sent++;
      } catch (error) {
        failed++;
        logger.error({ error, subscriptionId: sub.id }, 'Failed to send push notification');

        if (error && typeof error === 'object' && 'statusCode' in error && (error as { statusCode: number }).statusCode === 410) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
          logger.info({ subscriptionId: sub.id }, 'Removed expired push subscription');
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
          sql`${pushSubscriptions.createdAt} < ${thirtyDaysAgo}`,
        ),
      )
      .returning();

    logger.info({ tenantId, removed: result.length }, 'Cleaned up stale push subscriptions');
    return { removed: result.length };
  }
}

export const pushService = new PushService();
