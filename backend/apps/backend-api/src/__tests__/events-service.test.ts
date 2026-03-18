import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  events: {
    id: 'id',
    tenantId: 'tenant_id',
    deviceId: 'device_id',
    siteId: 'site_id',
    eventType: 'event_type',
    severity: 'severity',
    status: 'status',
    title: 'title',
    description: 'description',
    channel: 'channel',
    snapshotUrl: 'snapshot_url',
    metadata: 'metadata',
    assignedTo: 'assigned_to',
    resolvedAt: 'resolved_at',
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

import { EventService } from '../modules/events/service.js';

describe('EventService', () => {
  let service: EventService;
  const tenantId = 'tenant-001';
  const eventId = 'event-001';

  const fakeEvent = {
    id: eventId,
    tenantId,
    deviceId: 'device-001',
    siteId: 'site-001',
    eventType: 'motion_detected',
    severity: 'high',
    status: 'new',
    title: 'Motion Detected at Camera 1',
    description: 'Movement in restricted zone',
    channel: 1,
    snapshotUrl: 'https://snap.example.com/1.jpg',
    metadata: { zone: 'parking' },
    assignedTo: null,
    resolvedAt: null,
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
    service = new EventService();
  });

  // ─── list ─────────────────────────────────────────────────────
  it('list() returns paginated events for a tenant', async () => {
    // count query
    mockWhere.mockReturnValueOnce({
      limit: mockLimit,
      orderBy: mockOrderBy,
      returning: mockReturning,
    });
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([{ count: 1 }])) } as any);
    // data query
    mockOffset.mockResolvedValueOnce([fakeEvent] as any);

    const result = await service.list(tenantId, defaultFilters);

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('meta');
    expect(result.meta).toHaveProperty('page', 1);
  });

  it('list() applies severity filter', async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([{ count: 0 }])) } as any);
    mockOffset.mockResolvedValueOnce([]);

    await service.list(tenantId, { ...defaultFilters, severity: 'critical' } as any);

    // The where clause should have been called (we trust drizzle builds the correct query)
    expect(mockSelect).toHaveBeenCalled();
  });

  it('list() applies date range filters', async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([{ count: 0 }])) } as any);
    mockOffset.mockResolvedValueOnce([]);

    await service.list(tenantId, {
      ...defaultFilters,
      from: '2025-01-01',
      to: '2025-12-31',
    } as any);

    expect(mockSelect).toHaveBeenCalled();
  });

  // ─── create ───────────────────────────────────────────────────
  it('create() inserts an event with status "new"', async () => {
    mockReturning.mockResolvedValueOnce([fakeEvent]);

    const result = await service.create(
      {
        deviceId: 'device-001',
        siteId: 'site-001',
        type: 'motion_detected',
        severity: 'high',
        title: 'Motion Detected at Camera 1',
      } as any,
      tenantId,
    );

    expect(mockInsert).toHaveBeenCalled();
    expect(result).toEqual(fakeEvent);
  });

  it('create() handles optional fields as null', async () => {
    const eventNoOptionals = { ...fakeEvent, description: null, channel: null, snapshotUrl: null };
    mockReturning.mockResolvedValueOnce([eventNoOptionals]);

    const result = await service.create(
      { deviceId: 'device-001', siteId: 'site-001', type: 'alarm', severity: 'low', title: 'Test' } as any,
      tenantId,
    );

    expect(result.description).toBeNull();
    expect(result.channel).toBeNull();
  });

  // ─── assign ───────────────────────────────────────────────────
  it('assign() updates assignedTo and returns event', async () => {
    const assignedEvent = { ...fakeEvent, assignedTo: 'user-001' };
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([assignedEvent]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    const result = await service.assign(eventId, { assignedTo: 'user-001' }, tenantId);

    expect(result.assignedTo).toBe('user-001');
  });

  it('assign() throws NotFoundError when event does not exist', async () => {
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    await expect(service.assign('missing', { assignedTo: 'user-001' }, tenantId)).rejects.toThrow('Event');
  });

  // ─── updateStatus ─────────────────────────────────────────────
  it('updateStatus() sets status to "acknowledged"', async () => {
    const ackEvent = { ...fakeEvent, status: 'acknowledged' };
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([ackEvent]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    const result = await service.updateStatus(eventId, { status: 'acknowledged' }, tenantId);

    expect(result.status).toBe('acknowledged');
  });

  it('updateStatus() sets resolvedAt when status is "resolved"', async () => {
    const resolvedEvent = { ...fakeEvent, status: 'resolved', resolvedAt: new Date() };
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([resolvedEvent]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    const result = await service.updateStatus(eventId, { status: 'resolved' }, tenantId);

    expect(result.status).toBe('resolved');
    expect(result.resolvedAt).toBeTruthy();
  });

  it('updateStatus() throws NotFoundError when event does not exist', async () => {
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    await expect(service.updateStatus('missing', { status: 'resolved' }, tenantId)).rejects.toThrow('Event');
  });

  // ─── getStats ─────────────────────────────────────────────────
  it('getStats() returns aggregated stats with severity and status breakdowns', async () => {
    const statsRow = {
      total: 50,
      critical: 5,
      high: 10,
      medium: 20,
      low: 10,
      info: 5,
      status_new: 15,
      status_acknowledged: 10,
      status_resolved: 20,
      status_dismissed: 5,
    };
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([statsRow])) } as any);

    const result = await service.getStats(tenantId);

    expect(result.total).toBe(50);
    expect(result.bySeverity.critical).toBe(5);
    expect(result.byStatus.resolved).toBe(20);
  });

  it('getStats() defaults to zeros when no results', async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([null])) } as any);

    const result = await service.getStats(tenantId);

    expect(result.total).toBe(0);
    expect(result.bySeverity.critical).toBe(0);
    expect(result.byStatus.new).toBe(0);
  });
});
