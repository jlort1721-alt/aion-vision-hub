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
  shifts: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
    siteId: 'site_id',
    startTime: 'start_time',
    endTime: 'end_time',
    daysOfWeek: 'days_of_week',
    maxGuards: 'max_guards',
    description: 'description',
    isActive: 'is_active',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  shiftAssignments: {
    id: 'id',
    tenantId: 'tenant_id',
    shiftId: 'shift_id',
    userId: 'user_id',
    date: 'date',
    status: 'status',
    checkInAt: 'check_in_at',
    checkOutAt: 'check_out_at',
    checkInLocation: 'check_in_location',
    notes: 'notes',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  profiles: {
    id: 'id',
    fullName: 'full_name',
    email: 'email',
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
import { ShiftService } from '../modules/shifts/service.js';

describe('ShiftService', () => {
  let service: ShiftService;
  const tenantId = '00000000-0000-0000-0000-000000000001';

  const fakeShift = {
    id: 'shift-001',
    tenantId,
    name: 'Morning Shift',
    siteId: 'site-001',
    startTime: '06:00',
    endTime: '14:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    maxGuards: 3,
    description: 'Morning patrol',
    isActive: true,
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
    service = new ShiftService();
  });

  // ══════════════════════════════════════════════════════════════
  // LIST SHIFTS
  // ══════════════════════════════════════════════════════════════

  describe('listShifts()', () => {
    it('returns paginated shifts for a tenant', async () => {
      const mockWhereCount = vi.fn(() => Promise.resolve([{ count: 1 }]));
      const mockFromCount = vi.fn(() => ({ where: mockWhereCount }));

      const mockOffsetItems = vi.fn(() => Promise.resolve([fakeShift]));
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

      const result = await service.listShifts(tenantId, { page: 1, perPage: 20 });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta.page).toBe(1);
      expect(result.meta.perPage).toBe(20);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // GET SHIFT BY ID
  // ══════════════════════════════════════════════════════════════

  describe('getShiftById()', () => {
    it('returns shift when found', async () => {
      mockLimit.mockResolvedValueOnce([fakeShift]);

      const result = await service.getShiftById('shift-001', tenantId);
      expect(result).toEqual(fakeShift);
    });

    it('throws NotFoundError when shift does not exist', async () => {
      mockLimit.mockResolvedValueOnce([]);

      await expect(service.getShiftById('missing', tenantId)).rejects.toThrow('Shift');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // CREATE SHIFT
  // ══════════════════════════════════════════════════════════════

  describe('createShift()', () => {
    it('inserts and returns a new shift', async () => {
      mockReturning.mockResolvedValueOnce([fakeShift]);

      const result = await service.createShift(
        {
          name: 'Morning Shift',
          siteId: 'site-001',
          startTime: '06:00',
          endTime: '14:00',
          daysOfWeek: [1, 2, 3, 4, 5],
          maxGuards: 3,
          description: 'Morning patrol',
          isActive: true,
        },
        tenantId,
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(fakeShift);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // UPDATE SHIFT
  // ══════════════════════════════════════════════════════════════

  describe('updateShift()', () => {
    it('returns updated shift', async () => {
      const updated = { ...fakeShift, name: 'Evening Shift' };
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([updated]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      const result = await service.updateShift('shift-001', { name: 'Evening Shift' }, tenantId);
      expect(result.name).toBe('Evening Shift');
    });

    it('throws NotFoundError when shift does not exist', async () => {
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      await expect(service.updateShift('missing', { name: 'X' }, tenantId)).rejects.toThrow('Shift');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // DELETE SHIFT
  // ══════════════════════════════════════════════════════════════

  describe('deleteShift()', () => {
    it('removes a shift successfully', async () => {
      mockReturning.mockResolvedValueOnce([fakeShift]);

      await expect(service.deleteShift('shift-001', tenantId)).resolves.not.toThrow();
      expect(mockDelete).toHaveBeenCalled();
    });

    it('throws NotFoundError when shift does not exist', async () => {
      mockReturning.mockResolvedValueOnce([]);

      await expect(service.deleteShift('missing', tenantId)).rejects.toThrow('Shift');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // CREATE ASSIGNMENT
  // ══════════════════════════════════════════════════════════════

  describe('createAssignment()', () => {
    it('inserts and returns a new assignment', async () => {
      const fakeAssignment = {
        id: 'assign-001',
        tenantId,
        shiftId: 'shift-001',
        userId: 'user-001',
        date: new Date(),
        status: 'scheduled',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockReturning.mockResolvedValueOnce([fakeAssignment]);

      const result = await service.createAssignment(
        {
          shiftId: 'shift-001',
          userId: 'user-001',
          date: '2026-04-10',
          status: 'scheduled',
        },
        tenantId,
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(fakeAssignment);
    });
  });
});
