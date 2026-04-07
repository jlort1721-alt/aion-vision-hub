import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock drizzle db ────────────────────────────────────────────────
const mockReturning = vi.fn<any>();
const mockLimit = vi.fn<any>(() => Promise.resolve([]));
const mockOrderBy = vi.fn<any>(() => ({ limit: vi.fn(() => ({ offset: vi.fn(() => Promise.resolve([])) })) }));
const mockWhere = vi.fn<any>(() => ({
  limit: mockLimit,
  orderBy: vi.fn<any>(() => ({ limit: vi.fn<any>(() => Promise.resolve([])) })),
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
  accessPeople: {
    id: 'id',
    tenantId: 'tenant_id',
    sectionId: 'section_id',
    type: 'type',
    fullName: 'full_name',
    phone: 'phone',
    documentId: 'document_id',
    unit: 'unit',
    email: 'email',
    status: 'status',
    updatedAt: 'updated_at',
  },
  accessVehicles: {
    id: 'id',
    tenantId: 'tenant_id',
    personId: 'person_id',
    plate: 'plate',
    brand: 'brand',
    model: 'model',
    color: 'color',
    type: 'type',
    status: 'status',
  },
  accessLogs: {
    id: 'id',
    tenantId: 'tenant_id',
    sectionId: 'section_id',
    personId: 'person_id',
    direction: 'direction',
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
import { accessControlService } from '../modules/access-control/service.js';

describe('AccessControlService', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const personId = '00000000-0000-0000-0000-000000000010';
  const vehicleId = '00000000-0000-0000-0000-000000000020';

  const fakePerson = {
    id: personId,
    tenantId,
    sectionId: null,
    type: 'resident',
    fullName: 'Juan Perez',
    documentId: '12345678',
    phone: '+573001234567',
    email: 'juan@test.com',
    unit: '101',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const fakeVehicle = {
    id: vehicleId,
    tenantId,
    personId,
    plate: 'ABC123',
    brand: 'Toyota',
    model: 'Corolla',
    color: 'White',
    type: 'car',
    status: 'active',
    createdAt: new Date(),
  };

  const fakeLog = {
    id: '00000000-0000-0000-0000-000000000030',
    tenantId,
    sectionId: null,
    personId,
    vehicleId: null,
    direction: 'in',
    method: 'manual',
    operatorId: 'op-1',
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mockSelect to its default implementation after tests that override it
    mockSelect.mockImplementation(() => ({ from: mockFrom }));
  });

  // ─── Service exports ──────────────────────────────────────────
  it('exports accessControlService as a singleton', () => {
    expect(accessControlService).toBeDefined();
    expect(typeof accessControlService.listPeople).toBe('function');
    expect(typeof accessControlService.getPersonById).toBe('function');
    expect(typeof accessControlService.createPerson).toBe('function');
    expect(typeof accessControlService.updatePerson).toBe('function');
    expect(typeof accessControlService.deletePerson).toBe('function');
    expect(typeof accessControlService.listVehicles).toBe('function');
    expect(typeof accessControlService.createVehicle).toBe('function');
    expect(typeof accessControlService.updateVehicle).toBe('function');
    expect(typeof accessControlService.deleteVehicle).toBe('function');
    expect(typeof accessControlService.listLogs).toBe('function');
    expect(typeof accessControlService.createLog).toBe('function');
  });

  // ══════════════════════════════════════════════════════════════
  // PEOPLE
  // ══════════════════════════════════════════════════════════════

  describe('listPeople()', () => {
    it('returns paginated people list for a tenant', async () => {
      // count query
      mockSelect.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => ({ offset: vi.fn(() => Promise.resolve([fakePerson])) })) })) })),
        })),
      });
      // items query returns via orderBy -> limit -> offset chain
      mockSelect.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve([{ count: 1 }])),
        })),
      });

      // The service uses Promise.all for items + count. Reset and use simpler approach:
      vi.clearAllMocks();

      // items query
      const mockOffset = vi.fn(() => Promise.resolve([fakePerson]));
      const mockLimitInner = vi.fn(() => ({ offset: mockOffset }));
      const mockOrderByInner = vi.fn(() => ({ limit: mockLimitInner }));
      const mockWhereItems = vi.fn(() => ({ orderBy: mockOrderByInner }));
      const mockFromItems = vi.fn(() => ({ where: mockWhereItems }));

      // count query
      const mockWhereCount = vi.fn(() => Promise.resolve([{ count: 1 }]));
      const mockFromCount = vi.fn(() => ({ where: mockWhereCount }));

      let callIdx = 0;
      mockSelect.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) return { from: mockFromItems };
        return { from: mockFromCount };
      });

      const result = await accessControlService.listPeople(tenantId);

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toHaveProperty('page', 1);
      expect(result.meta).toHaveProperty('perPage', 50);
    });

    it('applies search filter when provided', async () => {
      const mockOffset = vi.fn(() => Promise.resolve([]));
      const mockLimitInner = vi.fn(() => ({ offset: mockOffset }));
      const mockOrderByInner = vi.fn(() => ({ limit: mockLimitInner }));
      const mockWhereItems = vi.fn(() => ({ orderBy: mockOrderByInner }));
      const mockFromItems = vi.fn(() => ({ where: mockWhereItems }));
      const mockWhereCount = vi.fn(() => Promise.resolve([{ count: 0 }]));
      const mockFromCount = vi.fn(() => ({ where: mockWhereCount }));

      let callIdx = 0;
      mockSelect.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) return { from: mockFromItems };
        return { from: mockFromCount };
      });

      const result = await accessControlService.listPeople(tenantId, { search: 'Juan' });

      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('getPersonById()', () => {
    it('returns person when found', async () => {
      mockLimit.mockResolvedValueOnce([fakePerson]);

      const result = await accessControlService.getPersonById(personId, tenantId);
      expect(result).toEqual(fakePerson);
    });

    it('throws NotFoundError when person does not exist', async () => {
      mockLimit.mockResolvedValueOnce([]);

      await expect(accessControlService.getPersonById('missing', tenantId)).rejects.toThrow('Person');
    });
  });

  describe('createPerson()', () => {
    it('inserts and returns a new person', async () => {
      mockReturning.mockResolvedValueOnce([fakePerson]);

      const result = await accessControlService.createPerson(
        { fullName: 'Juan Perez', type: 'resident' },
        tenantId,
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(fakePerson);
    });
  });

  describe('updatePerson()', () => {
    it('returns updated person', async () => {
      const updated = { ...fakePerson, fullName: 'Juan Updated' };
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([updated]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      const result = await accessControlService.updatePerson(personId, { fullName: 'Juan Updated' }, tenantId);
      expect(result.fullName).toBe('Juan Updated');
    });

    it('throws NotFoundError when person does not exist', async () => {
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      await expect(accessControlService.updatePerson('missing', { fullName: 'X' }, tenantId)).rejects.toThrow('Person');
    });
  });

  describe('deletePerson()', () => {
    it('removes a person successfully', async () => {
      mockReturning.mockResolvedValueOnce([fakePerson]);

      await expect(accessControlService.deletePerson(personId, tenantId)).resolves.not.toThrow();
      expect(mockDelete).toHaveBeenCalled();
    });

    it('throws NotFoundError when person does not exist', async () => {
      mockReturning.mockResolvedValueOnce([]);

      await expect(accessControlService.deletePerson('missing', tenantId)).rejects.toThrow('Person');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // VEHICLES
  // ══════════════════════════════════════════════════════════════

  describe('listVehicles()', () => {
    it('returns paginated vehicles for a tenant', async () => {
      const mockOffset = vi.fn(() => Promise.resolve([fakeVehicle]));
      const mockLimitInner = vi.fn(() => ({ offset: mockOffset }));
      const mockOrderByInner = vi.fn(() => ({ limit: mockLimitInner }));
      const mockWhereItems = vi.fn(() => ({ orderBy: mockOrderByInner }));
      const mockFromItems = vi.fn(() => ({ where: mockWhereItems }));
      const mockWhereCount = vi.fn(() => Promise.resolve([{ count: 1 }]));
      const mockFromCount = vi.fn(() => ({ where: mockWhereCount }));

      let callIdx = 0;
      mockSelect.mockImplementation(() => {
        callIdx++;
        if (callIdx === 1) return { from: mockFromItems };
        return { from: mockFromCount };
      });

      const result = await accessControlService.listVehicles(tenantId);

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
    });
  });

  describe('createVehicle()', () => {
    it('inserts and returns a new vehicle', async () => {
      mockReturning.mockResolvedValueOnce([fakeVehicle]);

      const result = await accessControlService.createVehicle(
        { personId, plate: 'ABC123', type: 'car' },
        tenantId,
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(fakeVehicle);
    });
  });

  describe('updateVehicle()', () => {
    it('returns updated vehicle', async () => {
      const updated = { ...fakeVehicle, plate: 'XYZ999' };
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([updated]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      const result = await accessControlService.updateVehicle(vehicleId, { plate: 'XYZ999' }, tenantId);
      expect(result.plate).toBe('XYZ999');
    });

    it('throws NotFoundError when vehicle does not exist', async () => {
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      await expect(accessControlService.updateVehicle('missing', { plate: 'X' }, tenantId)).rejects.toThrow('Vehicle');
    });
  });

  describe('deleteVehicle()', () => {
    it('removes a vehicle successfully', async () => {
      mockReturning.mockResolvedValueOnce([fakeVehicle]);

      await expect(accessControlService.deleteVehicle(vehicleId, tenantId)).resolves.not.toThrow();
    });

    it('throws NotFoundError when vehicle does not exist', async () => {
      mockReturning.mockResolvedValueOnce([]);

      await expect(accessControlService.deleteVehicle('missing', tenantId)).rejects.toThrow('Vehicle');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // ACCESS LOGS
  // ══════════════════════════════════════════════════════════════

  describe('listLogs()', () => {
    it('returns access logs for a tenant', async () => {
      const mockLimitLogs = vi.fn(() => Promise.resolve([fakeLog]));
      const mockOrderByLogs = vi.fn(() => ({ limit: mockLimitLogs }));
      const mockWhereLogs = vi.fn(() => ({ orderBy: mockOrderByLogs }));
      const mockFromLogs = vi.fn(() => ({ where: mockWhereLogs }));
      mockSelect.mockImplementationOnce(() => ({ from: mockFromLogs }));

      const result = await accessControlService.listLogs(tenantId);

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual([fakeLog]);
    });
  });

  describe('createLog()', () => {
    it('inserts and returns a new access log', async () => {
      mockReturning.mockResolvedValueOnce([fakeLog]);

      const result = await accessControlService.createLog(
        { direction: 'in', method: 'manual' },
        'operator-1',
        tenantId,
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(fakeLog);
    });
  });
});
