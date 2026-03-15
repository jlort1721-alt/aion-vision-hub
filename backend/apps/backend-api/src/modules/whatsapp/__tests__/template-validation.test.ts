import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── DB mock setup ──────────────────────────────────────────────
const mockSelectReturn = vi.fn();
const mockInsertValues = vi.fn();

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
      values: mockInsertValues.mockResolvedValue(undefined),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    })),
  },
}));

vi.mock('../../../db/schema/index.js', () => ({
  integrations: {},
  profiles: { id: 'id', tenantId: 'tenant_id', isActive: 'is_active' },
  waConversations: { id: 'id', tenantId: 'tenant_id', waContactPhone: 'wa_contact_phone' },
  waMessages: { id: 'id', tenantId: 'tenant_id' },
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

const mockSendTemplate = vi.fn().mockResolvedValue({ success: true, messageId: 'wamid.tpl1', timestamp: new Date().toISOString() });

vi.mock('../provider.js', () => ({
  MetaCloudAPIProvider: vi.fn().mockImplementation(() => ({
    sendTemplate: mockSendTemplate,
    sendText: vi.fn(),
    sendMedia: vi.fn(),
    sendInteractive: vi.fn(),
    markRead: vi.fn(),
    healthCheck: vi.fn(),
    fetchTemplates: vi.fn(),
  })),
}));

import { WhatsAppService } from '../service.js';

describe('Template Status Validation', () => {
  let service: WhatsAppService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WhatsAppService();
  });

  it('allows sending APPROVED templates', async () => {
    // getConfig
    mockSelectReturn.mockResolvedValueOnce([{
      id: 'int-1', tenantId: 'tenant-1', type: 'whatsapp',
      config: { phoneNumberId: '456', accessToken: 'token', businessAccountId: 'biz-1', verifyToken: 'vt', apiVersion: 'v21.0', maxRetries: 0 },
    }]);
    // Template lookup: APPROVED
    mockSelectReturn.mockResolvedValueOnce([{ status: 'APPROVED' }]);
    // getConfig for withRetry
    mockSelectReturn.mockResolvedValueOnce([{
      id: 'int-1', tenantId: 'tenant-1', type: 'whatsapp',
      config: { phoneNumberId: '456', accessToken: 'token', businessAccountId: 'biz-1', verifyToken: 'vt', apiVersion: 'v21.0', maxRetries: 0 },
    }]);
    // findOrCreateConversation
    mockSelectReturn.mockResolvedValueOnce([{ id: 'conv-1', status: 'ai_bot' }]);

    const result = await service.sendMessage('tenant-1', {
      to: '+5491112345678',
      type: 'template',
      templateName: 'welcome_msg',
      templateLanguage: 'en_US',
    });

    expect(result.success).toBe(true);
    expect(mockSendTemplate).toHaveBeenCalled();
  });

  it('rejects PENDING templates with error', async () => {
    // getConfig
    mockSelectReturn.mockResolvedValueOnce([{
      id: 'int-1', tenantId: 'tenant-1', type: 'whatsapp',
      config: { phoneNumberId: '456', accessToken: 'token', businessAccountId: 'biz-1', verifyToken: 'vt', apiVersion: 'v21.0', maxRetries: 0 },
    }]);
    // Template lookup: PENDING
    mockSelectReturn.mockResolvedValueOnce([{ status: 'PENDING' }]);

    await expect(
      service.sendMessage('tenant-1', {
        to: '+5491112345678',
        type: 'template',
        templateName: 'pending_tpl',
        templateLanguage: 'en_US',
      }),
    ).rejects.toThrow('not approved');

    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  it('rejects REJECTED templates with error', async () => {
    // getConfig
    mockSelectReturn.mockResolvedValueOnce([{
      id: 'int-1', tenantId: 'tenant-1', type: 'whatsapp',
      config: { phoneNumberId: '456', accessToken: 'token', businessAccountId: 'biz-1', verifyToken: 'vt', apiVersion: 'v21.0', maxRetries: 0 },
    }]);
    // Template lookup: REJECTED
    mockSelectReturn.mockResolvedValueOnce([{ status: 'REJECTED' }]);

    await expect(
      service.sendMessage('tenant-1', {
        to: '+5491112345678',
        type: 'template',
        templateName: 'rejected_tpl',
        templateLanguage: 'en_US',
      }),
    ).rejects.toThrow('not approved');

    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  it('allows sending when template is not found in local DB', async () => {
    // getConfig
    mockSelectReturn.mockResolvedValueOnce([{
      id: 'int-1', tenantId: 'tenant-1', type: 'whatsapp',
      config: { phoneNumberId: '456', accessToken: 'token', businessAccountId: 'biz-1', verifyToken: 'vt', apiVersion: 'v21.0', maxRetries: 0 },
    }]);
    // Template lookup: not found
    mockSelectReturn.mockResolvedValueOnce([]);
    // getConfig for withRetry
    mockSelectReturn.mockResolvedValueOnce([{
      id: 'int-1', tenantId: 'tenant-1', type: 'whatsapp',
      config: { phoneNumberId: '456', accessToken: 'token', businessAccountId: 'biz-1', verifyToken: 'vt', apiVersion: 'v21.0', maxRetries: 0 },
    }]);
    // findOrCreateConversation
    mockSelectReturn.mockResolvedValueOnce([{ id: 'conv-1', status: 'ai_bot' }]);

    const result = await service.sendMessage('tenant-1', {
      to: '+5491112345678',
      type: 'template',
      templateName: 'unknown_tpl',
      templateLanguage: 'en_US',
    });

    expect(result.success).toBe(true);
    expect(mockSendTemplate).toHaveBeenCalled();
  });
});
