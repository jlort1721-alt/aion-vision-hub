import type {
  EmailProvider,
  SendEmailParams,
  SendEmailResult,
  ProviderHealthResult,
} from './base.js';

/**
 * SMTP Provider — fallback for self-hosted SMTP relays.
 *
 * Uses the Supabase edge function `event-alerts` as a relay since
 * Node's built-in net/tls APIs aren't available in edge runtimes.
 * For direct SMTP, install nodemailer and swap the send() body.
 */
export class SmtpProvider implements EmailProvider {
  readonly name = 'smtp';

  private host: string;
  private port: number;
  private user: string;
  private pass: string;

  constructor(params: { host: string; port: number; user: string; pass: string }) {
    this.host = params.host;
    this.port = params.port;
    this.user = params.user;
    this.pass = params.pass;
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    // In production, use nodemailer here.
    // This stub returns an error prompting the admin to use Resend/SendGrid.
    try {
      // Attempt to import nodemailer dynamically
      // @ts-expect-error nodemailer is an optional dependency
      const nodemailer = await import('nodemailer').catch(() => null);

      if (!nodemailer) {
        return {
          success: false,
          error: 'SMTP provider requires nodemailer. Install it with: pnpm add nodemailer @types/nodemailer',
        };
      }

      const transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.port === 465,
        auth: { user: this.user, pass: this.pass },
      });

      const info = await transporter.sendMail({
        from: params.from.name
          ? `${params.from.name} <${params.from.email}>`
          : params.from.email,
        to: params.to.map((t) => t.email).join(', '),
        subject: params.subject,
        html: params.html,
        text: params.text,
        cc: params.cc?.map((c) => c.email).join(', '),
        bcc: params.bcc?.map((b) => b.email).join(', '),
        replyTo: params.replyTo?.email,
        attachments: params.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content, 'base64'),
          contentType: a.contentType,
        })),
      });

      return { success: true, messageId: info.messageId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMTP send failed',
      };
    }
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    const start = Date.now();
    try {
      // @ts-ignore nodemailer is an optional dependency
      const nodemailer = await import('nodemailer').catch(() => null);

      if (!nodemailer) {
        return {
          ok: false,
          provider: this.name,
          latencyMs: Date.now() - start,
          message: 'nodemailer not installed',
        };
      }

      const transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.port === 465,
        auth: { user: this.user, pass: this.pass },
      });

      await transporter.verify();

      return {
        ok: true,
        provider: this.name,
        latencyMs: Date.now() - start,
        message: `SMTP connected to ${this.host}:${this.port}`,
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.name,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'SMTP health check failed',
      };
    }
  }
}
