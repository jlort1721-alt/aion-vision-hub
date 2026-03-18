import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock email service ─────────────────────────────────────────
const mockEmailHealthCheck = vi.fn();
vi.mock('../modules/email/service.js', () => ({
  emailService: { healthCheck: (...args: unknown[]) => mockEmailHealthCheck(...args) },
}));

// ─── Mock global fetch ──────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Mock drizzle db ────────────────────────────────────────────
const mockReturning = vi.fn<any>();
const mockLimit = vi.fn<any>(() => Promise.resolve([]));
const mockOrderBy = vi.fn<any>(() => Promise.resolve([]));
const mockWhere = vi.fn<any>(() => ({
  limit: mockLimit,
  orderBy: mockOrderBy,
  returning: mockReturning,
}));
const mockFrom = vi.fn<any>(() => ({
  where: mockWhere,
  orderBy: mockOrderBy,
}));
const mockSelect = vi.fn<any>(() => ({ from: mockFrom }));
const mockInsertValues = vi.fn<any>(() => ({ returning: mockReturning }));
const mockInsert = vi.fn<any>(() => ({ values: mockInsertValues }));
const mockUpdateSet = vi.fn<any>(() => ({
  where: vi.fn<any>(() => ({ returning: mockReturning })),
}));
const mockUpdate = vi.fn<any>(() => ({ set: mockUpdateSet }));
const mockDeleteWhere = vi.fn<any>(() => Promise.resolve());
const mockDelete = vi.fn<any>(() => ({ where: mockDeleteWhere }));

vi.mock('../db/client.js', () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
    insert: (...args: any[]) => mockInsert(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

vi.mock('../db/schema/index.js', () => ({
  integrations: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
    type: 'type',
    provider: 'provider',
    status: 'status',
    config: 'config',
    lastSync: 'last_sync',
    errorMessage: 'error_message',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));

vi.mock('@aion/shared-contracts', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(entity: string, id: string) {
      super(`${entity} ${id} not found`);
      this.name = 'NotFoundError';
    }
  },
  AppError: class AppError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, message: string, statusCode: number) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
      this.name = 'AppError';
    }
  },
  ErrorCodes: {
    INTEGRATION_CONFIG_INVALID: 'INTEGRATION_CONFIG_INVALID',
  },
}));

import { IntegrationService } from '../modules/integrations/service.js';

