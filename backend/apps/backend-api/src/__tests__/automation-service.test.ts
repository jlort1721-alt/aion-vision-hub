import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock drizzle db ────────────────────────────────────────────────
const mockReturning = vi.fn<any>();
const mockLimit = vi.fn<any>(() => Promise.resolve([]));
const mockOffset = vi.fn<any>(() => Promise.resolve([]));
const mockOrderBy = vi.fn<any>(() => ({ limit: vi.fn(() => ({ offset: mockOffset })) }));
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
  automationRules: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
    description: 'description',
    trigger: 'trigger',
    conditions: 'conditions',
    actions: 'actions',
    priority: 'priority',
    cooldownMinutes: 'cooldown_minutes',
    isActive: 'is_active',
    createdBy: 'created_by',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    lastTriggeredAt: 'last_triggered_at',
    triggerCount: 'trigger_count',
  },
  automationExecutions: {
    id: 'id',
    tenantId: 'tenant_id',
    ruleId: 'rule_id',
    triggerData: 'trigger_data',
    results: 'results',
    status: 'status',
    executionTimeMs: 'execution_time_ms',
    error: 'error',
    createdAt: 'created_at',
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

vi.mock('../services/ewelink-mcp.js', () => ({
  ewelinkMCP: {
    toggleDevice: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@aion/common-utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ─── Import after mocks ─────────────────────────────────────────────
import { AutomationService, getSystemEnabled, setSystemEnabled } from '../modules/automation/service.js';

describe('AutomationService', () => {
  let service: AutomationService;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const userId = '00000000-0000-0000-0000-000000000099';

  const fakeRule = {
    id: 'rule-001',
    tenantId,
    name: 'Motion Detection',
    description: 'Trigger on motion',
    trigger: { type: 'motion_detected' },
    conditions: [],
    actions: [{ type: 'send_alert', config: {} }],
    priority: 10,
    cooldownMinutes: 5,
    isActive: true,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastTriggeredAt: null,
    triggerCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default chain implementations after clearAllMocks
    mockSelect.mockImplementation(() => ({ from: mockFrom }));
    mockFrom.mockImplementation(() => ({ where: mockWhere, orderBy: mockOrderBy }));
    mockWhere.mockImplementation(() => ({ limit: mockLimit, orderBy: mockOrderBy, returning: mockReturning }));
    mockOrderBy.mockImplementation(() => ({ limit: vi.fn(() => ({ offset: mockOffset })) }));
    mockLimit.mockImplementation(() => Promise.resolve([]));
    mockOffset.mockImplementation(() => Promise.resolve([]));
    mockInsert.mockImplementation(() => ({ values: mockInsertValues }));
    mockInsertValues.mockImplementation(() => ({ returning: mockReturning }));
    mockUpdate.mockImplementation(() => ({ set: mockUpdateSet }));
    mockUpdateSet.mockImplementation(() => ({ where: vi.fn<any>(() => ({ returning: mockReturning })) }));
    mockDelete.mockImplementation(() => ({ where: mockDeleteWhere }));
    mockDeleteWhere.mockImplementation(() => ({ returning: mockReturning }));
    service = new AutomationService();
  });

  // ══════════════════════════════════════════════════════════════
  // SYSTEM TOGGLE
  // ══════════════════════════════════════════════════════════════

  describe('system enabled toggle', () => {
    it('returns true by default', () => {
      expect(getSystemEnabled()).toBe(true);
    });

    it('can be toggled off and on', () => {
      setSystemEnabled(false);
      expect(getSystemEnabled()).toBe(false);
      setSystemEnabled(true);
      expect(getSystemEnabled()).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // LIST RULES
  // ══════════════════════════════════════════════════════════════

  describe('listRules()', () => {
    it('returns paginated rules for a tenant', async () => {
      // count query
      const mockWhereCount = vi.fn(() => Promise.resolve([{ count: 1 }]));
      const mockFromCount = vi.fn(() => ({ where: mockWhereCount }));

      // items query
      const mockOffsetItems = vi.fn(() => Promise.resolve([fakeRule]));
      const mockLimitItems = vi.fn(() => ({ offset: mockOffsetItems }));
      const mockOrderByItems = vi.fn(() => ({ limit: mockLimitItems }));
      const mockWhereItems = vi.fn(() => ({ orderBy: mockOrderByItems }));
      const mockFromItems = vi.fn(() => ({ where: mockWhereItems }));

      let callIdx = 0;
      mockSelect.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) return { from: mockFromCount };
        return { from: mockFromItems };
      });

      const result = await service.listRules(tenantId, { page: 1, perPage: 20 });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta.page).toBe(1);
      expect(result.meta.perPage).toBe(20);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // GET RULE BY ID
  // ══════════════════════════════════════════════════════════════

  describe('getRuleById()', () => {
    it('returns rule when found', async () => {
      mockLimit.mockResolvedValueOnce([fakeRule]);

      const result = await service.getRuleById('rule-001', tenantId);
      expect(result).toEqual(fakeRule);
    });

    it('throws NotFoundError when rule does not exist', async () => {
      mockLimit.mockResolvedValueOnce([]);

      await expect(service.getRuleById('missing', tenantId)).rejects.toThrow('AutomationRule');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // CREATE RULE
  // ══════════════════════════════════════════════════════════════

  describe('createRule()', () => {
    it('inserts and returns a new rule', async () => {
      mockReturning.mockResolvedValueOnce([fakeRule]);

      const result = await service.createRule(
        {
          name: 'Motion Detection',
          trigger: { type: 'motion_detected' },
          conditions: [],
          actions: [{ type: 'send_alert', config: {} }],
          priority: 10,
          cooldownMinutes: 5,
          isActive: true,
        },
        tenantId,
        userId,
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(fakeRule);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // UPDATE RULE (toggle isActive)
  // ══════════════════════════════════════════════════════════════

  describe('updateRule()', () => {
    it('toggles isActive and returns updated rule', async () => {
      const toggled = { ...fakeRule, isActive: false };
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([toggled]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      const result = await service.updateRule('rule-001', { isActive: false }, tenantId);
      expect(result.isActive).toBe(false);
    });

    it('throws NotFoundError when rule does not exist', async () => {
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      await expect(service.updateRule('missing', { isActive: false }, tenantId)).rejects.toThrow('AutomationRule');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // DELETE RULE
  // ══════════════════════════════════════════════════════════════

  describe('deleteRule()', () => {
    it('removes a rule successfully', async () => {
      mockReturning.mockResolvedValueOnce([fakeRule]);

      await expect(service.deleteRule('rule-001', tenantId)).resolves.not.toThrow();
      expect(mockDelete).toHaveBeenCalled();
    });

    it('throws NotFoundError when rule does not exist', async () => {
      mockReturning.mockResolvedValueOnce([]);

      await expect(service.deleteRule('missing', tenantId)).rejects.toThrow('AutomationRule');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // LIST EXECUTIONS
  // ══════════════════════════════════════════════════════════════

  describe('listExecutions()', () => {
    it('returns paginated executions for a tenant', async () => {
      const mockWhereCount = vi.fn(() => Promise.resolve([{ count: 0 }]));
      const mockFromCount = vi.fn(() => ({ where: mockWhereCount }));

      const mockOffsetItems = vi.fn(() => Promise.resolve([]));
      const mockLimitItems = vi.fn(() => ({ offset: mockOffsetItems }));
      const mockOrderByItems = vi.fn(() => ({ limit: mockLimitItems }));
      const mockWhereItems = vi.fn(() => ({ orderBy: mockOrderByItems }));
      const mockFromItems = vi.fn(() => ({ where: mockWhereItems }));

      let callIdx = 0;
      mockSelect.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) return { from: mockFromCount };
        return { from: mockFromItems };
      });

      const result = await service.listExecutions(tenantId, { page: 1, perPage: 20 });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta.total).toBe(0);
    });
  });
});
