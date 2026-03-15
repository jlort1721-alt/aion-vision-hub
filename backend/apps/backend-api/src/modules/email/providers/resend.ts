import type {
  EmailProvider,
  SendEmailParams,
  SendEmailResult,
  ProviderHealthResult,
} from './base.js';

const RESEND_API = 'https://api.resend.com';

export class ResendProvider implements EmailProvider {
  readonly name = 'resend';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const body: Record<string, unknown> = {
      from: params.from.name
        ? `${params.from.name} <${params.from.email}>`
        : params.from.email,
      to: params.to.map((t) => (t.name ? `${t.name} <${t.email}>` : t.email)),
      subject: params.subject,
    };

    if (params.html) body.html = params.html;
    if (params.text) body.text = params.text;
    if (params.replyTo) body.reply_to = params.replyTo.email;
    if (params.cc?.length) body.cc = params.cc.map((c) => c.email);
    if (params.bcc?.length) body.bcc = params.bcc.map((b) => b.email);
    if (params.tags?.length) body.tags = params.tags;

    if (params.attachments?.length) {
      body.attachments = params.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        content_type: a.contentType,
      }));
    }

    const resp = await fetch(`${RESEND_API}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        success: false,
        error: (err.message as string) || `Resend HTTP ${resp.status}`,
      };
    }

    const data = (await resp.json()) as { id: string };
    return { success: true, messageId: data.id };
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    const start = Date.now();
    try {
      const resp = await fetch(`${RESEND_API}/domains`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      const latencyMs = Date.now() - start;

      if (resp.ok) {
        return { ok: true, provider: this.name, latencyMs, message: 'Resend API reachable' };
      }

      const err = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
      return {
        ok: false,
        provider: this.name,
        latencyMs,
        message: (err.message as string) || `HTTP ${resp.status}`,
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.name,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }
}
