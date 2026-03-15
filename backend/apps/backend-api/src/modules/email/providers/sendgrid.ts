import type {
  EmailProvider,
  SendEmailParams,
  SendEmailResult,
  ProviderHealthResult,
} from './base.js';

const SENDGRID_API = 'https://api.sendgrid.com/v3';

export class SendGridProvider implements EmailProvider {
  readonly name = 'sendgrid';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const personalizations: Record<string, unknown>[] = [
      {
        to: params.to.map((t) => ({ email: t.email, name: t.name })),
        ...(params.cc?.length && { cc: params.cc.map((c) => ({ email: c.email, name: c.name })) }),
        ...(params.bcc?.length && { bcc: params.bcc.map((b) => ({ email: b.email, name: b.name })) }),
      },
    ];

    const content: Array<{ type: string; value: string }> = [];
    if (params.text) content.push({ type: 'text/plain', value: params.text });
    if (params.html) content.push({ type: 'text/html', value: params.html });

    const body: Record<string, unknown> = {
      personalizations,
      from: { email: params.from.email, name: params.from.name },
      subject: params.subject,
      content,
    };

    if (params.replyTo) {
      body.reply_to = { email: params.replyTo.email, name: params.replyTo.name };
    }

    if (params.attachments?.length) {
      body.attachments = params.attachments.map((a) => ({
        content: a.content,
        filename: a.filename,
        type: a.contentType,
        disposition: 'attachment',
      }));
    }

    const resp = await fetch(`${SENDGRID_API}/mail/send`, {
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
      const errors = (err.errors as Array<{ message: string }>) ?? [];
      return {
        success: false,
        error: errors[0]?.message || `SendGrid HTTP ${resp.status}`,
      };
    }

    const messageId = resp.headers.get('x-message-id') || undefined;
    return { success: true, messageId };
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    const start = Date.now();
    try {
      const resp = await fetch(`${SENDGRID_API}/scopes`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      const latencyMs = Date.now() - start;

      if (resp.ok) {
        return { ok: true, provider: this.name, latencyMs, message: 'SendGrid API reachable' };
      }

      return {
        ok: false,
        provider: this.name,
        latencyMs,
        message: `HTTP ${resp.status}`,
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
