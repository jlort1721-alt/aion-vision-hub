import { describe, it, expect, vi } from 'vitest';

// Mock config
vi.mock('../../../config/env.js', () => ({
  config: { WHATSAPP_APP_SECRET: 'test-secret', NODE_ENV: 'test' },
}));
vi.mock('@aion/common-utils', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn().mockReturnThis(),
  }),
}));
vi.mock('../../../db/client.js', () => ({ db: {} }));
vi.mock('../../../db/schema/index.js', () => ({
  integrations: {}, auditLogs: {}, waConversations: {},
}));
vi.mock('../service.js', () => ({ whatsappService: {} }));
vi.mock('../ai-agent.js', () => ({ whatsappAIAgent: {} }));
vi.mock('../schemas.js', () => ({ webhookPayloadSchema: { safeParse: vi.fn() } }));

import { isPayloadFresh } from '../webhook.js';

function buildPayload(timestamp: number | string): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '123',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: '456' },
              messages: [
                {
                  from: '5491112345678',
                  id: 'wamid.test',
                  timestamp: String(timestamp),
                  type: 'text',
                  text: { body: 'Hello' },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
}

describe('Replay Protection — isPayloadFresh', () => {
  it('accepts payload with timestamp within 5 minutes', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isPayloadFresh(buildPayload(now - 120))).toBe(true); // 2 min ago
  });

  it('accepts payload with timestamp just now', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isPayloadFresh(buildPayload(now))).toBe(true);
  });

  it('rejects payload with timestamp older than 5 minutes', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isPayloadFresh(buildPayload(now - 600))).toBe(false); // 10 min ago
  });

  it('rejects payload with timestamp far in the future', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isPayloadFresh(buildPayload(now + 120))).toBe(false); // 2 min ahead
  });

  it('accepts payload with timestamp slightly in the future (clock skew)', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isPayloadFresh(buildPayload(now + 30))).toBe(true); // 30s ahead (within tolerance)
  });

  it('accepts payload with no messages or statuses (metadata-only)', () => {
    const body = {
      object: 'whatsapp_business_account',
      entry: [
        { id: '123', changes: [{ value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '456' } }, field: 'messages' }] },
      ],
    };
    expect(isPayloadFresh(body)).toBe(true);
  });

  it('accepts payload when timestamp is unparseable', () => {
    expect(isPayloadFresh(buildPayload('not-a-number'))).toBe(true);
  });

  it('handles status updates with timestamps', () => {
    const now = Math.floor(Date.now() / 1000);
    const body = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: '456' },
                statuses: [
                  { id: 'wamid.test', status: 'delivered', timestamp: String(now - 60) },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };
    expect(isPayloadFresh(body)).toBe(true);
  });

  it('rejects status updates with stale timestamps', () => {
    const now = Math.floor(Date.now() / 1000);
    const body = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '123',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: '456' },
                statuses: [
                  { id: 'wamid.test', status: 'delivered', timestamp: String(now - 600) },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };
    expect(isPayloadFresh(body)).toBe(false);
  });
});
