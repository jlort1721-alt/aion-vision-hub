/**
 * PII Sanitization Utilities for WhatsApp Logging
 *
 * Masks phone numbers and message content before writing to logs.
 * Prevents PII leakage in structured log output.
 */

const PHONE_REGEX = /\+?\d{10,15}/g;

/** Mask a phone number, keeping only the last 4 digits visible. */
export function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****';
  return `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}`;
}

/** Sanitize a full webhook payload for safe logging. Masks phone numbers and truncates. */
export function sanitizeWebhookLog(body: unknown): string {
  const str = JSON.stringify(body);
  const masked = str.replace(PHONE_REGEX, (match) => maskPhone(match));
  return masked.slice(0, 500);
}

/** Redact message body content for logs, showing only length. */
export function sanitizeMessageBody(body: string | null | undefined): string {
  if (!body) return '[empty]';
  if (body.length <= 20) return '[message]';
  return `[message: ${body.length} chars]`;
}