describe('IntegrationService', () => {
  let service: IntegrationService;
  const tenantId = 'tenant-001';
  const integrationId = 'integ-001';

  const fakeIntegration = {
    id: integrationId,
    tenantId,
    name: 'Slack Notifications',
    type: 'slack',
    provider: 'slack',
    status: 'active',
    config: { webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx' },
    lastSync: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IntegrationService();
  });

  // ─── list ─────────────────────────────────────────────────────
  it('list() returns integrations ordered by creation date', async () => {
    mockOrderBy.mockResolvedValueOnce([fakeIntegration]);

    const result = await service.list(tenantId);

    expect(mockSelect).toHaveBeenCalled();
    expect(result).toEqual([fakeIntegration]);
  });

  it('list() returns empty array when tenant has no integrations', async () => {
    mockOrderBy.mockResolvedValueOnce([]);

    const result = await service.list(tenantId);
    expect(result).toEqual([]);
  });

  // ─── getById ──────────────────────────────────────────────────
  it('getById() returns integration when found', async () => {
    mockLimit.mockResolvedValueOnce([fakeIntegration]);

    const result = await service.getById(integrationId, tenantId);
    expect(result).toEqual(fakeIntegration);
  });

  it('getById() throws NotFoundError when not found', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.getById('missing', tenantId)).rejects.toThrow('Integration');
  });

  // ─── create ───────────────────────────────────────────────────
  it('create() inserts a new integration', async () => {
    mockReturning.mockResolvedValueOnce([fakeIntegration]);

    const result = await service.create(tenantId, {
      name: 'Slack Notifications',
      type: 'slack',
      config: { webhookUrl: 'https://hooks.slack.com/services/T00/B00/xxx' },
    } as any);

    expect(mockInsert).toHaveBeenCalled();
    expect(result.type).toBe('slack');
  });

  // ─── update ───────────────────────────────────────────────────
  it('update() modifies the integration after verifying ownership', async () => {
    // getById check
    mockLimit.mockResolvedValueOnce([fakeIntegration]);
    // update
    const updated = { ...fakeIntegration, name: 'Renamed Integration' };
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([updated]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    const result = await service.update(integrationId, tenantId, { name: 'Renamed Integration' } as any);

    expect(result.name).toBe('Renamed Integration');
  });

  it('update() throws NotFoundError when integration does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.update('missing', tenantId, { name: 'X' } as any)).rejects.toThrow('Integration');
  });

  // ─── delete ───────────────────────────────────────────────────
  it('delete() removes the integration after verifying ownership', async () => {
    mockLimit.mockResolvedValueOnce([fakeIntegration]);

    await expect(service.delete(integrationId, tenantId)).resolves.not.toThrow();
    expect(mockDelete).toHaveBeenCalled();
  });

  it('delete() throws NotFoundError when integration does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.delete('missing', tenantId)).rejects.toThrow('Integration');
  });

  // ─── testConnectivity ─────────────────────────────────────────
  it('testConnectivity() tests webhook integration successfully', async () => {
    const webhookIntegration = { ...fakeIntegration, type: 'webhook', config: { url: 'https://example.com/hook' } };
    mockLimit.mockResolvedValueOnce([webhookIntegration]);
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    // update after test
    const mockSetWhere = vi.fn(() => Promise.resolve());
    mockUpdateSet.mockReturnValueOnce({ where: mockSetWhere });

    const result = await service.testConnectivity(integrationId, tenantId);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Webhook reachable');
    expect(result).toHaveProperty('latencyMs');
  });

  it('testConnectivity() handles webhook failure', async () => {
    const webhookIntegration = { ...fakeIntegration, type: 'webhook', config: { url: 'https://example.com/hook' } };
    mockLimit.mockResolvedValueOnce([webhookIntegration]);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const mockSetWhere = vi.fn(() => Promise.resolve());
    mockUpdateSet.mockReturnValueOnce({ where: mockSetWhere });

    const result = await service.testConnectivity(integrationId, tenantId);

    expect(result.success).toBe(false);
    expect(result.message).toContain('500');
  });

  it('testConnectivity() tests slack webhook successfully', async () => {
    mockLimit.mockResolvedValueOnce([fakeIntegration]); // type: 'slack'
    mockFetch.mockResolvedValueOnce({ ok: true });
    const mockSetWhere = vi.fn(() => Promise.resolve());
    mockUpdateSet.mockReturnValueOnce({ where: mockSetWhere });

    const result = await service.testConnectivity(integrationId, tenantId);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Slack webhook reachable');
  });

  it('testConnectivity() throws AppError when webhook URL is missing', async () => {
    const noUrl = { ...fakeIntegration, type: 'webhook', config: {} };
    mockLimit.mockResolvedValueOnce([noUrl]);

    await expect(service.testConnectivity(integrationId, tenantId)).rejects.toThrow('Webhook URL is not configured');
  });

  it('testConnectivity() throws AppError when slack webhook URL is missing', async () => {
    const noUrl = { ...fakeIntegration, type: 'slack', config: {} };
    mockLimit.mockResolvedValueOnce([noUrl]);

    await expect(service.testConnectivity(integrationId, tenantId)).rejects.toThrow('Slack webhook URL is not configured');
  });

  it('testConnectivity() tests email integration via emailService.healthCheck', async () => {
    const emailIntegration = { ...fakeIntegration, type: 'email', config: {} };
    mockLimit.mockResolvedValueOnce([emailIntegration]);
    mockEmailHealthCheck.mockResolvedValueOnce({ ok: true, message: 'SMTP connected' });
    const mockSetWhere = vi.fn(() => Promise.resolve());
    mockUpdateSet.mockReturnValueOnce({ where: mockSetWhere });

    const result = await service.testConnectivity(integrationId, tenantId);

    expect(result.success).toBe(true);
    expect(result.message).toBe('SMTP connected');
  });

  it('testConnectivity() returns assumed OK for unknown integration types', async () => {
    const customIntegration = { ...fakeIntegration, type: 'custom_api', config: {} };
    mockLimit.mockResolvedValueOnce([customIntegration]);
    const mockSetWhere = vi.fn(() => Promise.resolve());
    mockUpdateSet.mockReturnValueOnce({ where: mockSetWhere });

    const result = await service.testConnectivity(integrationId, tenantId);

    expect(result.success).toBe(true);
    expect(result.message).toContain('assumed OK');
  });

  it('testConnectivity() handles fetch errors gracefully', async () => {
    const webhookIntegration = { ...fakeIntegration, type: 'webhook', config: { url: 'https://unreachable.test' } };
    mockLimit.mockResolvedValueOnce([webhookIntegration]);
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const mockSetWhere = vi.fn(() => Promise.resolve());
    mockUpdateSet.mockReturnValueOnce({ where: mockSetWhere });

    const result = await service.testConnectivity(integrationId, tenantId);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Network error');
  });
});
