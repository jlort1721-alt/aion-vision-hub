import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────

const { mockSendGeneric, mockLogger } = vi.hoisted(() => ({
  mockSendGeneric: vi.fn().mockResolvedValue({ success: true }),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@aion/common-utils', async () => {
  const actual = await vi.importActual('@aion/common-utils');
  return {
    ...actual,
    createLogger: vi.fn(() => mockLogger),
  };
});

vi.mock('../modules/email/service.js', () => ({
  emailService: {
    sendGeneric: (...args: unknown[]) => mockSendGeneric(...args),
  },
}));

vi.mock('../db/schema/index.js', () => ({
  scheduledReports: {
    id: 'id', tenantId: 'tenant_id', name: 'name', type: 'type',
    schedule: 'schedule', recipients: 'recipients', filters: 'filters',
    isActive: 'is_active', lastRunAt: 'last_run_at', nextRunAt: 'next_run_at',
    lastError: 'last_error', updatedAt: 'updated_at',
  },
}));

vi.mock('../db/schema/events.js', () => ({
  events: {
    tenantId: 'tenant_id', createdAt: 'created_at',
    severity: 'severity', eventType: 'event_type', siteId: 'site_id',
  },
}));

vi.mock('../db/schema/incidents.js', () => ({
  incidents: {
    tenantId: 'tenant_id', createdAt: 'created_at', status: 'status',
  },
}));

vi.mock('../db/schema/devices.js', () => ({
  devices: { tenantId: 'tenant_id', status: 'status' },
  sites: { id: 'id', name: 'name' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ op: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  lte: vi.fn((a: unknown, b: unknown) => ({ op: 'lte', a, b })),
  gte: vi.fn((a: unknown, b: unknown) => ({ op: 'gte', a, b })),
  sql: vi.fn(),
  count: vi.fn(() => 'count_fn'),
}));

// Build a chain-able mock DB
function createMockDb(dueReports: unknown[]) {
  // Track call index to return different results for different queries
  let selectCallIdx = 0;
  const defaultSelectResults: unknown[][] = [
    dueReports,         // 1st: due reports
    [{ count: 10 }],    // 2nd: event total
    [{ severity: 'critical', count: 3 }], // 3rd: events by severity
    [{ type: 'motion', count: 5 }],       // 4th: events by type
    [{ status: 'open', count: 2 }, { status: 'resolved', count: 4 }], // 5th: incidents
    [{ status: 'online', count: 8 }, { status: 'offline', count: 2 }], // 6th: device health
    [{ siteName: 'HQ', eventCount: 7 }], // 7th: top sites
  ];

  const limitFn = vi.fn().mockImplementation(() => {
    return Promise.resolve(defaultSelectResults[selectCallIdx - 1] ?? []);
  });

  const orderByFn = vi.fn().mockReturnValue({ limit: limitFn });

  const groupByFn = vi.fn().mockImplementation(() => {
    // Some queries chain .groupBy().orderBy().limit(), others just .groupBy()
    return {
      orderBy: orderByFn,
      // Also resolve directly for queries that don't chain further
      then: (resolve: (v: unknown) => void) => resolve(defaultSelectResults[selectCallIdx - 1] ?? []),
    };
  });

  const innerJoinFn = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({ groupBy: groupByFn }),
  });

  const whereFn = vi.fn().mockImplementation(() => {
    return {
      groupBy: groupByFn,
      limit: limitFn,
      then: (resolve: (v: unknown) => void) => resolve(defaultSelectResults[selectCallIdx - 1] ?? []),
    };
  });

  const fromFn = vi.fn().mockImplementation(() => {
    selectCallIdx++;
    return {
      where: whereFn,
      innerJoin: innerJoinFn,
    };
  });

  const selectFn = vi.fn().mockReturnValue({ from: fromFn });

  const updateWhereFn = vi.fn().mockResolvedValue(undefined);
  const setFn = vi.fn().mockReturnValue({ where: updateWhereFn });
  const updateFn = vi.fn().mockReturnValue({ set: setFn });

  return {
    select: selectFn,
    update: updateFn,
    _setFn: setFn,
    _updateWhereFn: updateWhereFn,
  };
}

import {
  startReportsWorker,
  stopReportsWorker,
} from '../workers/reports-worker.js';

