/**
 * WhatsApp Twilio Service
 *
 * Alternative WhatsApp provider using Twilio's API.
 * Sends freeform and template messages via the Twilio REST API.
 * Ready to use once TWILIO_ACCOUNT_SID and TWILIO_WHATSAPP_FROM are configured.
 */

import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'whatsapp-twilio' });

export class WhatsAppTwilioService {
  private accountSid: string;
  private authToken: string;
  private apiKeySid: string;
  private apiKeySecret: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.apiKeySid = process.env.TWILIO_API_KEY_SID || '';
    this.apiKeySecret = process.env.TWILIO_API_KEY_SECRET || '';
    this.fromNumber = process.env.TWILIO_WHATSAPP_FROM || '';
  }

  /** Check if the minimum required config (Account SID + From number) is present. */
  isConfigured(): boolean {
    return !!this.accountSid && !!this.fromNumber;
  }

  /** Return the credential pair to use for Basic auth (prefers API Key over auth token). */
  private getAuthCredentials(): { username: string; password: string } {
    if (this.apiKeySid && this.apiKeySecret) {
      return { username: this.apiKeySid, password: this.apiKeySecret };
    }
    return { username: this.accountSid, password: this.authToken };
  }

  /**
   * Send a freeform WhatsApp message to a phone number.
   * @param to  Phone number in E.164 format (e.g. +573001234567)
   * @param body  Message body text
   */
  async sendMessage(to: string, body: string): Promise<boolean> {
    if (!this.isConfigured()) {
      logger.warn('WhatsApp Twilio not configured — set TWILIO_ACCOUNT_SID and TWILIO_WHATSAPP_FROM');
      return false;
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const { username, password } = this.getAuthCredentials();
      const auth = Buffer.from(`${username}:${password}`).toString('base64');

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: `whatsapp:${this.fromNumber}`,
          To: `whatsapp:${to}`,
          Body: body,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      const data = (await resp.json()) as Record<string, unknown>;
      if (data.sid) {
        logger.info({ to, sid: data.sid }, 'WhatsApp message sent via Twilio');
        return true;
      }
      logger.error({ error: data.message }, 'WhatsApp Twilio send failed');
      return false;
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'WhatsApp Twilio service error');
      return false;
    }
  }

  /**
   * Send a WhatsApp template message via Twilio ContentSid.
   * @param to           Phone number in E.164 format
   * @param templateSid  Twilio Content SID (e.g. HXXXXXXXXXXX)
   * @param variables    Optional template variables
   */
  async sendTemplate(
    to: string,
    templateSid: string,
    variables?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      logger.warn('WhatsApp Twilio not configured — cannot send template');
      return false;
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const { username, password } = this.getAuthCredentials();
      const auth = Buffer.from(`${username}:${password}`).toString('base64');

      const params: Record<string, string> = {
        From: `whatsapp:${this.fromNumber}`,
        To: `whatsapp:${to}`,
        ContentSid: templateSid,
      };
      if (variables) params.ContentVariables = JSON.stringify(variables);

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
        signal: AbortSignal.timeout(15_000),
      });

      const data = (await resp.json()) as Record<string, unknown>;
      if (data.sid) {
        logger.info({ to, sid: data.sid, templateSid }, 'WhatsApp template sent via Twilio');
        return true;
      }
      logger.error({ error: data.message, templateSid }, 'WhatsApp Twilio template send failed');
      return false;
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'WhatsApp Twilio template service error');
      return false;
    }
  }

  /**
   * Health check: verify that Twilio credentials are valid by fetching the account info.
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'not_configured' | 'unhealthy';
    latencyMs: number;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return { status: 'not_configured', latencyMs: 0, error: 'Missing TWILIO_ACCOUNT_SID or TWILIO_WHATSAPP_FROM' };
    }

    const start = Date.now();
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}.json`;
      const { username, password } = this.getAuthCredentials();
      const auth = Buffer.from(`${username}:${password}`).toString('base64');

      const resp = await fetch(url, {
        headers: { 'Authorization': `Basic ${auth}` },
        signal: AbortSignal.timeout(10_000),
      });

      const latencyMs = Date.now() - start;
      if (resp.ok) {
        return { status: 'healthy', latencyMs };
      }
      return { status: 'unhealthy', latencyMs, error: `HTTP ${resp.status}` };
    } catch (err) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: (err as Error).message,
      };
    }
  }
}

/** Singleton instance */
export const whatsappTwilio = new WhatsAppTwilioService();
