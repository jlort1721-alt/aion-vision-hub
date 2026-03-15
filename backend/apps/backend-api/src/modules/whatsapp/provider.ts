/**
 * WhatsApp Provider Abstraction
 *
 * Abstracts the messaging provider so the rest of the system is decoupled
 * from Meta's Cloud API specifics. To swap providers (e.g. on-prem BSP),
 * implement the WhatsAppProvider interface and register it.
 */

// ── Contracts ─────────────────────────────────────────────────

export interface WASendTextParams {
  to: string;
  body: string;
  previewUrl?: boolean;
}

export interface WASendTemplateParams {
  to: string;
  templateName: string;
  languageCode: string;
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: Array<{
    type: 'text' | 'image' | 'document' | 'video';
    text?: string;
    image?: { link: string };
    document?: { link: string; filename?: string };
  }>;
}

export interface WASendMediaParams {
  to: string;
  type: 'image' | 'document' | 'audio' | 'video';
  url: string;
  caption?: string;
  filename?: string;
}

export interface WASendInteractiveParams {
  to: string;
  type: 'button' | 'list';
  header?: { type: 'text'; text: string };
  body: string;
  footer?: string;
  buttons?: Array<{ id: string; title: string }>;
  sections?: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
}

export interface WAMarkReadParams {
  messageId: string;
}

export interface WASendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: string;
}

export interface WAPhoneInfo {
  verifiedName: string;
  qualityRating: string;
  platformType: string;
  phoneNumber: string;
}

export interface WAHealthResult {
  connected: boolean;
  phoneInfo?: WAPhoneInfo;
  latencyMs: number;
  error?: string;
}

export interface WATemplateFromAPI {
  name: string;
  language: string;
  status: string;
  category: string;
  components: unknown[];
  id: string;
}

// ── Provider Interface ────────────────────────────────────────

export interface WhatsAppProvider {
  readonly name: string;

  sendText(params: WASendTextParams): Promise<WASendResult>;
  sendTemplate(params: WASendTemplateParams): Promise<WASendResult>;
  sendMedia(params: WASendMediaParams): Promise<WASendResult>;
  sendInteractive(params: WASendInteractiveParams): Promise<WASendResult>;
  markRead(params: WAMarkReadParams): Promise<void>;
  healthCheck(): Promise<WAHealthResult>;
  fetchTemplates(): Promise<WATemplateFromAPI[]>;
}

// ── Meta Cloud API Provider ───────────────────────────────────

const META_API_BASE = 'https://graph.facebook.com';

export interface CloudAPIConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
  apiVersion?: string;
}

export class MetaCloudAPIProvider implements WhatsAppProvider {
  readonly name = 'meta_cloud_api';
  private cfg: Required<CloudAPIConfig>;

  constructor(config: CloudAPIConfig) {
    this.cfg = {
      ...config,
      apiVersion: config.apiVersion || 'v21.0',
    };
  }

  private get baseUrl() {
    return `${META_API_BASE}/${this.cfg.apiVersion}`;
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.cfg.accessToken}`,
    };
  }

  private async apiCall<T>(url: string, body?: unknown): Promise<T> {
    const opts: RequestInit = {
      headers: this.headers,
      signal: AbortSignal.timeout(30_000),
    };
    if (body) {
      opts.method = 'POST';
      opts.body = JSON.stringify(body);
    }

    const resp = await fetch(url, opts);
    const data = await resp.json() as any;

    if (!resp.ok) {
      const errMsg = data?.error?.message || `HTTP ${resp.status}`;
      const errCode = data?.error?.code || resp.status;
      throw new MetaAPIError(errMsg, errCode, resp.status);
    }

    return data as T;
  }

  async sendText(params: WASendTextParams): Promise<WASendResult> {
    return this.send({
      messaging_product: 'whatsapp',
      to: this.sanitizePhone(params.to),
      type: 'text',
      text: { body: params.body, preview_url: params.previewUrl ?? false },
    });
  }

  async sendTemplate(params: WASendTemplateParams): Promise<WASendResult> {
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: this.sanitizePhone(params.to),
      type: 'template',
      template: {
        name: params.templateName,
        language: { code: params.languageCode },
        ...(params.components?.length && { components: params.components }),
      },
    };
    return this.send(payload);
  }

  async sendMedia(params: WASendMediaParams): Promise<WASendResult> {
    const mediaObj: Record<string, unknown> = { link: params.url };
    if (params.caption) mediaObj.caption = params.caption;
    if (params.filename) mediaObj.filename = params.filename;

    return this.send({
      messaging_product: 'whatsapp',
      to: this.sanitizePhone(params.to),
      type: params.type,
      [params.type]: mediaObj,
    });
  }

  async sendInteractive(params: WASendInteractiveParams): Promise<WASendResult> {
    const action: Record<string, unknown> = {};
    if (params.type === 'button' && params.buttons) {
      action.buttons = params.buttons.map((b) => ({
        type: 'reply',
        reply: { id: b.id, title: b.title },
      }));
    }
    if (params.type === 'list' && params.sections) {
      action.button = 'Options';
      action.sections = params.sections;
    }

    const interactive: Record<string, unknown> = {
      type: params.type,
      body: { text: params.body },
      action,
    };
    if (params.header) interactive.header = params.header;
    if (params.footer) interactive.footer = { text: params.footer };

    return this.send({
      messaging_product: 'whatsapp',
      to: this.sanitizePhone(params.to),
      type: 'interactive',
      interactive,
    });
  }

  async markRead(params: WAMarkReadParams): Promise<void> {
    await this.apiCall(`${this.baseUrl}/${this.cfg.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: params.messageId,
    });
  }

  async healthCheck(): Promise<WAHealthResult> {
    const start = Date.now();
    try {
      const data = await this.apiCall<Record<string, string>>(
        `${this.baseUrl}/${this.cfg.phoneNumberId}?fields=verified_name,quality_rating,platform_type,display_phone_number`,
      );
      return {
        connected: true,
        phoneInfo: {
          verifiedName: data.verified_name || '',
          qualityRating: data.quality_rating || '',
          platformType: data.platform_type || '',
          phoneNumber: data.display_phone_number || '',
        },
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        connected: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Health check failed',
      };
    }
  }

  async fetchTemplates(): Promise<WATemplateFromAPI[]> {
    const data = await this.apiCall<{ data: WATemplateFromAPI[] }>(
      `${this.baseUrl}/${this.cfg.businessAccountId}/message_templates?limit=250`,
    );
    return data.data || [];
  }

  // ── Helpers ───────────────────────────────────────────────

  private async send(payload: Record<string, unknown>): Promise<WASendResult> {
    try {
      const data = await this.apiCall<{ messages?: Array<{ id: string }> }>(
        `${this.baseUrl}/${this.cfg.phoneNumberId}/messages`,
        payload,
      );
      return {
        success: true,
        messageId: data.messages?.[0]?.id,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof MetaAPIError) {
        return {
          success: false,
          error: err.message,
          timestamp: new Date().toISOString(),
        };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private sanitizePhone(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }
}

// ── Meta API Error ────────────────────────────────────────────

export class MetaAPIError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'MetaAPIError';
  }

  get isRateLimit(): boolean {
    return this.httpStatus === 429 || this.code === 80007;
  }

  get isAuthError(): boolean {
    return this.httpStatus === 401 || this.code === 190;
  }
}
