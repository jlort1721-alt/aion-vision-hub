/**
 * Email Provider Abstraction
 *
 * All providers implement this interface. The EmailService selects the active
 * provider based on env configuration and delegates send/healthCheck calls.
 */

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string; // base64-encoded
  contentType: string;
}

export interface SendEmailParams {
  from: EmailAddress;
  to: EmailAddress[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: EmailAddress;
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  attachments?: EmailAttachment[];
  tags?: Array<{ name: string; value: string }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ProviderHealthResult {
  ok: boolean;
  provider: string;
  latencyMs: number;
  message: string;
}

export interface EmailProvider {
  readonly name: string;

  /** Send an email through this provider */
  send(params: SendEmailParams): Promise<SendEmailResult>;

  /** Verify the provider is reachable and credentials are valid */
  healthCheck(): Promise<ProviderHealthResult>;
}
