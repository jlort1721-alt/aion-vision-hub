/**
 * WhatsApp Business API Integration Service
 *
 * Provides messaging capabilities for:
 * - Event/incident alert notifications
 * - Two-way communication with operators
 * - Emergency broadcast messages
 *
 * CREDENTIALS REQUIRED:
 *   VITE_WHATSAPP_PHONE_NUMBER_ID - WhatsApp Business phone number ID
 *   VITE_WHATSAPP_ACCESS_TOKEN    - Meta Business API access token
 *   VITE_WHATSAPP_BUSINESS_ID     - Meta Business account ID
 *
 * SETUP:
 *   1. Create Meta Developer account: https://developers.facebook.com
 *   2. Create WhatsApp Business App
 *   3. Configure webhook URL for incoming messages
 *   4. Get permanent access token (System User token)
 *   5. Register phone number
 *   6. Set environment variables
 *
 * WEBHOOK (for incoming messages):
 *   POST /api/webhooks/whatsapp
 *   Verify token: Set WHATSAPP_VERIFY_TOKEN in Supabase edge function secrets
 */

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessId?: string;
  apiVersion?: string;
}

export interface WhatsAppMessage {
  to: string;           // Phone number with country code (e.g., "+1234567890")
  type: 'text' | 'template' | 'image' | 'document';
  text?: string;
  templateName?: string;
  templateParams?: string[];
  imageUrl?: string;
  documentUrl?: string;
  caption?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp?: string;
}

export interface WhatsAppHealthCheck {
  configured: boolean;
  phoneNumberId: string;
  businessId: string;
  status: 'connected' | 'error' | 'not_configured';
  message: string;
  latencyMs: number;
}

const META_API_BASE = 'https://graph.facebook.com';
const DEFAULT_API_VERSION = 'v21.0';

export class WhatsAppService {
  private phoneNumberId: string;
  private accessToken: string;
  private businessId: string;
  private apiVersion: string;

  constructor(config?: Partial<WhatsAppConfig>) {
    this.phoneNumberId = config?.phoneNumberId || import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID || '';
    this.accessToken = config?.accessToken || import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN || '';
    this.businessId = config?.businessId || import.meta.env.VITE_WHATSAPP_BUSINESS_ID || '';
    this.apiVersion = config?.apiVersion || DEFAULT_API_VERSION;
  }

  isConfigured(): boolean {
    return this.phoneNumberId.length > 0 && this.accessToken.length > 0;
  }

  private get baseUrl(): string {
    return `${META_API_BASE}/${this.apiVersion}`;
  }

  async testConnection(): Promise<WhatsAppHealthCheck> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        phoneNumberId: '',
        businessId: '',
        status: 'not_configured',
        message: 'WhatsApp not configured. Set VITE_WHATSAPP_PHONE_NUMBER_ID and VITE_WHATSAPP_ACCESS_TOKEN.',
        latencyMs: 0,
      };
    }

    const start = Date.now();
    try {
      const resp = await fetch(
        `${this.baseUrl}/${this.phoneNumberId}?fields=verified_name,quality_rating,platform_type`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      const latencyMs = Date.now() - start;

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return {
          configured: true,
          phoneNumberId: this.phoneNumberId,
          businessId: this.businessId,
          status: 'error',
          message: `API error: ${err?.error?.message || resp.statusText}`,
          latencyMs,
        };
      }

      const data = await resp.json();
      return {
        configured: true,
        phoneNumberId: this.phoneNumberId,
        businessId: this.businessId,
        status: 'connected',
        message: `Connected: ${data.verified_name || 'WhatsApp Business'} (Quality: ${data.quality_rating || 'N/A'})`,
        latencyMs,
      };
    } catch (err) {
      return {
        configured: true,
        phoneNumberId: this.phoneNumberId,
        businessId: this.businessId,
        status: 'error',
        message: err instanceof Error ? err.message : 'Connection failed',
        latencyMs: Date.now() - start,
      };
    }
  }

  async sendMessage(message: WhatsAppMessage): Promise<WhatsAppSendResult> {
    if (!this.isConfigured()) {
      return { success: false, error: 'WhatsApp not configured' };
    }

    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: message.to.replace(/[^0-9+]/g, ''),
      type: message.type,
    };

    switch (message.type) {
      case 'text':
        payload.text = { body: message.text };
        break;
      case 'template':
        payload.template = {
          name: message.templateName,
          language: { code: 'en' },
          components: message.templateParams?.length
            ? [{ type: 'body', parameters: message.templateParams.map(p => ({ type: 'text', text: p })) }]
            : undefined,
        };
        break;
      case 'image':
        payload.image = { link: message.imageUrl, caption: message.caption };
        break;
      case 'document':
        payload.document = { link: message.documentUrl, caption: message.caption };
        break;
    }

    try {
      const resp = await fetch(`${this.baseUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();

      if (!resp.ok) {
        return {
          success: false,
          error: data?.error?.message || `Send failed: ${resp.status}`,
        };
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Send failed',
      };
    }
  }

  async sendAlert(params: {
    to: string;
    severity: string;
    title: string;
    description: string;
    siteId?: string;
  }): Promise<WhatsAppSendResult> {
    const severityEmoji: Record<string, string> = {
      critical: '!',
      high: '!',
      medium: '*',
      low: '-',
      info: 'i',
    };

    const text = [
      `[${severityEmoji[params.severity] || '*'}] AION Alert: ${params.title}`,
      `Severity: ${params.severity.toUpperCase()}`,
      params.description,
      params.siteId ? `Site: ${params.siteId}` : '',
      `Time: ${new Date().toLocaleString()}`,
    ].filter(Boolean).join('\n');

    return this.sendMessage({ to: params.to, type: 'text', text });
  }
}

// Singleton instance
export const whatsapp = new WhatsAppService();
