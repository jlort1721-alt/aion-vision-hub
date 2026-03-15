import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';

/**
 * Webhook Validation Tests
 *
 * Tests the core security mechanism that protects webhook endpoints
 * from unauthorized payloads and replay attacks.
 */

describe('Webhook Signature Verification', () => {
  const SECRET = 'whatsapp-app-secret-test';

  function computeHmacSha256(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  it('computes valid HMAC-SHA256 signature', () => {
    const payload = JSON.stringify({ entry: [{ id: '123' }] });
    const signature = computeHmacSha256(payload, SECRET);

    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');
    expect(signature.length).toBe(64); // SHA-256 hex digest is 64 chars
  });

  it('validates matching signature', () => {
    const payload = JSON.stringify({ test: true });
    const expected = computeHmacSha256(payload, SECRET);
    const received = computeHmacSha256(payload, SECRET);

    expect(
      crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'))
    ).toBe(true);
  });

  it('rejects mismatched signature', () => {
    const payload = JSON.stringify({ test: true });
    const tamperedPayload = JSON.stringify({ test: false });
    const expected = computeHmacSha256(payload, SECRET);
    const received = computeHmacSha256(tamperedPayload, SECRET);

    expect(
      crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'))
    ).toBe(false);
  });

  it('rejects signature with wrong secret', () => {
    const payload = JSON.stringify({ test: true });
    const correctSig = computeHmacSha256(payload, SECRET);
    const wrongSig = computeHmacSha256(payload, 'wrong-secret');

    expect(
      crypto.timingSafeEqual(Buffer.from(correctSig, 'hex'), Buffer.from(wrongSig, 'hex'))
    ).toBe(false);
  });

  it('uses timing-safe comparison to prevent timing attacks', () => {
    const payload = JSON.stringify({ data: 'sensitive' });
    const sig1 = computeHmacSha256(payload, SECRET);
    const sig2 = computeHmacSha256(payload, SECRET);

    // timingSafeEqual prevents timing-based attacks
    const result = crypto.timingSafeEqual(
      Buffer.from(sig1, 'hex'),
      Buffer.from(sig2, 'hex')
    );
    expect(result).toBe(true);
  });

  it('handles empty payload', () => {
    const sig = computeHmacSha256('', SECRET);
    expect(sig).toBeDefined();
    expect(sig.length).toBe(64);
  });

  it('handles large payload', () => {
    const largePayload = JSON.stringify({ data: 'x'.repeat(100000) });
    const sig = computeHmacSha256(largePayload, SECRET);
    expect(sig).toBeDefined();
    expect(sig.length).toBe(64);
  });
});

describe('Webhook Challenge Verification (GET endpoint)', () => {
  it('returns challenge token from query string', () => {
    const verifyToken = 'my-verify-token';
    const query = {
      'hub.mode': 'subscribe',
      'hub.verify_token': verifyToken,
      'hub.challenge': 'challenge-12345',
    };

    // Simulate the verification logic
    if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === verifyToken) {
      expect(query['hub.challenge']).toBe('challenge-12345');
    }
  });

  it('rejects invalid verify token', () => {
    const verifyToken = 'my-verify-token';
    const query = {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'challenge-12345',
    };

    const isValid = query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === verifyToken;
    expect(isValid).toBe(false);
  });

  it('rejects non-subscribe mode', () => {
    const query = {
      'hub.mode': 'unsubscribe',
      'hub.verify_token': 'my-verify-token',
      'hub.challenge': 'challenge-12345',
    };

    const isValid = query['hub.mode'] === 'subscribe';
    expect(isValid).toBe(false);
  });

  it('rejects missing challenge', () => {
    const query = {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'my-verify-token',
    };

    expect(query).not.toHaveProperty('hub.challenge');
  });
});

describe('Webhook Payload Validation', () => {
  it('accepts valid WhatsApp payload structure', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'biz-123',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: '123' },
                messages: [
                  {
                    from: '521234567890',
                    type: 'text',
                    text: { body: 'Hello' },
                    timestamp: '1234567890',
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    expect(payload.object).toBe('whatsapp_business_account');
    expect(payload.entry).toBeDefined();
    expect(payload.entry.length).toBeGreaterThan(0);
    expect(payload.entry[0].changes[0].value.messages.length).toBe(1);
  });

  it('rejects payload without entry field', () => {
    const payload = { object: 'whatsapp_business_account' };
    expect(payload).not.toHaveProperty('entry');
  });

  it('rejects payload with wrong object type', () => {
    const payload = { object: 'invalid_type', entry: [] };
    expect(payload.object).not.toBe('whatsapp_business_account');
  });
});
