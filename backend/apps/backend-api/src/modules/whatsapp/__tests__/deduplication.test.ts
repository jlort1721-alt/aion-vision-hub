import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DB mock setup ──────────────────────────────────────────────
const mockSelectReturn = vi.fn();
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();

vi.mock('../../../db/client.js', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          limit: mockSelectReturn,
          orderBy: vi.fn().mockImplementation(() => ({
            limit: mockSelectReturn,
          })),
        })),
      })),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: mockInsertValues,
    })),
    update: vi.fn().mockImplementation(() => ({
      set: mockUpdateSet.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    })),
  },
}));

vi.mock('../../../db/schema/index.js', () => ({
  integrations: {},
  profiles: { id: 'id', tenantId: 'tenant_id', isActive: 'is_active' },
  waConversations: { id: 'id', tenantId: 'tenant_id', waContactPhone: 'wa_contact_phone' },
  waMessages: { id: 'id', tenantId: 'tenant_id', waMessageId: 'wa_message_id', deliveryStatus: 'delivery_status' },
  waTemplates: { tenantId: 'tenant_id', name: 'name', language: 'language', status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ op: 'eq', a, b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ op: 'and', args })),
  desc: vi.fn(),
  lt: vi.fn(),
}));

vi.mock('@aion/common-utils', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn().mockReturnThis(),
  }),
}));

vi.mock('../../../config/env.js', () => ({
  config: { NODE_ENV: 'test' },
}));

vi.mock('../provider.js', () => ({
  MetaCloudAPIProvider: vi.fn().mockImplementation(() => ({
    markRead: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { WhatsAppService } from '../service.js';

describe('Message Deduplication', () => {
  let service: WhatsAppService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WhatsAppService();
  });

  it('skips processing when waMessageId already exists in DB', async () => {
    // First select: deduplication check returns existing message
    mockSelectReturn.mockResolvedValueOnce([{ id: 'existing-msg-id' }]);

    await service.processInboundMessage('tenant-1', {
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: '456' },
                messages: [
                  { from: '5491112345678', id: 'wamid.duplicate', timestamp: '1234567890', type: 'text', text: { body: 'Hello' } },
                ],
                contacts: [{ profile: { name: 'Test' }, wa_id: '5491112345678' }],
              },
            },
          ],
        },
      ],
    });

    // db.insert should NOT have been called (message deduplicated)
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it('processes message when waMessageId is new', async () => {
    // Deduplication check: no existing message
    mockSelectReturn.mockResolvedValueOnce([]);
    // findOrCreateConversation: existing conversation
    mockSelectReturn.mockResolvedValueOnce([{ id: 'conv-1', status: 'ai_bot' }]);
    // getConfig for getProvider
    mockSelectReturn.mockResolvedValueOnce([{
      id: 'int-1', tenantId: 'tenant-1', type: 'whatsapp',
      config: { phoneNumberId: '456', accessToken: 'token', businessAccountId: 'biz-1', verifyToken: 'vt', apiVersion: 'v21.0' },
    }]);
    // insert succeeds
    mockInsertValues.mockResolvedValueOnce(undefined);

    await service.processInboundMessage('tenant-1', {
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: '456' },
                messages: [
                  { from: '5491112345678', id: 'wamid.new123', timestamp: '1234567890', type: 'text', text: { body: 'Hello' } },
                ],
                contacts: [{ profile: { name: 'Test' }, wa_id: '5491112345678' }],
              },
            },
          ],
        },
      ],
    });

    expect(mockInsertValues).toHaveBeenCalled();
  });

  it('handles concurrent duplicate gracefully via unique constraint (code 23505)', async () => {
    // Deduplication check: no existing message (race condition)
    mockSelectReturn.mockResolvedValueOnce([]);
    // findOrCreateConversation
    mockSelectReturn.mockResolvedValueOnce([{ id: 'conv-1', status: 'ai_bot' }]);
    // getConfig for getProvider
    mockSelectReturn.mockResolvedValueOnce([{
      id: 'int-1', tenantId: 'tenant-1', type: 'whatsapp',
      config: { phoneNumberId: '456', accessToken: 'token', businessAccountId: 'biz-1', verifyToken: 'vt', apiVersion: 'v21.0' },
    }]);
    // Insert throws unique violation
    const uniqueError = new Error('duplicate key value violates unique constraint');
    (uniqueError as any).code = '23505';
    mockInsertValues.mockRejectedValueOnce(uniqueError);

    // Should NOT throw
    await expect(
      service.processInboundMessage('tenant-1', {
        entry: [
          {
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { phone_number_id: '456' },
                  messages: [
                    { from: '5491112345678', id: 'wamid.race', timestamp: '1234567890', type: 'text', text: { body: 'Hello' } },
                  ],
                  contacts: [],
                },
              },
            ],
          },
        ],
      }),
    ).resolves.not.toThrow();
  });
});

describe('Status Progression Guard', () => {
  let service: WhatsAppService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WhatsAppService();
  });

  it('skips status update when status has not progressed (delivered → sent)', async () => {
    // Existing message with deliveryStatus = 'delivered'
    mockSelectReturn.mockResolvedValueOnce([{ id: 'msg-1', deliveryStatus: 'delivered' }]);

    await service.processInboundMessage('tenant-1', {
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: '456' },
                statuses: [
                  { id: 'wamid.test', status: 'sent', timestamp: '1234567890' },
                ],
              },
            },
          ],
        },
      ],
    });

    // db.update should NOT have been called
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('applies status update when status progresses (sent → delivered)', async () => {
    // Existing message with deliveryStatus = 'sent'
    mockSelectReturn.mockResolvedValueOnce([{ id: 'msg-1', deliveryStatus: 'sent' }]);

    await service.processInboundMessage('tenant-1', {
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: '456' },
                statuses: [
                  { id: 'wamid.test', status: 'delivered', timestamp: '1234567890' },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(mockUpdateSet).toHaveBeenCalled();
  });

  it('always applies failed status even if current status is higher', async () => {
    // Existing message with deliveryStatus = 'read'
    mockSelectReturn.mockResolvedValueOnce([{ id: 'msg-1', deliveryStatus: 'read' }]);

    await service.processInboundMessage('tenant-1', {
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { phone_number_id: '456' },
                statuses: [
                  { id: 'wamid.test', status: 'failed', timestamp: '1234567890', errors: [{ code: 131047, title: 'Rate limit hit' }] },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(mockUpdateSet).toHaveBeenCalled();
  });
});
