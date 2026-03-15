/**
 * Email Integration Service — Frontend Client
 *
 * Routes all email operations through the backend Email API module,
 * which handles provider selection (Resend / SendGrid / SMTP),
 * templating, logging, and audit.
 *
 * SETUP:
 *   1. Set RESEND_API_KEY (or SENDGRID_API_KEY / SMTP_*) in backend .env
 *   2. Optionally set EMAIL_FROM_ADDRESS and EMAIL_FROM_NAME
 *   3. See docs/EmailIntegration.md for full details
 */

import { emailApi } from '@/services/api';

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string; // base64
    contentType: string;
  }>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

export interface EmailHealthCheck {
  configured: boolean;
  provider: string;
  status: 'connected' | 'error' | 'not_configured';
  message: string;
  latencyMs: number;
}

export class EmailService {
  async testConnection(toEmail?: string): Promise<EmailHealthCheck> {
    try {
      const resp = await emailApi.test(toEmail);
      const d = resp.data;
      return {
        configured: d.success,
        provider: d.healthCheck.provider,
        status: d.healthCheck.ok ? 'connected' : 'error',
        message: d.healthCheck.message,
        latencyMs: d.healthCheck.latencyMs,
      };
    } catch (err) {
      return {
        configured: false,
        provider: 'unknown',
        status: 'error',
        message: err instanceof Error ? err.message : 'Connection test failed',
        latencyMs: 0,
      };
    }
  }

  async healthCheck(): Promise<EmailHealthCheck> {
    try {
      const resp = await emailApi.health();
      const d = resp.data;
      return {
        configured: d.configured,
        provider: d.provider,
        status: d.ok ? 'connected' : (d.configured ? 'error' : 'not_configured'),
        message: d.message,
        latencyMs: d.latencyMs,
      };
    } catch (err) {
      return {
        configured: false,
        provider: 'unknown',
        status: 'error',
        message: err instanceof Error ? err.message : 'Health check failed',
        latencyMs: 0,
      };
    }
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const resp = await emailApi.send({
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
        cc: message.cc,
        bcc: message.bcc,
        attachments: message.attachments,
      });
      return resp.data;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Send failed',
      };
    }
  }

  async sendEventAlert(params: {
    to: string[];
    severity: string;
    eventType: string;
    title: string;
    description: string;
    deviceName?: string;
    siteName?: string;
    timestamp?: string;
    snapshotUrl?: string;
  }): Promise<EmailSendResult> {
    try {
      const resp = await emailApi.sendEventAlert(params);
      return resp.data;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Send event alert failed',
      };
    }
  }

  async sendIncidentReport(params: {
    to: string[];
    incidentId: string;
    title: string;
    status: string;
    priority: string;
    summary: string;
    assignedTo?: string;
    eventsCount?: number;
    createdAt?: string;
  }): Promise<EmailSendResult> {
    try {
      const resp = await emailApi.sendIncidentReport(params);
      return resp.data;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Send incident report failed',
      };
    }
  }

  async sendPeriodicReport(params: {
    to: string[];
    reportName: string;
    period: string;
    totalEvents: number;
    criticalEvents: number;
    activeIncidents: number;
    devicesOnline: number;
    devicesTotal: number;
    topEventTypes?: Array<{ type: string; count: number }>;
  }): Promise<EmailSendResult> {
    try {
      const resp = await emailApi.sendPeriodicReport(params);
      return resp.data;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Send periodic report failed',
      };
    }
  }

  async sendEvidencePackage(params: {
    to: string[];
    eventId: string;
    eventType: string;
    title: string;
    description: string;
    deviceName: string;
    siteName: string;
    timestamp?: string;
    recipientName?: string;
    exportedBy: string;
    attachments?: Array<{ filename: string; content: string; contentType: string }>;
  }): Promise<EmailSendResult> {
    try {
      const resp = await emailApi.sendEvidencePackage(params);
      return resp.data;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Send evidence package failed',
      };
    }
  }

  async getLogs(limit?: number) {
    try {
      const resp = await emailApi.logs(limit);
      return resp.data;
    } catch {
      return [];
    }
  }
}

// Singleton instance
export const emailService = new EmailService();
