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
  emergencyProtocols: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
    type: 'type',
    description: 'description',
    steps: 'steps',
    autoActions: 'auto_actions',
    priority: 'priority',
    isActive: 'is_active',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  emergencyContacts: {
    id: 'id',
    tenantId: 'tenant_id',
    siteId: 'site_id',
    name: 'name',
    role: 'role',
    phone: 'phone',
    email: 'email',
    priority: 'priority',
    availableHours: 'available_hours',
    isActive: 'is_active',
    createdAt: 'created_at',
  },
  emergencyActivations: {
    id: 'id',
    tenantId: 'tenant_id',
    protocolId: 'protocol_id',
    siteId: 'site_id',
    activatedBy: 'activated_by',
    status: 'status',
    timeline: 'timeline',
    resolvedBy: 'resolved_by',
    resolvedAt: 'resolved_at',
    resolution: 'resolution',
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

// ─── Import after mocks ─────────────────────────────────────────────
import { EmergencyService } from '../modules/emergency/service.js';

describe('EmergencyService', () => {
  let service: EmergencyService;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const userId = '00000000-0000-0000-0000-000000000099';

  const fakeProtocol = {
    id: 'proto-001',
    tenantId,
    name: 'Fire Evacuation',
    type: 'fire',
    description: 'Fire evacuation protocol',
    steps: [{ order: 1, description: 'Sound alarm' }],
    autoActions: [{ type: 'send_alert' }],
    priority: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const fakeContact = {
    id: 'contact-001',
    tenantId,
    siteId: 'site-001',
    name: 'Carlos Rivera',
    role: 'security_chief',
    phone: '+57300123456',
    email: 'carlos@test.com',
    priority: 1,
    availableHours: '24/7',
    isActive: true,
    createdAt: new Date(),
  };

  const fakeActivation = {
    id: 'activation-001',
    tenantId,
    protocolId: 'proto-001',
    siteId: 'site-001',
    activatedBy: userId,
    status: 'active',
    timeline: [{ action: 'activated', by: userId, at: new Date().toISOString(), note: 'Protocol activated' }],
    resolvedBy: null,
    resolvedAt: null,
    resolution: null,
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
    service = new EmergencyService();
  });

  // ══════════════════════════════════════════════════════════════
  // LIST PROTOCOLS
  // ══════════════════════════════════════════════════════════════

  describe('listProtocols()', () => {
    it('returns paginated protocols for a tenant', async () => {
      const mockWhereCount = vi.fn(() => Promise.resolve([{ count: 1 }]));
      const mockFromCount = vi.fn(() => ({ where: mockWhereCount }));

      const mockOffsetItems = vi.fn(() => Promise.resolve([fakeProtocol]));
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

      const result = await service.listProtocols(tenantId, { page: 1, perPage: 20 });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta.page).toBe(1);
      expect(result.meta.perPage).toBe(20);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // GET PROTOCOL BY ID
  // ══════════════════════════════════════════════════════════════

  describe('getProtocolById()', () => {
    it('returns protocol when found', async () => {
      mockLimit.mockResolvedValueOnce([fakeProtocol]);

      const result = await service.getProtocolById('proto-001', tenantId);
      expect(result).toEqual(fakeProtocol);
    });

    it('throws NotFoundError when protocol does not exist', async () => {
      mockLimit.mockResolvedValueOnce([]);

      await expect(service.getProtocolById('missing', tenantId)).rejects.toThrow('EmergencyProtocol');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // CREATE PROTOCOL
  // ══════════════════════════════════════════════════════════════

  describe('createProtocol()', () => {
    it('inserts and returns a new protocol', async () => {
      mockReturning.mockResolvedValueOnce([fakeProtocol]);

      const result = await service.createProtocol(
        {
          name: 'Fire Evacuation',
          type: 'fire',
          description: 'Fire evacuation protocol',
          steps: [{ order: 1, description: 'Sound alarm' }],
          autoActions: [{ type: 'send_alert' }],
          priority: 1,
          isActive: true,
        },
        tenantId,
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(fakeProtocol);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // UPDATE PROTOCOL
  // ══════════════════════════════════════════════════════════════

  describe('updateProtocol()', () => {
    it('returns updated protocol', async () => {
      const updated = { ...fakeProtocol, name: 'Updated Protocol' };
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([updated]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      const result = await service.updateProtocol('proto-001', { name: 'Updated Protocol' }, tenantId);
      expect(result.name).toBe('Updated Protocol');
    });

    it('throws NotFoundError when protocol does not exist', async () => {
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      await expect(service.updateProtocol('missing', { name: 'X' }, tenantId)).rejects.toThrow('EmergencyProtocol');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // DELETE PROTOCOL
  // ══════════════════════════════════════════════════════════════

  describe('deleteProtocol()', () => {
    it('removes a protocol successfully', async () => {
      mockReturning.mockResolvedValueOnce([fakeProtocol]);

      await expect(service.deleteProtocol('proto-001', tenantId)).resolves.not.toThrow();
      expect(mockDelete).toHaveBeenCalled();
    });

    it('throws NotFoundError when protocol does not exist', async () => {
      mockReturning.mockResolvedValueOnce([]);

      await expect(service.deleteProtocol('missing', tenantId)).rejects.toThrow('EmergencyProtocol');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // LIST CONTACTS
  // ══════════════════════════════════════════════════════════════

  describe('listContacts()', () => {
    it('returns paginated contacts for a tenant', async () => {
      const mockWhereCount = vi.fn(() => Promise.resolve([{ count: 1 }]));
      const mockFromCount = vi.fn(() => ({ where: mockWhereCount }));

      const mockOffsetItems = vi.fn(() => Promise.resolve([fakeContact]));
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

      const result = await service.listContacts(tenantId, { page: 1, perPage: 20 });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
      expect(result.meta.page).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // CREATE CONTACT
  // ══════════════════════════════════════════════════════════════

  describe('createContact()', () => {
    it('inserts and returns a new contact', async () => {
      mockReturning.mockResolvedValueOnce([fakeContact]);

      const result = await service.createContact(
        {
          siteId: 'site-001',
          name: 'Carlos Rivera',
          role: 'security_chief',
          phone: '+57300123456',
          email: 'carlos@test.com',
          priority: 1,
          availableHours: '24/7',
          isActive: true,
        },
        tenantId,
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(fakeContact);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // ACTIVATE PROTOCOL
  // ══════════════════════════════════════════════════════════════

  describe('activateProtocol()', () => {
    it('creates a new activation with initial timeline', async () => {
      mockReturning.mockResolvedValueOnce([fakeActivation]);

      const result = await service.activateProtocol(
        { protocolId: 'proto-001', siteId: 'site-001' },
        tenantId,
        userId,
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(fakeActivation);
      expect(result.status).toBe('active');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // RESOLVE ACTIVATION
  // ══════════════════════════════════════════════════════════════

  describe('resolveActivation()', () => {
    it('marks activation as resolved and appends to timeline', async () => {
      // getActivationById call
      mockLimit.mockResolvedValueOnce([fakeActivation]);

      // update call
      const resolved = { ...fakeActivation, status: 'resolved', resolvedBy: userId, resolvedAt: new Date() };
      const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([resolved]) }));
      mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

      const result = await service.resolveActivation('activation-001', tenantId, userId, 'Fire contained');
      expect(result.status).toBe('resolved');
      expect(result.resolvedBy).toBe(userId);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // DELETE CONTACT
  // ══════════════════════════════════════════════════════════════

  describe('deleteContact()', () => {
    it('removes a contact successfully', async () => {
      mockReturning.mockResolvedValueOnce([fakeContact]);

      await expect(service.deleteContact('contact-001', tenantId)).resolves.not.toThrow();
      expect(mockDelete).toHaveBeenCalled();
    });

    it('throws NotFoundError when contact does not exist', async () => {
      mockReturning.mockResolvedValueOnce([]);

      await expect(service.deleteContact('missing', tenantId)).rejects.toThrow('EmergencyContact');
    });
  });
});
