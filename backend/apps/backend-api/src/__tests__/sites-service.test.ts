import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock drizzle db ────────────────────────────────────────────────
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
const mockDeleteWhere = vi.fn<any>(() => ({ returning: mockReturning }));
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
  sites: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
    address: 'address',
    latitude: 'latitude',
    longitude: 'longitude',
    timezone: 'timezone',
    status: 'status',
    wanIp: 'wan_ip',
    updatedAt: 'updated_at',
  },
  devices: {
    id: 'id',
    tenantId: 'tenant_id',
    siteId: 'site_id',
    name: 'name',
    status: 'status',
  },
}));

vi.mock('@aion/shared-contracts', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(entity: string, id: string) {
      super(`${entity} ${id} not found`);
      this.name = 'NotFoundError';
    }
  },
}));

import { SiteService } from '../modules/sites/service.js';

describe('SiteService', () => {
  let service: SiteService;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const siteId = '00000000-0000-0000-0000-000000000010';

  const fakeSite = {
    id: siteId,
    tenantId,
    name: 'Main Office',
    address: '123 Main St',
    latitude: '4.6',
    longitude: '-74.0',
    timezone: 'America/Bogota',
    status: 'unknown',
    wanIp: '200.1.2.3',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SiteService();
  });

  // ─── list ─────────────────────────────────────────────────────
  it('list() returns sites for a tenant', async () => {
    mockOrderBy.mockResolvedValueOnce([fakeSite]);

    const result = await service.list(tenantId);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(result).toEqual([fakeSite]);
  });

  it('list() returns empty array when tenant has no sites', async () => {
    mockOrderBy.mockResolvedValueOnce([]);

    const result = await service.list(tenantId);
    expect(result).toEqual([]);
  });

  // ─── getById ──────────────────────────────────────────────────
  it('getById() returns a site when found', async () => {
    mockLimit.mockResolvedValueOnce([fakeSite]);

    const result = await service.getById(siteId, tenantId);
    expect(result).toEqual(fakeSite);
  });

  it('getById() throws NotFoundError when site does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.getById('missing-id', tenantId)).rejects.toThrow('Site');
  });

  it('getById() enforces tenant isolation (different tenant returns nothing)', async () => {
    mockLimit.mockResolvedValueOnce([]);

    const otherTenant = '00000000-0000-0000-0000-000000000099';
    await expect(service.getById(siteId, otherTenant)).rejects.toThrow('Site');
  });

  // ─── create ───────────────────────────────────────────────────
  it('create() inserts a site with default status "unknown"', async () => {
    mockReturning.mockResolvedValueOnce([fakeSite]);

    const result = await service.create(
      { name: 'Main Office', timezone: 'America/Bogota', address: '123 Main St', latitude: '4.6', longitude: '-74.0' },
      tenantId,
    );

    expect(mockInsert).toHaveBeenCalled();
    expect(result).toEqual(fakeSite);
  });

  it('create() handles optional fields as null', async () => {
    const minimalSite = { ...fakeSite, address: null, latitude: null, longitude: null };
    mockReturning.mockResolvedValueOnce([minimalSite]);

    const result = await service.create({ name: 'Minimal Site', timezone: 'UTC' }, tenantId);

    expect(result.address).toBeNull();
    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
  });

  // ─── update ───────────────────────────────────────────────────
  it('update() returns updated site', async () => {
    const updated = { ...fakeSite, name: 'Renamed Site' };
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([updated]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    const result = await service.update(siteId, { name: 'Renamed Site' }, tenantId);

    expect(mockUpdate).toHaveBeenCalled();
    expect(result.name).toBe('Renamed Site');
  });

  it('update() throws NotFoundError when site does not exist', async () => {
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    await expect(service.update('missing-id', { name: 'X' }, tenantId)).rejects.toThrow('Site');
  });

  // ─── delete ───────────────────────────────────────────────────
  it('delete() removes the site and does not throw for valid id', async () => {
    mockReturning.mockResolvedValueOnce([fakeSite]);

    await expect(service.delete(siteId, tenantId)).resolves.not.toThrow();
    expect(mockDelete).toHaveBeenCalled();
  });

  it('delete() throws NotFoundError when site does not exist', async () => {
    mockReturning.mockResolvedValueOnce([]);

    await expect(service.delete('missing-id', tenantId)).rejects.toThrow('Site');
  });

  // ─── listDevices ──────────────────────────────────────────────
  it('listDevices() returns devices for a given site', async () => {
    const fakeDevices = [
      { id: 'd1', name: 'Camera 1', siteId, tenantId, status: 'online' },
      { id: 'd2', name: 'Camera 2', siteId, tenantId, status: 'offline' },
    ];

    // First call: getById check (returns the site)
    mockLimit.mockResolvedValueOnce([fakeSite]);
    // Second call: device query
    mockOrderBy.mockResolvedValueOnce(fakeDevices);

    const result = await service.listDevices(siteId, tenantId);
    expect(result).toEqual(fakeDevices);
    expect(result).toHaveLength(2);
  });

  it('listDevices() throws NotFoundError if site does not belong to tenant', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.listDevices(siteId, 'wrong-tenant')).rejects.toThrow('Site');
  });
});
