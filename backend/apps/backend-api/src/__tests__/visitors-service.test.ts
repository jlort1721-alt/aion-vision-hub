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
  visitors: {
    id: 'id',
    tenantId: 'tenant_id',
    fullName: 'full_name',
    siteId: 'site_id',
    documentId: 'document_id',
    phone: 'phone',
    email: 'email',
    company: 'company',
    visitReason: 'visit_reason',
    hostName: 'host_name',
    hostUnit: 'host_unit',
    hostPhone: 'host_phone',
    notes: 'notes',
    isBlacklisted: 'is_blacklisted',
    visitCount: 'visit_count',
    lastVisitAt: 'last_visit_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  visitorPasses: {
    id: 'id',
    tenantId: 'tenant_id',
    visitorId: 'visitor_id',
    siteId: 'site_id',
    qrToken: 'qr_token',
    passType: 'pass_type',
    validFrom: 'valid_from',
    validUntil: 'valid_until',
    status: 'status',
    checkInAt: 'check_in_at',
    checkOutAt: 'check_out_at',
    checkInBy: 'check_in_by',
    authorizedBy: 'authorized_by',
    notes: 'notes',
    metadata: 'metadata',
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
import { VisitorService } from '../modules/visitors/service.js';

describe('VisitorService', () => {
  let service: VisitorService;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const userId = '00000000-0000-0000-0000-000000000099';

  const fakeVisitor = {
    id: 'visitor-001',
    tenantId,
    fullName: 'Juan Perez',
    siteId: 'site-001',
    documentId: 'CC-12345',
    phone: '+57300111222',
    email: 'juan@test.com',
    company: 'ACME',
    visitReason: 'meeting',
    hostName: 'Ana Garcia',
    hostUnit: 'A-301',
    hostPhone: '+57300999888',
    notes: null,
    isBlacklisted: false,
    visitCount: 0,
    lastVisitAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const fakePass = {
    id: 'pass-001',
    tenantId,
    visitorId: 'visitor-001',
    siteId: 'site-001',
    qrToken: 'abc123def456',
    passType: 'single_use',
    validFrom: new Date('2026-04-01'),
    validUntil: new Date('2026-04-30'),
    status: 'active',
    checkInAt: null,
    checkOutAt: null,
    checkInBy: null,
    authorizedBy: userId,
    notes: null,
    metadata: null,
    createdAt: new Date(),
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
    service = new VisitorService();
  });

  // ══════════════════════════════════════════════════════════════
  // LIST VISITORS
  // ══════════════════════════════════════════════════════════════

  describe('list()', () => {
    it('returns paginated visitors for a tenant', async () => {
      const mockWhereCount = vi.fn(() => Promise.resolve([{ count: 1 }]));
      const mockFromCount = vi.fn(() => ({ where: mockWhereCount }));

      const mockOffsetItems = vi.fn(() => Promise.resolve([fakeVisitor]));
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

      const result = await service.list(tenantId, { page: 1, perPage: 20 });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta.page).toBe(1);
      expect(result.meta.perPage).toBe(20);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // GET VISITOR BY ID
  // ══════════════════════════════════════════════════════════════

  describe('getById()', () => {
    it('returns visitor when found', async () => {
      mockLimit.mockResolvedValueOnce([fakeVisitor]);

      const result = await service.getById('visitor-001', tenantId);
      expect(result).toEqual(fakeVisitor);
    });

    it('throws NotFoundError when visitor does not exist', async () => {
      mockLimit.mockResolvedValueOnce([]);

      await expect(service.getById('missing', tenantId)).rejects.toThrow('Visitor');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // CREATE VISITOR
  // ══════════════════════════════════════════════════════════════

  describe('create()', () => {
    it('inserts and returns a new visitor', async () => {
      mockReturning.mockResolvedValueOnce([fakeVisitor]);

      const result = await service.create(
        {
          fullName: 'Juan Perez',
          siteId: 'site-001',
          documentId: 'CC-12345',
          phone: '+57300111222',
          email: 'juan@test.com',
          company: 'ACME',
          visitReason: 'meeting',
          hostName: 'Ana Garcia',
          hostUnit: 'A-301',
          hostPhone: '+57300999888',
        },
        tenantId,
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(fakeVisitor);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // UPDATE VISITOR
  // ══════════════════════════════════════════════════════════════

  describe('update()', () => {
    it('returns updated visitor', async () => {
      const updated = { ...fakeVisitor, fullName: 'Juan Updated' };
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([updated]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      const result = await service.update('visitor-001', { fullName: 'Juan Updated' }, tenantId);
      expect(result.fullName).toBe('Juan Updated');
    });

    it('throws NotFoundError when visitor does not exist', async () => {
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      await expect(service.update('missing', { fullName: 'X' }, tenantId)).rejects.toThrow('Visitor');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // DELETE VISITOR
  // ══════════════════════════════════════════════════════════════

  describe('delete()', () => {
    it('removes a visitor successfully', async () => {
      mockReturning.mockResolvedValueOnce([fakeVisitor]);

      await expect(service.delete('visitor-001', tenantId)).resolves.not.toThrow();
      expect(mockDelete).toHaveBeenCalled();
    });

    it('throws NotFoundError when visitor does not exist', async () => {
      mockReturning.mockResolvedValueOnce([]);

      await expect(service.delete('missing', tenantId)).rejects.toThrow('Visitor');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // CHECK-IN
  // ══════════════════════════════════════════════════════════════

  describe('checkInVisitor()', () => {
    it('sets checkInAt and updates visitor visit count', async () => {
      const checkedIn = { ...fakePass, checkInAt: new Date(), checkInBy: userId };
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([checkedIn]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      // Second update call for visitor visitCount increment
      const mockWhereVisitor = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereVisitor });

      const result = await service.checkInVisitor('pass-001', tenantId, userId);
      expect(result.checkInAt).toBeDefined();
      expect(result.checkInBy).toBe(userId);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // CHECK-OUT
  // ══════════════════════════════════════════════════════════════

  describe('checkOutVisitor()', () => {
    it('sets checkOutAt and marks single_use pass as used', async () => {
      // First: select to get existing pass
      mockLimit.mockResolvedValueOnce([fakePass]);

      // Then: update
      const checkedOut = { ...fakePass, checkOutAt: new Date(), status: 'used' };
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([checkedOut]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      const result = await service.checkOutVisitor('pass-001', tenantId);
      expect(result.checkOutAt).toBeDefined();
      expect(result.status).toBe('used');
    });

    it('throws NotFoundError when pass does not exist', async () => {
      mockLimit.mockResolvedValueOnce([]);

      await expect(service.checkOutVisitor('missing', tenantId)).rejects.toThrow('VisitorPass');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // QR TOKEN GENERATION
  // ══════════════════════════════════════════════════════════════

  describe('generateQRToken()', () => {
    it('returns a 32-character hex string', () => {
      const token = service.generateQRToken();
      expect(token).toHaveLength(32);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });
  });
});
