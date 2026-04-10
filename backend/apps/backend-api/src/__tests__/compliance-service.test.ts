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
  complianceTemplates: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
    type: 'type',
    content: 'content',
    version: 'version',
    isActive: 'is_active',
    approvedBy: 'approved_by',
    approvedAt: 'approved_at',
    createdBy: 'created_by',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  dataRetentionPolicies: {
    id: 'id',
    tenantId: 'tenant_id',
    dataType: 'data_type',
    retentionDays: 'retention_days',
    isActive: 'is_active',
    createdBy: 'created_by',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────
import { ComplianceService } from '../modules/compliance/service.js';

describe('ComplianceService', () => {
  let service: ComplianceService;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const userId = '00000000-0000-0000-0000-000000000099';

  const fakeTemplate = {
    id: 'tpl-001',
    tenantId,
    name: 'Privacy Policy',
    type: 'privacy',
    content: 'Privacy policy content...',
    version: 1,
    isActive: true,
    approvedBy: null,
    approvedAt: null,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const fakePolicy = {
    id: 'policy-001',
    tenantId,
    dataType: 'video_recordings',
    retentionDays: 90,
    isActive: true,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
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
    service = new ComplianceService();
  });

  // ══════════════════════════════════════════════════════════════
  // LIST TEMPLATES
  // ══════════════════════════════════════════════════════════════

  describe('listTemplates()', () => {
    it('returns paginated templates for a tenant', async () => {
      const mockWhereCount = vi.fn(() => Promise.resolve([{ count: 1 }]));
      const mockFromCount = vi.fn(() => ({ where: mockWhereCount }));

      const mockOffsetItems = vi.fn(() => Promise.resolve([fakeTemplate]));
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

      const result = await service.listTemplates(tenantId, { page: 1, perPage: 20 });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta.page).toBe(1);
      expect(result.meta.perPage).toBe(20);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // CREATE TEMPLATE
  // ══════════════════════════════════════════════════════════════

  describe('createTemplate()', () => {
    it('inserts and returns a new template', async () => {
      mockReturning.mockResolvedValueOnce([fakeTemplate]);

      const result = await service.createTemplate(
        tenantId,
        userId,
        { name: 'Privacy Policy', type: 'privacy', content: 'Privacy policy content...', isActive: true },
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(fakeTemplate);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // GET TEMPLATE
  // ══════════════════════════════════════════════════════════════

  describe('getTemplate()', () => {
    it('returns template when found', async () => {
      mockWhere.mockResolvedValueOnce([fakeTemplate]);

      const result = await service.getTemplate(tenantId, 'tpl-001');
      expect(result).toEqual(fakeTemplate);
    });

    it('returns undefined when template does not exist', async () => {
      mockWhere.mockResolvedValueOnce([]);

      const result = await service.getTemplate(tenantId, 'missing');
      expect(result).toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════
  // APPROVE TEMPLATE
  // ══════════════════════════════════════════════════════════════

  describe('approveTemplate()', () => {
    it('sets approvedBy and returns updated template', async () => {
      const approved = { ...fakeTemplate, approvedBy: userId, approvedAt: new Date() };
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([approved]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      const result = await service.approveTemplate(tenantId, 'tpl-001', userId);
      expect(result.approvedBy).toBe(userId);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // DELETE TEMPLATE
  // ══════════════════════════════════════════════════════════════

  describe('deleteTemplate()', () => {
    it('removes a template successfully', async () => {
      mockReturning.mockResolvedValueOnce([fakeTemplate]);

      const result = await service.deleteTemplate(tenantId, 'tpl-001');
      expect(mockDelete).toHaveBeenCalled();
      expect(result).toEqual(fakeTemplate);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // RETENTION POLICIES
  // ══════════════════════════════════════════════════════════════

  describe('createRetentionPolicy()', () => {
    it('inserts and returns a new retention policy', async () => {
      mockReturning.mockResolvedValueOnce([fakePolicy]);

      const result = await service.createRetentionPolicy(
        tenantId,
        userId,
        { dataType: 'video_recordings', retentionDays: 90, isActive: true },
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(fakePolicy);
    });
  });

  describe('listRetentionPolicies()', () => {
    it('returns paginated retention policies', async () => {
      const mockWhereCount = vi.fn(() => Promise.resolve([{ count: 1 }]));
      const mockFromCount = vi.fn(() => ({ where: mockWhereCount }));

      const mockOffsetItems = vi.fn(() => Promise.resolve([fakePolicy]));
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

      const result = await service.listRetentionPolicies(tenantId, { page: 1, perPage: 20 });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
    });
  });
});
