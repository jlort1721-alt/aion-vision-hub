// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock drizzle db ────────────────────────────────────────────
const mockReturning = vi.fn();
const mockLimit = vi.fn(() => Promise.resolve([]));
const mockOffset = vi.fn(() => Promise.resolve([]));
const mockOrderBy = vi.fn(() => ({
  limit: vi.fn(() => ({ offset: mockOffset })),
}));
const mockGroupBy = vi.fn(() => ({
  orderBy: vi.fn(() => ({
    limit: vi.fn(() => Promise.resolve([])),
  })),
}));
const mockWhere = vi.fn(() => ({
  limit: mockLimit,
  orderBy: mockOrderBy,
  returning: mockReturning,
  groupBy: mockGroupBy,
}));
const mockFrom = vi.fn(() => ({
  where: mockWhere,
  groupBy: vi.fn(() => ({ orderBy: vi.fn(() => Promise.resolve([])) })),
}));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockInsertValues = vi.fn(() => ({ returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockExecute = vi.fn(() => Promise.resolve([]));

vi.mock('../db/client.js', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    execute: (...args: unknown[]) => mockExecute(...args),
  },
}));

vi.mock('../db/schema/index.js', () => {
  const col = (name: string) => name;
  return {
    events: {
      tenantId: col('tenant_id'),
      severity: col('severity'),
      status: col('status'),
      eventType: col('event_type'),
      createdAt: col('created_at'),
    },
    incidents: {
      tenantId: col('tenant_id'),
      status: col('status'),
      priority: col('priority'),
      closedAt: col('closed_at'),
      createdAt: col('created_at'),
    },
    devices: {
      tenantId: col('tenant_id'),
      siteId: col('site_id'),
      status: col('status'),
    },
    alertInstances: {
      tenantId: col('tenant_id'),
      status: col('status'),
    },
    slaTracking: {
      tenantId: col('tenant_id'),
      status: col('status'),
    },
    patrolLogs: {
      tenantId: col('tenant_id'),
      status: col('status'),
    },
    shiftAssignments: {
      tenantId: col('tenant_id'),
      status: col('status'),
    },
    kpiSnapshots: {
      tenantId: col('tenant_id'),
      period: col('period'),
      periodStart: col('period_start'),
      periodEnd: col('period_end'),
      metrics: col('metrics'),
    },
  };
});

