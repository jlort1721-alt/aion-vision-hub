import { createLogger } from '@aion/common-utils';
import { config } from '../../config/env.js';
import { db } from '../../db/client.js';
import { auditLogs } from '../../db/schema/index.js';
import type { EmailProvider, SendEmailParams, SendEmailResult, ProviderHealthResult } from './providers/base.js';
import { ResendProvider } from './providers/resend.js';
import { SendGridProvider } from './providers/sendgrid.js';
import { SmtpProvider } from './providers/smtp.js';
import {
  eventAlertTemplate,
  incidentReportTemplate,
  periodicReportTemplate,
  evidencePackageTemplate,
  testEmailTemplate,
} from './templates.js';
import type {
  SendEventAlertInput,
  SendIncidentReportInput,
  SendPeriodicReportInput,
  SendEvidencePackageInput,
} from './schemas.js';

const logger = createLogger({ name: 'email-service' });

export interface EmailSendLog {
  id: string;
  provider: string;
  action: string;
  to: string[];
  subject: string;
  success: boolean;
  messageId?: string;
  error?: string;
  latencyMs: number;
  timestamp: string;
}

class EmailServiceImpl {
  private provider: EmailProvider | null = null;
  private providerName: string = 'none';
  private fromEmail: string;
  private fromName: string;
  private sendLog: EmailSendLog[] = [];
  private readonly MAX_LOG_SIZE = 200;

  constructor() {
    this.fromEmail = config.EMAIL_FROM_ADDRESS || 'noreply@aionvisionhub.com';
    this.fromName = config.EMAIL_FROM_NAME || 'AION Vision Hub';
    this.initProvider();
  }

