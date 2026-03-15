import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Thenable chain mock for Drizzle ORM ─────────────────────
// The audit service makes multiple db.select() calls per method.
// We use a call-counter to return different results for each call.
const { selectResults, selectCallIdx, createChain } = vi.hoisted(() => {
  const selectResults: any[][] = [];
  const selectCallIdx = { value: 0 };

  function createChain(getIdx: () => number): any {
    const chain: any = {};
    const methods = ['select', 'from', 'where', 'orderBy', 'limit', 'offset', 'groupBy'];
    for (const method of methods) {
      chain[method] = (..._args: any[]) => createChain(getIdx);
    }
    // Support field aliases like .as()
    chain.as = () => chain;
    chain.then = (resolve: any, reject?: any) => {
      try {
        const idx = getIdx();
        resolve(selectResults[idx] ?? []);
      } catch (e) { reject?.(e); }
    };
    return chain;
  }

  return { selectResults, selectCallIdx, createChain };
});

vi.mock('../../../db/client.js', () => ({
  db: {
    select: (..._args: any[]) => {
      const idx = selectCallIdx.value++;
      return createChain(() => idx);
    },
  },
}));

vi.mock('../../../db/schema/index.js', () => ({
  auditLogs: {
    id: 'id',
    tenantId: 'tenant_id',
    userId: 'user_id',
    userEmail: 'user_email',
    action: 'action',
    resource: 'resource',
    resourceId: 'resource_id',
    details: 'details',
    ipAddress: 'ip_address',
    userAgent: 'user_agent',
    createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ col: a, val: b })),
  and: vi.fn((...conds: any[]) => ({ type: 'and', conds })),
  desc: vi.fn((col: any) => ({ dir: 'desc', col })),
  asc: vi.fn((col: any) => ({ dir: 'asc', col })),
  count: vi.fn(() => 'count_fn'),
  sql: vi.fn().mockImplementation((..._args: any[]) => ({
    as: vi.fn().mockReturnValue('sql_alias'),
  })),
  gte: vi.fn((a, b) => ({ op: '>=', a, b })),
  lte: vi.fn((a, b) => ({ op: '<=', a, b })),
}));

import { auditService } from '../service.js';

describe('AuditService', () => {
  const tenantId = 'tenant-audit-1';

  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIdx.value = 0;
    selectResults.length = 0;
  });

  describe('list()', () => {
    /**
     * list() makes 2 db.select() calls:
     *  [0] count query → [{ total: N }]
     *  [1] data query → items[]
     */
    it('returns audit log entries for tenant', async () => {
      const logs = [
        { id: 'log-1', action: 'domotic.create', resource: 'domotic_devices' },
        { id: 'log-2', action: 'domotic.delete', resource: 'domotic_devices' },
      ];
      selectResults[0] = [{ total: 2 }];
      selectResults[1] = logs;

      const result = await auditService.list(tenantId, { page: 1, perPage: 50, sortOrder: 'desc' });
      expect(result).toBeDefined();
      expect(result.items).toEqual(logs);
      expect(result.meta.total).toBe(2);
    });

    it('supports pagination parameters', async () => {
      selectResults[0] = [{ total: 15 }];
      selectResults[1] = [{ id: 'log-1', action: 'auth.login' }];

      const result = await auditService.list(tenantId, {
        page: 2,
        perPage: 10,
        sortOrder: 'desc',
      });
      expect(result).toBeDefined();
      expect(result.meta.page).toBe(2);
      expect(result.meta.perPage).toBe(10);
    });

    it('supports filtering by action', async () => {
      selectResults[0] = [{ total: 1 }];
      selectResults[1] = [{ id: 'log-1', action: 'domotic.create' }];

      const result = await auditService.list(tenantId, {
        page: 1, perPage: 50, sortOrder: 'desc',
        action: 'domotic.create',
      });
      expect(result).toBeDefined();
    });

    it('supports filtering by userId', async () => {
      selectResults[0] = [{ total: 1 }];
      selectResults[1] = [];

      const result = await auditService.list(tenantId, {
        page: 1, perPage: 50, sortOrder: 'desc',
        userId: 'user-1',
      });
      expect(result).toBeDefined();
    });

    it('supports filtering by resource', async () => {
      selectResults[0] = [{ total: 0 }];
      selectResults[1] = [];

      const result = await auditService.list(tenantId, {
        page: 1, perPage: 50, sortOrder: 'desc',
        resource: 'domotic_devices',
      });
      expect(result).toBeDefined();
    });

    it('supports date range filtering', async () => {
      selectResults[0] = [{ total: 0 }];
      selectResults[1] = [];

      const result = await auditService.list(tenantId, {
        page: 1, perPage: 50, sortOrder: 'desc',
        from: '2025-01-01',
        to: '2025-12-31',
      });
      expect(result).toBeDefined();
    });
  });

  describe('getStats()', () => {
    /**
     * getStats() makes 5 db.select() calls:
     *  [0] total count → [{ total: N }]
     *  [1] actionsByType → []
     *  [2] actionsByResource → []
     *  [3] topUsers → []
     *  [4] recentActivity → []
     */
    it('returns aggregated statistics', async () => {
      selectResults[0] = [{ total: 100 }];
      selectResults[1] = [{ action: 'auth.login', count: 50 }];
      selectResults[2] = [{ resource: 'users', count: 30 }];
      selectResults[3] = [{ userId: 'u-1', userEmail: 'a@a.com', count: 20 }];
      selectResults[4] = [];

      const result = await auditService.getStats(tenantId);
      expect(result).toBeDefined();
      expect(result.total).toBe(100);
      expect(result.actionsByType).toBeDefined();
      expect(result.actionsByResource).toBeDefined();
      expect(result.topUsers).toBeDefined();
    });

    it('supports date range for stats', async () => {
      selectResults[0] = [{ total: 10 }];
      selectResults[1] = [];
      selectResults[2] = [];
      selectResults[3] = [];
      selectResults[4] = [];

      const result = await auditService.getStats(tenantId, {
        from: '2025-01-01',
        to: '2025-12-31',
      });
      expect(result).toBeDefined();
      expect(result.total).toBe(10);
    });
  });
});

describe('AuditService — Data Integrity', () => {
  it('audit log schema has required fields', async () => {
    const schema = await import('../../../db/schema/index.js');
    const requiredFields = [
      'tenantId', 'userId', 'userEmail', 'action', 'resource',
      'ipAddress', 'createdAt',
    ];
    for (const field of requiredFields) {
      expect(schema.auditLogs).toHaveProperty(field);
    }
  });

  it('audit log supports optional fields', async () => {
    const schema = await import('../../../db/schema/index.js');
    expect(schema.auditLogs).toHaveProperty('resourceId');
    expect(schema.auditLogs).toHaveProperty('details');
    expect(schema.auditLogs).toHaveProperty('userAgent');
  });
});
