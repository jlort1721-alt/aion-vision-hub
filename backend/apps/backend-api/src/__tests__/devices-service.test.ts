import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock config ────────────────────────────────────────────────
vi.mock('../config/env.js', () => ({
  config: { CREDENTIAL_ENCRYPTION_KEY: null },
}));

// ─── Mock drizzle db ────────────────────────────────────────────
const mockReturning = vi.fn();
const mockLimit = vi.fn(() => Promise.resolve([]));
const mockOffset = vi.fn(() => Promise.resolve([]));
const mockOrderBy = vi.fn(() => ({ limit: vi.fn(() => ({ offset: mockOffset })) }));
const mockWhere = vi.fn(() => ({
  limit: mockLimit,
  orderBy: mockOrderBy,
  returning: mockReturning,
  groupBy: vi.fn(() => ({ orderBy: vi.fn(() => Promise.resolve([])) })),
}));
const mockLeftJoin = vi.fn(() => ({
  where: mockWhere,
}));
const mockFrom = vi.fn(() => ({
  where: mockWhere,
  leftJoin: mockLeftJoin,
  orderBy: mockOrderBy,
}));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockInsertValues = vi.fn(() => ({ returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockUpdateSet = vi.fn(() => ({
  where: vi.fn(() => ({ returning: mockReturning })),
}));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
const mockDeleteWhere = vi.fn(() => ({ returning: mockReturning }));
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

vi.mock('../db/client.js', () => ({
  db: {
    select: (...args: any[]) => (mockSelect as any)(...args),
    insert: (...args: any[]) => (mockInsert as any)(...args),
    update: (...args: any[]) => (mockUpdate as any)(...args),
    delete: (...args: any[]) => (mockDelete as any)(...args),
  },
}));

vi.mock('../db/schema/index.js', () => ({
  sites: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
    wanIp: 'wan_ip',
  },
  devices: {
    id: 'id',
    tenantId: 'tenant_id',
    siteId: 'site_id',
    name: 'name',
    brand: 'brand',
    model: 'model',
    type: 'type',
    ipAddress: 'ip_address',
    port: 'port',
    username: 'username',
    password: 'password',
    status: 'status',
    tags: 'tags',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    lastSeen: 'last_seen',
    deviceSlug: 'device_slug',
    subnetMask: 'subnet_mask',
    gateway: 'gateway',
    operator: 'operator',
    serialNumber: 'serial_number',
    appName: 'app_name',
    appId: 'app_id',
    extension: 'extension',
    outboundCall: 'outbound_call',
    connectionType: 'connection_type',
    channels: 'channels',
  },
}));

vi.mock('@aion/common-utils', () => ({
  encrypt: vi.fn((v: string) => `enc:${v}`),
  decrypt: vi.fn((v: string) => v.replace('enc:', '')),
}));

vi.mock('@aion/shared-contracts', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(entity: string, id: string) {
      super(`${entity} ${id} not found`);
      this.name = 'NotFoundError';
    }
  },
}));

import { DeviceService } from '../modules/devices/service.js';

describe('DeviceService', () => {
  let service: DeviceService;
  const tenantId = 'tenant-001';
  const siteId = 'site-001';
  const deviceId = 'device-001';

  const fakeDevice = {
    id: deviceId,
    tenantId,
    siteId,
    name: 'Front Camera',
    brand: 'hikvision',
    model: 'DS-2CD2143',
    type: 'camera',
    ipAddress: '192.168.1.100',
    port: 8080,
    username: 'admin',
    password: 'pass123',
    status: 'online',
    tags: ['entrance'],
    lastSeen: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DeviceService();
  });

  // ─── getById ──────────────────────────────────────────────────
  it('getById() returns enriched device with decrypted credentials', async () => {
    mockLimit.mockResolvedValueOnce([{ device: fakeDevice, wanIp: '200.1.2.3' }] as any);

    const result = await service.getById(deviceId, tenantId);

    expect(result).toHaveProperty('remoteAddress', '200.1.2.3:8080');
    expect(result).toHaveProperty('wanIp', '200.1.2.3');
  });

  it('getById() throws NotFoundError when device does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.getById('missing', tenantId)).rejects.toThrow('Device');
  });

  it('getById() returns null remoteAddress when wanIp is missing', async () => {
    mockLimit.mockResolvedValueOnce([{ device: fakeDevice, wanIp: null }] as any);

    const result = await service.getById(deviceId, tenantId);
    expect(result.remoteAddress).toBeNull();
  });

  // ─── create ───────────────────────────────────────────────────
  it('create() verifies site belongs to tenant before inserting', async () => {
    // site check
    mockLimit.mockResolvedValueOnce([{ id: siteId }] as any);
    mockReturning.mockResolvedValueOnce([fakeDevice]);

    const result = await service.create(
      { siteId, name: 'Front Camera', type: 'camera' } as any,
      tenantId,
    );

    expect(mockSelect).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
    expect(result).toEqual(fakeDevice);
  });

  it('create() throws NotFoundError when site does not belong to tenant', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      service.create({ siteId: 'wrong-site', name: 'X', type: 'camera' } as any, tenantId),
    ).rejects.toThrow('Site');
  });

  // ─── update ───────────────────────────────────────────────────
  it('update() returns updated device', async () => {
    const updated = { ...fakeDevice, name: 'Rear Camera' };
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([updated]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    const result = await service.update(deviceId, { name: 'Rear Camera' } as any, tenantId);

    expect(result.name).toBe('Rear Camera');
  });

  it('update() throws NotFoundError when device does not exist', async () => {
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    await expect(service.update('missing', { name: 'X' } as any, tenantId)).rejects.toThrow('Device');
  });

  // ─── delete ───────────────────────────────────────────────────
  it('delete() removes the device successfully', async () => {
    mockReturning.mockResolvedValueOnce([fakeDevice]);

    await expect(service.delete(deviceId, tenantId)).resolves.not.toThrow();
    expect(mockDelete).toHaveBeenCalled();
  });

  it('delete() throws NotFoundError when device does not exist', async () => {
    mockReturning.mockResolvedValueOnce([]);

    await expect(service.delete('missing', tenantId)).rejects.toThrow('Device');
  });

  // ─── touchLastSeen ────────────────────────────────────────────
  it('touchLastSeen() updates status to online and sets lastSeen', async () => {
    const mockSetWhere = vi.fn(() => Promise.resolve());
    mockUpdateSet.mockReturnValueOnce({ where: mockSetWhere } as any);

    await service.touchLastSeen(deviceId, tenantId);

    expect(mockUpdate).toHaveBeenCalled();
  });

  // ─── healthCheck ──────────────────────────────────────────────
  it('healthCheck() throws NotFoundError when device does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.healthCheck('missing', tenantId)).rejects.toThrow('Device');
  });

  it('healthCheck() returns error when no WAN IP configured', async () => {
    mockLimit.mockResolvedValueOnce([{
      device: { ...fakeDevice, port: 8080 },
      wanIp: null,
    }] as any);

    const result = await service.healthCheck(deviceId, tenantId);

    expect(result.reachable).toBe(false);
    expect(result.error).toContain('No WAN IP');
  });

  it('healthCheck() returns error when no port mapped', async () => {
    mockLimit.mockResolvedValueOnce([{
      device: { ...fakeDevice, port: null },
      wanIp: '200.1.2.3',
    }] as any);

    const result = await service.healthCheck(deviceId, tenantId);

    expect(result.reachable).toBe(false);
    expect(result.error).toContain('No port mapped');
  });
});