  private initProvider() {
    if (config.RESEND_API_KEY) {
      this.provider = new ResendProvider(config.RESEND_API_KEY);
      this.providerName = 'resend';
      logger.info('Email provider initialized: Resend');
    } else if (config.SENDGRID_API_KEY) {
      this.provider = new SendGridProvider(config.SENDGRID_API_KEY);
      this.providerName = 'sendgrid';
      logger.info('Email provider initialized: SendGrid');
    } else if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS) {
      this.provider = new SmtpProvider({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT || 587,
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      });
      this.providerName = 'smtp';
      logger.info(`Email provider initialized: SMTP (${config.SMTP_HOST})`);
    } else {
      logger.warn('No email provider configured. Set RESEND_API_KEY, SENDGRID_API_KEY, or SMTP_* vars.');
    }
  }

  get isConfigured(): boolean {
    return this.provider !== null;
  }

  get activeProvider(): string {
    return this.providerName;
  }

  getRecentLogs(limit = 50): EmailSendLog[] {
    return this.sendLog.slice(-limit);
  }

  // ── Core send with logging & audit ──────────────────────
  private async sendWithTracking(
    action: string,
    params: SendEmailParams,
    auditContext?: { tenantId: string; userId: string; userEmail: string },
  ): Promise<SendEmailResult> {
    if (!this.provider) {
      const err = 'Email provider not configured';
      logger.error({ action }, err);
      return { success: false, error: err };
    }

    const start = Date.now();
    const toList = params.to.map((t) => t.email);

    logger.info({ action, to: toList, subject: params.subject, provider: this.providerName }, 'Sending email');

    let result: SendEmailResult;
    try {
      result = await this.provider.send(params);
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected send failure',
      };
    }

    const latencyMs = Date.now() - start;

    // Append to in-memory log
    const logEntry: EmailSendLog = {
      id: crypto.randomUUID(),
      provider: this.providerName,
      action,
      to: toList,
      subject: params.subject,
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      latencyMs,
      timestamp: new Date().toISOString(),
    };
    this.sendLog.push(logEntry);
    if (this.sendLog.length > this.MAX_LOG_SIZE) {
      this.sendLog = this.sendLog.slice(-this.MAX_LOG_SIZE);
    }

    if (result.success) {
      logger.info({ action, messageId: result.messageId, latencyMs }, 'Email sent successfully');
    } else {
      logger.error({ action, error: result.error, latencyMs }, 'Email send failed');
    }

    // Write audit log if context available
    if (auditContext) {
      await db
        .insert(auditLogs)
        .values({
          tenantId: auditContext.tenantId,
          userId: auditContext.userId,
          userEmail: auditContext.userEmail,
          action: `email.${action}`,
          resource: 'email',
          details: {
            provider: this.providerName,
            to: toList,
            subject: params.subject,
            success: result.success,
            messageId: result.messageId,
            error: result.error,
            latencyMs,
          },
        })
        .catch((err) => {
          logger.warn({ err }, 'Failed to write email audit log');
        });
    }

    return result;
  }

  // ── Health Check ────────────────────────────────────────
  async healthCheck(): Promise<ProviderHealthResult> {
    if (!this.provider) {
      return {
        ok: false,
        provider: 'none',
        latencyMs: 0,
        message: 'No email provider configured',
      };
    }

    logger.debug('Running email health check');
    const result = await this.provider.healthCheck();

    if (result.ok) {
      logger.info({ provider: result.provider, latencyMs: result.latencyMs }, 'Email health check passed');
    } else {
      logger.warn({ provider: result.provider, message: result.message }, 'Email health check failed');
    }

    return result;
  }

  // ── Test Connection (send test email) ───────────────────
  async testConnection(
    toEmail?: string,
    auditContext?: { tenantId: string; userId: string; userEmail: string },
  ): Promise<SendEmailResult & { healthCheck: ProviderHealthResult }> {
    const health = await this.healthCheck();

    if (!health.ok) {
      return {
        success: false,
        error: `Provider health check failed: ${health.message}`,
        healthCheck: health,
      };
    }

    const template = testEmailTemplate();
    const target = toEmail || this.fromEmail;

    const result = await this.sendWithTracking(
      'test_connection',
      {
        from: { email: this.fromEmail, name: this.fromName },
        to: [{ email: target }],
        subject: template.subject,
        html: template.html,
        text: template.text,
      },
      auditContext,
    );

    return { ...result, healthCheck: health };
  }

  // ── Send Event Alert ────────────────────────────────────
  async sendEventAlert(
    input: SendEventAlertInput,
    auditContext?: { tenantId: string; userId: string; userEmail: string },
  ): Promise<SendEmailResult> {
    const template = eventAlertTemplate({
      ...input,
      timestamp: input.timestamp || new Date().toISOString(),
    });

    return this.sendWithTracking(
      'event_alert',
      {
        from: { email: this.fromEmail, name: this.fromName },
        to: input.to.map((email) => ({ email })),
        subject: template.subject,
        html: template.html,
        text: template.text,
        tags: [
          { name: 'type', value: 'event_alert' },
          { name: 'severity', value: input.severity },
        ],
      },
      auditContext,
    );
  }

  // ── Send Incident Report ────────────────────────────────
  async sendIncidentReport(
    input: SendIncidentReportInput,
    auditContext?: { tenantId: string; userId: string; userEmail: string },
  ): Promise<SendEmailResult> {
    const template = incidentReportTemplate({
      ...input,
      createdAt: input.createdAt || new Date().toISOString(),
    });

    return this.sendWithTracking(
      'incident_report',
      {
        from: { email: this.fromEmail, name: this.fromName },
        to: input.to.map((email) => ({ email })),
        subject: template.subject,
        html: template.html,
        text: template.text,
        tags: [
          { name: 'type', value: 'incident_report' },
          { name: 'priority', value: input.priority },
        ],
      },
      auditContext,
    );
  }

  // ── Send Periodic Report ────────────────────────────────
  async sendPeriodicReport(
    input: SendPeriodicReportInput,
    auditContext?: { tenantId: string; userId: string; userEmail: string },
  ): Promise<SendEmailResult> {
    const template = periodicReportTemplate({
      ...input,
      generatedAt: new Date().toISOString(),
    });

    return this.sendWithTracking(
      'periodic_report',
      {
        from: { email: this.fromEmail, name: this.fromName },
        to: input.to.map((email) => ({ email })),
        subject: template.subject,
        html: template.html,
        text: template.text,
        tags: [{ name: 'type', value: 'periodic_report' }],
      },
      auditContext,
    );
  }

  // ── Send Evidence Package ──────────────────────────────
  async sendEvidencePackage(
    input: SendEvidencePackageInput,
    auditContext?: { tenantId: string; userId: string; userEmail: string },
  ): Promise<SendEmailResult> {
    const hasSnapshot = !!input.attachments?.some((a) =>
      a.contentType.startsWith('image/'),
    );
    const hasPlaybackClip = !!input.attachments?.some((a) =>
      a.contentType.startsWith('video/'),
    );

    const template = evidencePackageTemplate({
      ...input,
      timestamp: input.timestamp || new Date().toISOString(),
      hasSnapshot,
      hasPlaybackClip,
    });

    return this.sendWithTracking(
      'evidence_package',
      {
        from: { email: this.fromEmail, name: this.fromName },
        to: input.to.map((email) => ({ email })),
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments: input.attachments,
        tags: [
          { name: 'type', value: 'evidence_package' },
          { name: 'event_id', value: input.eventId },
        ],
      },
      auditContext,
    );
  }

  // ── Send Generic Email ─────────────────────────────────
  async sendGeneric(
    params: {
      to: string[];
      subject: string;
      html?: string;
      text?: string;
      replyTo?: string;
      cc?: string[];
      bcc?: string[];
      attachments?: Array<{ filename: string; content: string; contentType: string }>;
    },
    auditContext?: { tenantId: string; userId: string; userEmail: string },
  ): Promise<SendEmailResult> {
    return this.sendWithTracking(
      'generic',
      {
        from: { email: this.fromEmail, name: this.fromName },
        to: params.to.map((email) => ({ email })),
        subject: params.subject,
        html: params.html,
        text: params.text,
        replyTo: params.replyTo ? { email: params.replyTo } : undefined,
        cc: params.cc?.map((email) => ({ email })),
        bcc: params.bcc?.map((email) => ({ email })),
        attachments: params.attachments,
      },
      auditContext,
    );
  }
}

export const emailService = new EmailServiceImpl();
