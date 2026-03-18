import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock crypto for randomUUID ─────────────────────────────────
vi.stubGlobal('crypto', { randomUUID: () => 'uuid-mock-001' });

// ─── Mock drizzle db ────────────────────────────────────────────
const mockReturning = vi.fn();
const mockLimit = vi.fn(() => Promise.resolve([]));
const mockOffset = vi.fn(() => Promise.resolve([]));
const mockOrderBy = vi.fn(() => ({ limit: vi.fn(() => ({ offset: mockOffset })) }));
const mockWhere = vi.fn(() => ({
  limit: mockLimit,
  orderBy: mockOrderBy,
  returning: mockReturning,
}));
const mockFrom = vi.fn(() => ({
  where: mockWhere,
}));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockInsertValues = vi.fn(() => ({ returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockUpdateSet = vi.fn(() => ({
  where: vi.fn(() => ({ returning: mockReturning })),
}));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

vi.mock('../db/client.js', () => ({
  db: {
    select: (...args: any[]) => (mockSelect as any)(...args),
    insert: (...args: any[]) => (mockInsert as any)(...args),
    update: (...args: any[]) => (mockUpdate as any)(...args),
  },
}));

vi.mock('../db/schema/index.js', () => ({
  incidents: {
    id: 'id',
    tenantId: 'tenant_id',
    title: 'title',
    description: 'description',
    priority: 'priority',
    status: 'status',
    siteId: 'site_id',
    eventIds: 'event_ids',
    evidenceUrls: 'evidence_urls',
    comments: 'comments',
    assignedTo: 'assigned_to',
    createdBy: 'created_by',
    closedAt: 'closed_at',
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
}));

import { IncidentService } from '../modules/incidents/service.js';

describe('IncidentService', () => {
  let service: IncidentService;
  const tenantId = 'tenant-001';
  const userId = 'user-001';
  const incidentId = 'incident-001';

  const fakeIncident = {
    id: incidentId,
    tenantId,
    title: 'Unauthorized access attempt',
    description: 'Someone tried to enter zone B',
    priority: 'critical',
    status: 'open',
    siteId: 'site-001',
    eventIds: ['event-001'],
    evidenceUrls: [],
    comments: [],
    assignedTo: null,
    createdBy: userId,
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const defaultFilters = {
    page: 1,
    perPage: 20,
    sortBy: 'createdAt' as const,
    sortOrder: 'desc' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IncidentService();
  });

  // ─── list ─────────────────────────────────────────────────────
  it('list() returns paginated incidents for a tenant', async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([{ count: 1 }])) } as any);
    mockOffset.mockResolvedValueOnce([fakeIncident] as any);

    const result = await service.list(tenantId, defaultFilters);

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('meta');
  });

  it('list() applies priority filter', async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([{ count: 0 }])) } as any);
    mockOffset.mockResolvedValueOnce([]);

    await service.list(tenantId, { ...defaultFilters, priority: 'critical' } as any);
    expect(mockSelect).toHaveBeenCalled();
  });

  it('list() applies status and assignedTo filters', async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([{ count: 0 }])) } as any);
    mockOffset.mockResolvedValueOnce([]);

    await service.list(tenantId, { ...defaultFilters, status: 'open', assignedTo: 'user-001' } as any);
    expect(mockSelect).toHaveBeenCalled();
  });

  // ─── getById ──────────────────────────────────────────────────
  it('getById() returns incident when found', async () => {
    mockLimit.mockResolvedValueOnce([fakeIncident] as any);

    const result = await service.getById(incidentId, tenantId);
    expect(result).toEqual(fakeIncident);
  });

  it('getById() throws NotFoundError when incident does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.getById('missing', tenantId)).rejects.toThrow('Incident');
  });

  // ─── create ───────────────────────────────────────────────────
  it('create() inserts an incident with status "open"', async () => {
    mockReturning.mockResolvedValueOnce([fakeIncident]);

    const result = await service.create(
      {
        title: 'Unauthorized access attempt',
        description: 'Someone tried to enter zone B',
        priority: 'critical',
        eventIds: ['event-001'],
      } as any,
      tenantId,
      userId,
    );

    expect(mockInsert).toHaveBeenCalled();
    expect(result.status).toBe('open');
    expect(result.createdBy).toBe(userId);
  });

  // ─── update ───────────────────────────────────────────────────
  it('update() returns updated incident', async () => {
    const updated = { ...fakeIncident, status: 'investigating', assignedTo: 'user-002' };
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([updated]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    const result = await service.update(incidentId, { status: 'investigating', assignedTo: 'user-002' } as any, tenantId);

    expect(result.status).toBe('investigating');
    expect(result.assignedTo).toBe('user-002');
  });

  it('update() sets closedAt when status is "closed"', async () => {
    const closed = { ...fakeIncident, status: 'closed', closedAt: new Date() };
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([closed]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    const result = await service.update(incidentId, { status: 'closed' } as any, tenantId);

    expect(result.status).toBe('closed');
    expect(result.closedAt).toBeTruthy();
  });

  it('update() sets closedAt when status is "resolved"', async () => {
    const resolved = { ...fakeIncident, status: 'resolved', closedAt: new Date() };
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([resolved]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    const result = await service.update(incidentId, { status: 'resolved' } as any, tenantId);

    expect(result.closedAt).toBeTruthy();
  });

  it('update() throws NotFoundError when incident does not exist', async () => {
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    await expect(service.update('missing', { status: 'closed' } as any, tenantId)).rejects.toThrow('Incident');
  });

  // ─── addEvidence ──────────────────────────────────────────────
  it('addEvidence() appends evidence URL to the incident', async () => {
    // getById call
    mockLimit.mockResolvedValueOnce([fakeIncident] as any);
    // update call
    const withEvidence = { ...fakeIncident, evidenceUrls: ['https://evidence.example.com/1.jpg'] };
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([withEvidence]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    const result = await service.addEvidence(
      incidentId,
      { type: 'image', url: 'https://evidence.example.com/1.jpg' } as any,
      userId,
      tenantId,
    );

    expect(result.evidenceUrls).toContain('https://evidence.example.com/1.jpg');
  });

  it('addEvidence() throws NotFoundError when incident does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      service.addEvidence('missing', { type: 'image', url: 'http://x.com/1.jpg' } as any, userId, tenantId),
    ).rejects.toThrow('Incident');
  });

  // ─── addComment ───────────────────────────────────────────────
  it('addComment() appends a comment to the incident', async () => {
    // getById call
    mockLimit.mockResolvedValueOnce([fakeIncident] as any);
    // update call
    const withComment = {
      ...fakeIncident,
      comments: [{ id: 'uuid-mock-001', content: 'Investigating now', authorId: userId, authorName: 'Admin', createdAt: new Date().toISOString() }],
    };
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([withComment]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    const result = await service.addComment(incidentId, { content: 'Investigating now' }, userId, 'Admin', tenantId);

    expect((result as any).comments).toHaveLength(1);
    expect((result as any).comments[0].content).toBe('Investigating now');
  });

  it('addComment() throws NotFoundError when incident does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      service.addComment('missing', { content: 'test' }, userId, 'Admin', tenantId),
    ).rejects.toThrow('Incident');
  });
});
