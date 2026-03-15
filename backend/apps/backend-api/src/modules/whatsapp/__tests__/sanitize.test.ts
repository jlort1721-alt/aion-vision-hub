import { describe, it, expect } from 'vitest';
import { maskPhone, sanitizeWebhookLog, sanitizeMessageBody } from '../sanitize.js';

describe('maskPhone', () => {
  it('masks all but last 4 digits of a phone number', () => {
    expect(maskPhone('+5491112345678')).toBe('**********5678');
  });

  it('masks short phone numbers', () => {
    expect(maskPhone('1234')).toBe('****');
  });

  it('masks very short numbers', () => {
    expect(maskPhone('12')).toBe('****');
  });

  it('handles a 10-digit number', () => {
    expect(maskPhone('1234567890')).toBe('******7890');
  });
});

describe('sanitizeWebhookLog', () => {
  it('masks phone numbers in JSON output', () => {
    const result = sanitizeWebhookLog({ from: '+5491112345678', body: 'Hello' });
    expect(result).not.toContain('5491112345678');
    expect(result).toContain('5678');
  });

  it('truncates output to 500 chars max', () => {
    const longBody = { body: 'x'.repeat(1000) };
    expect(sanitizeWebhookLog(longBody).length).toBeLessThanOrEqual(500);
  });

  it('handles nested phone numbers', () => {
    const payload = {
      entry: [{ changes: [{ value: { messages: [{ from: '15551234567' }] } }] }],
    };
    const result = sanitizeWebhookLog(payload);
    expect(result).not.toContain('15551234567');
  });
});

describe('sanitizeMessageBody', () => {
  it('returns [empty] for null', () => {
    expect(sanitizeMessageBody(null)).toBe('[empty]');
  });

  it('returns [empty] for undefined', () => {
    expect(sanitizeMessageBody(undefined)).toBe('[empty]');
  });

  it('returns [message] for short strings', () => {
    expect(sanitizeMessageBody('Hello')).toBe('[message]');
  });

  it('returns length description for long strings', () => {
    const body = 'Hello, I need help with my account please';
    expect(sanitizeMessageBody(body)).toBe(`[message: ${body.length} chars]`);
  });
});