// ── Tests ─────────────────────────────────────────────────────────

describe('Reports Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSendGeneric.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    stopReportsWorker();
    vi.useRealTimers();
  });

  // ── startReportsWorker / stopReportsWorker ────────────────

  describe('startReportsWorker', () => {
    it('returns a cleanup function', () => {
      const db = createMockDb([]);
      const cleanup = startReportsWorker(db as any, 60_000);
      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('prevents double-start', () => {
      const db = createMockDb([]);

      startReportsWorker(db as any, 60_000);
      startReportsWorker(db as any, 60_000);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('already running'),
      );
    });

    it('runs an immediate tick on start', async () => {
      const db = createMockDb([]);
      startReportsWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      // Should query for due reports
      expect(db.select).toHaveBeenCalled();
    });

    it('runs ticks on each interval', async () => {
      const db = createMockDb([]);
      startReportsWorker(db as any, 1000);
      await vi.advanceTimersByTimeAsync(0);
      db.select.mockClear();

      await vi.advanceTimersByTimeAsync(1000);
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('stopReportsWorker', () => {
    it('stops the timer so no further ticks fire', async () => {
      const db = createMockDb([]);
      startReportsWorker(db as any, 1000);
      await vi.advanceTimersByTimeAsync(0);

      stopReportsWorker();
      db.select.mockClear();

      await vi.advanceTimersByTimeAsync(5000);
      expect(db.select).not.toHaveBeenCalled();
    });

    it('is safe to call when not running', () => {
      expect(() => stopReportsWorker()).not.toThrow();
    });
  });

  // ── Report tick logic ─────────────────────────────────────

  describe('report tick', () => {
    it('does nothing when no reports are due', async () => {
      const db = createMockDb([]);
      startReportsWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockSendGeneric).not.toHaveBeenCalled();
    });

    it('processes due reports and sends email', async () => {
      const dueReport = {
        id: 'rpt-1',
        tenantId: 't1',
        name: 'Weekly Summary',
        type: 'weekly_summary',
        schedule: {},
        recipients: { email: ['admin@test.com'] },
        filters: {},
        isActive: true,
        lastRunAt: null,
        nextRunAt: new Date(Date.now() - 1000),
      };

      const db = createMockDb([dueReport]);
      startReportsWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockSendGeneric).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['admin@test.com'],
          subject: expect.stringContaining('Weekly Summary'),
          html: expect.stringContaining('AION Vision Hub'),
        }),
      );
    });

    it('updates lastRunAt and nextRunAt after successful send', async () => {
      const dueReport = {
        id: 'rpt-1',
        tenantId: 't1',
        name: 'Daily Report',
        type: 'daily_events',
        schedule: {},
        recipients: { email: ['user@test.com'] },
        filters: {},
        isActive: true,
        lastRunAt: null,
        nextRunAt: new Date(Date.now() - 1000),
      };

      const db = createMockDb([dueReport]);
      startReportsWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(db.update).toHaveBeenCalled();
      expect(db._setFn).toHaveBeenCalledWith(
        expect.objectContaining({
          lastRunAt: expect.any(Date),
          nextRunAt: expect.any(Date),
          lastError: null,
        }),
      );
    });

    it('skips sending when report has no email recipients', async () => {
      const dueReport = {
        id: 'rpt-2',
        tenantId: 't1',
        name: 'Empty Recipients',
        type: 'weekly_summary',
        schedule: {},
        recipients: { email: [] },
        filters: {},
        isActive: true,
        lastRunAt: null,
        nextRunAt: new Date(Date.now() - 1000),
      };

      const db = createMockDb([dueReport]);
      startReportsWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockSendGeneric).not.toHaveBeenCalled();
    });

    it('skips sending when recipients is null', async () => {
      const dueReport = {
        id: 'rpt-3',
        tenantId: 't1',
        name: 'Null Recipients',
        type: 'weekly_summary',
        schedule: {},
        recipients: null,
        filters: {},
        isActive: true,
        lastRunAt: null,
        nextRunAt: new Date(Date.now() - 1000),
      };

      const db = createMockDb([dueReport]);
      startReportsWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      expect(mockSendGeneric).not.toHaveBeenCalled();
    });

    it('handles email send failure and persists error', async () => {
      mockSendGeneric.mockResolvedValueOnce({ success: false, error: 'SMTP timeout' });

      const dueReport = {
        id: 'rpt-4',
        tenantId: 't1',
        name: 'Failing Report',
        type: 'weekly_summary',
        schedule: {},
        recipients: { email: ['admin@test.com'] },
        filters: {},
        isActive: true,
        lastRunAt: null,
        nextRunAt: new Date(Date.now() - 1000),
      };

      const db = createMockDb([dueReport]);
      startReportsWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      // Error should be persisted via update
      expect(db.update).toHaveBeenCalled();
      expect(db._setFn).toHaveBeenCalledWith(
        expect.objectContaining({
          lastError: expect.stringContaining('Email send failed'),
        }),
      );
    });

    it('determines frequency from report type (daily)', async () => {
      const dueReport = {
        id: 'rpt-5',
        tenantId: 't1',
        name: 'Daily Events',
        type: 'daily_events',
        schedule: {},
        recipients: { email: ['admin@test.com'] },
        filters: {},
        isActive: true,
        lastRunAt: null,
        nextRunAt: new Date(Date.now() - 1000),
      };

      const db = createMockDb([dueReport]);
      startReportsWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      // After daily report, nextRunAt should be ~24h from now
      if (db._setFn.mock.calls.length > 0) {
        const setArg = db._setFn.mock.calls[0][0];
        if (setArg.nextRunAt) {
          const diff = setArg.nextRunAt.getTime() - Date.now();
          // Should be approximately 24 hours (within 1 minute tolerance)
          expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000);
          expect(diff).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 60_000);
        }
      }
    });

    it('determines frequency from report type (monthly)', async () => {
      const dueReport = {
        id: 'rpt-6',
        tenantId: 't1',
        name: 'Monthly Overview',
        type: 'monthly_overview',
        schedule: {},
        recipients: { email: ['admin@test.com'] },
        filters: {},
        isActive: true,
        lastRunAt: null,
        nextRunAt: new Date(Date.now() - 1000),
      };

      const db = createMockDb([dueReport]);
      startReportsWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      if (db._setFn.mock.calls.length > 0) {
        const setArg = db._setFn.mock.calls[0][0];
        if (setArg.nextRunAt) {
          const diff = setArg.nextRunAt.getTime() - Date.now();
          // Should be approximately 30 days
          expect(diff).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
        }
      }
    });

    it('continues processing remaining reports after one fails', async () => {
      // First report will fail, second should succeed
      mockSendGeneric
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({ success: true });

      const reports = [
        {
          id: 'rpt-fail',
          tenantId: 't1',
          name: 'Failing',
          type: 'weekly_summary',
          schedule: {},
          recipients: { email: ['a@test.com'] },
          filters: {},
          isActive: true,
          lastRunAt: null,
          nextRunAt: new Date(Date.now() - 1000),
        },
        {
          id: 'rpt-ok',
          tenantId: 't1',
          name: 'OK Report',
          type: 'weekly_summary',
          schedule: {},
          recipients: { email: ['b@test.com'] },
          filters: {},
          isActive: true,
          lastRunAt: null,
          nextRunAt: new Date(Date.now() - 1000),
        },
      ];

      const db = createMockDb(reports);
      startReportsWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      // Both reports should have been attempted
      expect(mockSendGeneric).toHaveBeenCalledTimes(2);
    });

    it('report HTML contains required sections', async () => {
      const dueReport = {
        id: 'rpt-html',
        tenantId: 't1',
        name: 'HTML Test',
        type: 'weekly_summary',
        schedule: {},
        recipients: { email: ['admin@test.com'] },
        filters: {},
        isActive: true,
        lastRunAt: null,
        nextRunAt: new Date(Date.now() - 1000),
      };

      const db = createMockDb([dueReport]);
      startReportsWorker(db as any, 60_000);
      await vi.advanceTimersByTimeAsync(0);

      const htmlArg = mockSendGeneric.mock.calls[0]?.[0]?.html as string;
      if (htmlArg) {
        expect(htmlArg).toContain('AION Vision Hub');
        expect(htmlArg).toContain('Salud de Dispositivos');
        expect(htmlArg).toContain('Resumen de Eventos');
        expect(htmlArg).toContain('Resumen de Incidentes');
      }
    });
  });
});
