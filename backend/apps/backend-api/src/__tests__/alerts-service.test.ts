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
  alertRules: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
    severity: 'severity',
    isActive: 'is_active',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  alertInstances: {
    id: 'id',
    tenantId: 'tenant_id',
    ruleId: 'rule_id',
    severity: 'severity',
    status: 'status',
    acknowledgedBy: 'acknowledged_by',
    acknowledgedAt: 'acknowledged_at',
    resolvedBy: 'resolved_by',
    resolvedAt: 'resolved_at',
    nextEscalationAt: 'next_escalation_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  escalationPolicies: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  notificationChannels: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
    type: 'type',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  notificationLog: {
    id: 'id',
    tenantId: 'tenant_id',
    type: 'type',
    status: 'status',
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

// ─── Import after mocks ─────────────────────────────────────────────
import { AlertService } from '../modules/alerts/service.js';

describe('AlertService', () => {
  let service: AlertService;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const userId = '00000000-0000-0000-0000-000000000099';

  const fakeRule = {
    id: 'rule-001',
    tenantId,
    name: 'High CPU Alert',
    description: 'Alert when CPU > 90%',
    conditions: { metric: 'cpu', threshold: 90 },
    actions: ['email'],
    severity: 'high',
    cooldownMinutes: 5,
    isActive: true,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const fakeInstance = {
    id: 'instance-001',
    tenantId,
    ruleId: 'rule-001',
    severity: 'high',
    status: 'firing',
    acknowledgedBy: null,
    acknowledgedAt: null,
    resolvedBy: null,
    resolvedAt: null,
    nextEscalationAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const fakePolicy = {
    id: 'policy-001',
    tenantId,
    name: 'Default Escalation',
    description: 'Standard escalation policy',
    levels: [{ delayMinutes: 5, channels: ['email'] }],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const fakeChannel = {
    id: 'channel-001',
    tenantId,
    name: 'Email Channel',
    type: 'email',
    config: { address: 'alerts@test.com' },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AlertService();
  });

  // ══════════════════════════════════════════════════════════════
  // ALERT RULES
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

  describe('getRuleById()', () => {
    it('returns rule when found', async () => {
      mockLimit.mockResolvedValueOnce([fakeRule]);

      const result = await service.getRuleById('rule-001', tenantId);
      expect(result).toEqual(fakeRule);
    });

    it('throws NotFoundError when rule does not exist', async () => {
      mockLimit.mockResolvedValueOnce([]);

      await expect(service.getRuleById('missing', tenantId)).rejects.toThrow('AlertRule');
    });
  });

  describe('createRule()', () => {
    it('inserts and returns a new rule', async () => {
      mockReturning.mockResolvedValueOnce([fakeRule]);

      const result = await service.createRule(
        {
          name: 'High CPU Alert',
          conditions: { metric: 'cpu', threshold: 90 },
          actions: ['email'],
          severity: 'high',
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

  describe('updateRule()', () => {
    it('returns updated rule', async () => {
      const updated = { ...fakeRule, name: 'Updated Alert' };
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([updated]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      const result = await service.updateRule('rule-001', { name: 'Updated Alert' }, tenantId);
      expect(result.name).toBe('Updated Alert');
    });

    it('throws NotFoundError when rule does not exist', async () => {
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      await expect(service.updateRule('missing', { name: 'X' }, tenantId)).rejects.toThrow('AlertRule');
    });
  });

  describe('deleteRule()', () => {
    it('removes a rule successfully', async () => {
      mockReturning.mockResolvedValueOnce([fakeRule]);

      await expect(service.deleteRule('rule-001', tenantId)).resolves.not.toThrow();
      expect(mockDelete).toHaveBeenCalled();
    });

    it('throws NotFoundError when rule does not exist', async () => {
      mockReturning.mockResolvedValueOnce([]);

      await expect(service.deleteRule('missing', tenantId)).rejects.toThrow('AlertRule');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // ALERT INSTANCES
  // ══════════════════════════════════════════════════════════════

  describe('getInstanceById()', () => {
    it('returns instance when found', async () => {
      mockLimit.mockResolvedValueOnce([fakeInstance]);

      const result = await service.getInstanceById('instance-001', tenantId);
      expect(result).toEqual(fakeInstance);
    });

    it('throws NotFoundError when instance does not exist', async () => {
      mockLimit.mockResolvedValueOnce([]);

      await expect(service.getInstanceById('missing', tenantId)).rejects.toThrow('AlertInstance');
    });
  });

  describe('acknowledgeInstance()', () => {
    it('updates instance status to acknowledged', async () => {
      const acknowledged = { ...fakeInstance, status: 'acknowledged', acknowledgedBy: userId };
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([acknowledged]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      const result = await service.acknowledgeInstance('instance-001', tenantId, userId);
      expect(result.status).toBe('acknowledged');
      expect(result.acknowledgedBy).toBe(userId);
    });

    it('throws NotFoundError when instance does not exist', async () => {
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      await expect(service.acknowledgeInstance('missing', tenantId, userId)).rejects.toThrow('AlertInstance');
    });
  });

  describe('resolveInstance()', () => {
    it('updates instance status to resolved', async () => {
      const resolved = { ...fakeInstance, status: 'resolved', resolvedBy: userId };
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([resolved]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      const result = await service.resolveInstance('instance-001', tenantId, userId);
      expect(result.status).toBe('resolved');
      expect(result.resolvedBy).toBe(userId);
    });

    it('throws NotFoundError when instance does not exist', async () => {
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      await expect(service.resolveInstance('missing', tenantId, userId)).rejects.toThrow('AlertInstance');
    });
  });

  describe('getInstanceStats()', () => {
    it('returns aggregated stats', async () => {
      mockWhere.mockResolvedValueOnce([{
        total: 10,
        firing: 3,
        acknowledged: 4,
        resolved: 3,
        critical: 1,
        high: 2,
      }]);

      const result = await service.getInstanceStats(tenantId);

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('byStatus');
      expect(result).toHaveProperty('activeCritical');
      expect(result).toHaveProperty('activeHigh');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // ESCALATION POLICIES
  // ══════════════════════════════════════════════════════════════

  describe('listPolicies()', () => {
    it('returns policies for a tenant', async () => {
      mockOrderBy.mockReturnValueOnce(Promise.resolve([fakePolicy]));
      mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });

      const result = await service.listPolicies(tenantId);

      expect(mockSelect).toHaveBeenCalled();
    });
  });

  describe('createPolicy()', () => {
    it('inserts and returns a new policy', async () => {
      mockReturning.mockResolvedValueOnce([fakePolicy]);

      const result = await service.createPolicy(
        {
          name: 'Default Escalation',
          levels: [{ delayMinutes: 5, channels: ['email'] }],
          isActive: true,
        },
        tenantId,
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(fakePolicy);
    });
  });

  describe('updatePolicy()', () => {
    it('returns updated policy', async () => {
      const updated = { ...fakePolicy, name: 'Updated Policy' };
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([updated]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      const result = await service.updatePolicy('policy-001', { name: 'Updated Policy' }, tenantId);
      expect(result.name).toBe('Updated Policy');
    });

    it('throws NotFoundError when policy does not exist', async () => {
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      await expect(service.updatePolicy('missing', { name: 'X' }, tenantId)).rejects.toThrow('EscalationPolicy');
    });
  });

  describe('deletePolicy()', () => {
    it('removes a policy successfully', async () => {
      mockReturning.mockResolvedValueOnce([fakePolicy]);

      await expect(service.deletePolicy('policy-001', tenantId)).resolves.not.toThrow();
      expect(mockDelete).toHaveBeenCalled();
    });

    it('throws NotFoundError when policy does not exist', async () => {
      mockReturning.mockResolvedValueOnce([]);

      await expect(service.deletePolicy('missing', tenantId)).rejects.toThrow('EscalationPolicy');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // NOTIFICATION CHANNELS
  // ══════════════════════════════════════════════════════════════

  describe('listChannels()', () => {
    it('returns channels for a tenant', async () => {
      mockOrderBy.mockReturnValueOnce(Promise.resolve([fakeChannel]));
      mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });

      const result = await service.listChannels(tenantId);

      expect(mockSelect).toHaveBeenCalled();
    });
  });

  describe('createChannel()', () => {
    it('inserts and returns a new channel', async () => {
      mockReturning.mockResolvedValueOnce([fakeChannel]);

      const result = await service.createChannel(
        { name: 'Email Channel', type: 'email', config: { address: 'alerts@test.com' }, isActive: true },
        tenantId,
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(fakeChannel);
    });
  });

  describe('updateChannel()', () => {
    it('returns updated channel', async () => {
      const updated = { ...fakeChannel, name: 'Updated Channel' };
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([updated]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      const result = await service.updateChannel('channel-001', { name: 'Updated Channel' }, tenantId);
      expect(result.name).toBe('Updated Channel');
    });

    it('throws NotFoundError when channel does not exist', async () => {
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      await expect(service.updateChannel('missing', { name: 'X' }, tenantId)).rejects.toThrow('NotificationChannel');
    });
  });

  describe('deleteChannel()', () => {
    it('removes a channel successfully', async () => {
      mockReturning.mockResolvedValueOnce([fakeChannel]);

      await expect(service.deleteChannel('channel-001', tenantId)).resolves.not.toThrow();
      expect(mockDelete).toHaveBeenCalled();
    });

    it('throws NotFoundError when channel does not exist', async () => {
      mockReturning.mockResolvedValueOnce([]);

      await expect(service.deleteChannel('missing', tenantId)).rejects.toThrow('NotificationChannel');
    });
  });
});
