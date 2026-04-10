import { config } from '../config/env.js';
import pino from 'pino';

const logger = pino({ name: 'n8n-webhook-client' });

type N8nEventType = 'camera_offline' | 'detection' | 'door_forced' | 'alarm' | 'shift_change';

interface N8nWebhookPayload {
  type: N8nEventType;
  timestamp: string;
  tenantId: string;
  data: Record<string, unknown>;
}

class N8nWebhookClient {
  private maxRetries = 3;

  async notify(tenantId: string, eventType: N8nEventType, data: Record<string, unknown>): Promise<boolean> {
    const webhookUrl = config.N8N_WEBHOOK_URL;
    if (!webhookUrl) return false;

    const payload: N8nWebhookPayload = {
      type: eventType,
      timestamp: new Date().toISOString(),
      tenantId,
      data,
    };

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.N8N_WEBHOOK_SECRET ? { 'x-webhook-secret': config.N8N_WEBHOOK_SECRET } : {}),
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          logger.info({ eventType, tenantId }, 'n8n webhook sent');
          return true;
        }

        logger.warn({ eventType, status: response.status, attempt }, 'n8n webhook non-OK response');
      } catch (err) {
        logger.error({ err, eventType, attempt }, 'n8n webhook request failed');
      }

      if (attempt < this.maxRetries - 1) {
        const delay = Math.pow(4, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    logger.error({ eventType, tenantId }, 'n8n webhook failed after all retries');
    return false;
  }

  async checkHealth(): Promise<{ connected: boolean; url: string | undefined }> {
    const url = config.N8N_WEBHOOK_URL;
    if (!url) return { connected: false, url: undefined };

    try {
      const baseUrl = new URL(url).origin;
      const response = await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(5000) });
      return { connected: response.ok, url: baseUrl };
    } catch {
      return { connected: false, url };
    }
  }
}

export const n8nWebhookClient = new N8nWebhookClient();