import { AnalyticsService } from '../modules/analytics/service.js';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  const tenantId = 'tenant-001';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AnalyticsService();
  });

  // ─── getDashboardOverview ─────────────────────────────────────
  it('getDashboardOverview() returns all dashboard metrics', async () => {
    // Mock 7 sequential db calls (events, incidents, devices, alerts, SLA, patrols, shifts)
    const eventStats = { total24h: 12, total7d: 80, critical24h: 2, high24h: 3, medium24h: 5, low24h: 2 };
    const incidentStats = { active: 3 };
    const deviceStats = { online: 25, offline: 5 };
    const alertStats = { firing: 2 };
    const slaStats = { met: 45, breached: 5 };
    const patrolStats = { completed: 18, total: 20 };
    const shiftStats = { attended: 28, total: 30 };

    // Each db.select().from().where() chain
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([eventStats]) as any) })
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([incidentStats]) as any) })
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([deviceStats]) as any) })
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([alertStats]) as any) })
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([slaStats]) as any) })
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([patrolStats]) as any) })
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([shiftStats]) as any) });

    const result = await service.getDashboardOverview(tenantId);

    expect(result.events.last24h).toBe(12);
    expect(result.events.last7d).toBe(80);
    expect(result.events.bySeverity24h.critical).toBe(2);
    expect(result.incidents.active).toBe(3);
    expect(result.devices.online).toBe(25);
    expect(result.devices.offline).toBe(5);
    expect(result.alerts.firing).toBe(2);
    expect(result.sla.complianceRate).toBe(90);
    expect(result.sla.met).toBe(45);
    expect(result.sla.breached).toBe(5);
    expect(result.patrols.complianceRate).toBe(90);
    expect(result.shifts.attendanceRate).toBeCloseTo(93.33, 1);
  });

  it('getDashboardOverview() returns 100% compliance when no SLA data', async () => {
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([null]) as any) })
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([null]) as any) })
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([null]) as any) })
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([null]) as any) })
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([{ met: 0, breached: 0 }]) as any) })
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([{ completed: 0, total: 0 }]) as any) })
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([{ attended: 0, total: 0 }]) as any) });

    const result = await service.getDashboardOverview(tenantId);

    expect(result.sla.complianceRate).toBe(100);
    expect(result.patrols.complianceRate).toBe(100);
    expect(result.shifts.attendanceRate).toBe(100);
  });

  // ─── getEventTrends ───────────────────────────────────────────
  it('getEventTrends() executes raw SQL for time-series data', async () => {
    const trendRows = [
      { date: '2025-06-01', total: 10, critical: 1, high: 2, medium: 5, low: 2 },
      { date: '2025-06-02', total: 15, critical: 3, high: 4, medium: 6, low: 2 },
    ];
    mockExecute.mockResolvedValueOnce(trendRows);

    const result = await service.getEventTrends(tenantId, '2025-06-01', '2025-06-30', 'day');

    expect(mockExecute).toHaveBeenCalled();
    expect(result).toEqual(trendRows);
  });

  it('getEventTrends() returns empty array when no events', async () => {
    mockExecute.mockResolvedValueOnce([]);

    const result = await service.getEventTrends(tenantId, '2025-06-01', '2025-06-30', 'day');
    expect(result).toEqual([]);
  });

  // ─── getIncidentMetrics ───────────────────────────────────────
  it('getIncidentMetrics() returns status breakdown and avg resolution', async () => {
    const metricsRow = {
      total: 20,
      open: 5,
      investigating: 3,
      resolved: 8,
      closed: 4,
      avgResolutionMinutes: 120,
    };
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([metricsRow])) });

    const result = await service.getIncidentMetrics(tenantId, '2025-01-01', '2025-12-31');

    expect(result.total).toBe(20);
    expect(result.byStatus.open).toBe(5);
    expect(result.byStatus.resolved).toBe(8);
    expect(result.avgResolutionMinutes).toBe(120);
  });

  it('getIncidentMetrics() defaults to zeros when no data', async () => {
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([null])) });

    const result = await service.getIncidentMetrics(tenantId, '2025-01-01', '2025-12-31');

    expect(result.total).toBe(0);
    expect(result.avgResolutionMinutes).toBe(0);
  });

  // ─── getDeviceStatusBreakdown ─────────────────────────────────
  it('getDeviceStatusBreakdown() groups devices by site and status', async () => {
    const rows = [
      { siteId: 'site-001', status: 'online', count: 10 },
      { siteId: 'site-001', status: 'offline', count: 2 },
      { siteId: 'site-002', status: 'online', count: 5 },
    ];
    mockFrom.mockReturnValueOnce({
      where: vi.fn(() => ({
        groupBy: vi.fn(() => ({
          orderBy: vi.fn(() => Promise.resolve(rows)),
        })),
      })),
    });

    const result = await service.getDeviceStatusBreakdown(tenantId);

    expect(result['site-001']).toEqual({ online: 10, offline: 2 });
    expect(result['site-002']).toEqual({ online: 5 });
  });

  // ─── saveKPISnapshot ──────────────────────────────────────────
  it('saveKPISnapshot() inserts and returns the snapshot', async () => {
    const snapshot = {
      id: 'snap-001',
      tenantId,
      period: 'daily',
      periodStart: new Date('2025-06-01'),
      periodEnd: new Date('2025-06-02'),
      metrics: { events: 42, incidents: 3 },
    };
    mockReturning.mockResolvedValueOnce([snapshot]);

    const result = await service.saveKPISnapshot(
      tenantId,
      'daily',
      '2025-06-01',
      '2025-06-02',
      { events: 42, incidents: 3 },
    );

    expect(mockInsert).toHaveBeenCalled();
    expect(result.period).toBe('daily');
    expect(result.metrics).toEqual({ events: 42, incidents: 3 });
  });

  // ─── listKPISnapshots ─────────────────────────────────────────
  it('listKPISnapshots() returns paginated results filtered by period', async () => {
    // count query
    mockFrom.mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([{ count: 5 }])) });
    // data query
    const snapshots = [
      { id: 's1', period: 'daily', metrics: {} },
      { id: 's2', period: 'daily', metrics: {} },
    ];
    mockOffset.mockResolvedValueOnce(snapshots);

    const result = await service.listKPISnapshots(tenantId, {
      period: 'daily',
      page: 1,
      perPage: 10,
    });

    expect(result.items).toEqual(snapshots);
    expect(result.meta.total).toBe(5);
    expect(result.meta.totalPages).toBe(1);
  });
});
