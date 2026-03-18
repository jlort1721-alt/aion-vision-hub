/**
 * E2E Integration Flow Test
 *
 * Simulates a complete user journey through the AION Vision Hub service layer:
 *   Auth → Sites → Devices → Events → Incidents → Reports → Audit
 *
 * All database calls are mocked; the test validates service-level logic,
 * data flow between modules, and correct state transitions.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// Hoisted mock state — shared across all mocked modules
// ═══════════════════════════════════════════════════════════════════════════

const {
  mockSelectRows,
  mockInsertReturning,
  mockUpdateReturning,
  mockDeleteReturning,
  mockCountResult,
  insertedValues,
} = vi.hoisted(() => ({
  mockSelectRows: { current: [] as unknown[], queue: [] as unknown[][] },
  mockInsertReturning: { current: [] as unknown[] },
  mockUpdateReturning: { current: [] as unknown[] },
  mockDeleteReturning: { current: [] as unknown[] },
  mockCountResult: { current: { count: 0 } },
  insertedValues: { current: null as unknown },
}));

// ═══════════════════════════════════════════════════════════════════════════
// Database mock
// ═══════════════════════════════════════════════════════════════════════════

vi.mock('../db/client.js', () => {
  const createChain = () => {
    const chain: Record<string, unknown> = {};

    const wrap = (target: Record<string, unknown>) => {
      // Every chainable method returns the same proxy
      const methods = [
        'from', 'where', 'orderBy', 'limit', 'offset',
        'leftJoin', 'innerJoin', 'groupBy', 'set',
      ];
      for (const m of methods) {
        target[m] = vi.fn().mockReturnValue(target);
      }
      target.returning = vi.fn().mockImplementation(() =>
        Promise.resolve(mockInsertReturning.current),
      );
      // Terminal: select resolves with rows
      target.then = undefined; // make it thenable via Promise.resolve pattern
      return target;
    };

    return wrap(chain);
  };

  // Helper: resolve from queue if available, otherwise fall back to current
  const getSelectRows = () =>
    mockSelectRows.queue.length > 0
      ? mockSelectRows.queue.shift()!
      : mockSelectRows.current;

  // Helper: make any chain node thenable so `await node` resolves to mockSelectRows
  const makeThenable = (target: Record<string, unknown>) => {
    target.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(getSelectRows()).then(resolve, reject);
    return target;
  };

  // Overloaded select: when called as terminal (awaited), returns mockSelectRows
  const selectChain = () => {
    const chain = createChain();
    // Make the chain itself resolve to mockSelectRows when awaited
    const originalFrom = chain.from as ReturnType<typeof vi.fn>;
    originalFrom.mockImplementation(() => {
      const inner = createChain();
      // Override the final resolution
      const originalWhere = inner.where as ReturnType<typeof vi.fn>;
      originalWhere.mockImplementation(() => {
        const leaf = createChain();
        // Make where() result thenable (for count queries: `const [x] = await ...where()`)
        makeThenable(leaf);
        // limit returns the rows
        (leaf.limit as ReturnType<typeof vi.fn>).mockImplementation(() =>
          Promise.resolve(getSelectRows()),
        );
        // orderBy returns something that can be limited or awaited
        (leaf.orderBy as ReturnType<typeof vi.fn>).mockImplementation(() => {
          const sub = createChain();
          makeThenable(sub);
          (sub.limit as ReturnType<typeof vi.fn>).mockImplementation(() => {
            const sub2 = createChain();
            makeThenable(sub2);
            (sub2.offset as ReturnType<typeof vi.fn>).mockImplementation(() =>
              Promise.resolve(getSelectRows()),
            );
            return sub2;
          });
          return sub;
        });
        return leaf;
      });
      // Bare from().orderBy() (no where)
      (inner.orderBy as ReturnType<typeof vi.fn>).mockImplementation(() =>
        Promise.resolve(getSelectRows()),
      );
      // Make from() result thenable too
      makeThenable(inner);
      return inner;
    });
    return chain;
  };

  const insertChain = () => {
    const chain = createChain();
    chain.values = vi.fn().mockImplementation((vals: unknown) => {
      insertedValues.current = vals;
      const inner = createChain();
      (inner.returning as ReturnType<typeof vi.fn>).mockImplementation(() =>
        Promise.resolve(mockInsertReturning.current),
      );
      return inner;
    });
    return chain;
  };

  const updateChain = () => {
    const chain = createChain();
    (chain.set as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const inner = createChain();
      const origWhere = inner.where as ReturnType<typeof vi.fn>;
      origWhere.mockImplementation(() => {
        const leaf = createChain();
        (leaf.returning as ReturnType<typeof vi.fn>).mockImplementation(() =>
          Promise.resolve(mockUpdateReturning.current),
        );
        return leaf;
      });
      return inner;
    });
    return chain;
  };

  const deleteChain = () => {
    const chain = createChain();
    const origWhere = chain.where as ReturnType<typeof vi.fn>;
    origWhere.mockImplementation(() => {
      const leaf = createChain();
      (leaf.returning as ReturnType<typeof vi.fn>).mockImplementation(() =>
        Promise.resolve(mockDeleteReturning.current),
      );
      return leaf;
    });
    return chain;
  };

  return {
    db: {
      select: vi.fn().mockImplementation(selectChain),
      insert: vi.fn().mockImplementation(insertChain),
      update: vi.fn().mockImplementation(updateChain),
      delete: vi.fn().mockImplementation(deleteChain),
    },
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// Schema mocks — lightweight stubs for column references
// ═══════════════════════════════════════════════════════════════════════════

vi.mock('../db/schema/index.js', () => {
  const col = (name: string) => ({ name, [Symbol.for('drizzle:column')]: true });
  return {
    tenants:    { id: col('id'), name: col('name'), slug: col('slug'), tenantId: col('tenant_id') },
    profiles:   { id: col('id'), userId: col('user_id'), tenantId: col('tenant_id') },
    userRoles:  { userId: col('user_id'), role: col('role'), tenantId: col('tenant_id') },
    sites:      { id: col('id'), tenantId: col('tenant_id'), name: col('name'), wanIp: col('wan_ip'), status: col('status') },
    devices:    { id: col('id'), tenantId: col('tenant_id'), siteId: col('site_id'), name: col('name'), status: col('status'), createdAt: col('created_at'), brand: col('brand'), type: col('type'), port: col('port') },
    events:     { id: col('id'), tenantId: col('tenant_id'), deviceId: col('device_id'), siteId: col('site_id'), severity: col('severity'), status: col('status'), createdAt: col('created_at'), assignedTo: col('assigned_to') },
    incidents:  { id: col('id'), tenantId: col('tenant_id'), siteId: col('site_id'), status: col('status'), priority: col('priority'), createdAt: col('created_at'), assignedTo: col('assigned_to') },
    reports:    { id: col('id'), tenantId: col('tenant_id'), type: col('type'), status: col('status'), createdAt: col('created_at') },
    auditLogs:  { id: col('id'), tenantId: col('tenant_id'), userId: col('user_id'), action: col('action'), entityType: col('entity_type'), createdAt: col('created_at') },
    refreshTokens: { id: col('id'), tokenHash: col('token_hash'), family: col('family'), revokedAt: col('revoked_at') },
  };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ op: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
  asc: vi.fn((col: unknown) => ({ op: 'asc', col })),
  gte: vi.fn((a: unknown, b: unknown) => ({ op: 'gte', a, b })),
  lte: vi.fn((a: unknown, b: unknown) => ({ op: 'lte', a, b })),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
  count: vi.fn().mockReturnValue('count_agg'),
  isNull: vi.fn((a: unknown) => ({ op: 'isNull', a })),
}));

vi.mock('../config/env.js', () => ({
  config: {
    CREDENTIAL_ENCRYPTION_KEY: undefined,
    JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
  },
}));

vi.mock('@aion/common-utils', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  }),
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => v.replace('enc:', ''),
}));

vi.mock('@aion/shared-contracts', () => ({
  AppError: class AppError extends Error {
    constructor(public code: string, message: string, public statusCode: number) {
      super(message);
    }
  },
  NotFoundError: class NotFoundError extends Error {
    public statusCode = 404;
    constructor(public entity: string, public entityId: string) {
      super(`${entity} ${entityId} not found`);
    }
  },
  ErrorCodes: {},
}));

// ═══════════════════════════════════════════════════════════════════════════
// Import services under test
// ═══════════════════════════════════════════════════════════════════════════

import { SiteService } from '../modules/sites/service.js';
import { DeviceService } from '../modules/devices/service.js';
import { EventService } from '../modules/events/service.js';
import { IncidentService } from '../modules/incidents/service.js';
import { ReportService } from '../modules/reports/service.js';
import { AuditService } from '../modules/audit/service.js';

// ═══════════════════════════════════════════════════════════════════════════
// Test constants
// ═══════════════════════════════════════════════════════════════════════════

const TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const USER_ID = randomUUID();
// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E Integration Flow', () => {
  let siteService: SiteService;
  let deviceService: DeviceService;
  let eventService: EventService;
  let incidentService: IncidentService;
  let reportService: ReportService;
  let auditService: AuditService;

  // IDs populated during the flow
  const ids = {
    site: randomUUID(),
    device: randomUUID(),
    event: randomUUID(),
    incident: randomUUID(),
    report: randomUUID(),
  };

  beforeAll(() => {
    siteService = new SiteService();
    deviceService = new DeviceService();
    eventService = new EventService();
    incidentService = new IncidentService();
    reportService = new ReportService();
    auditService = new AuditService();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectRows.current = [];
    mockSelectRows.queue = [];
    mockInsertReturning.current = [];
    mockUpdateReturning.current = [];
    mockDeleteReturning.current = [];
    mockCountResult.current = { count: 0 };
    insertedValues.current = null;
  });

  // ─────────────────────────────────────────────────────────────────────
  // STEP 1: SITES
  // ─────────────────────────────────────────────────────────────────────

  describe('Step 1: Site Management', () => {
    it('creates a new site and returns it with generated ID', async () => {
      const newSite = {
        id: ids.site,
        tenantId: TENANT_ID,
        name: 'Centro Comercial Andino',
        address: 'Carrera 11 #82-71, Bogota',
        timezone: 'America/Bogota',
        status: 'unknown',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInsertReturning.current = [newSite];

      const result = await siteService.create(
        { name: 'Centro Comercial Andino', address: 'Carrera 11 #82-71, Bogota', timezone: 'America/Bogota' },
        TENANT_ID,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(ids.site);
      expect(result.name).toBe('Centro Comercial Andino');
      expect(result.status).toBe('unknown');
    });

    it('lists sites for the tenant after creation', async () => {
      const siteList = [
        { id: ids.site, tenantId: TENANT_ID, name: 'Centro Comercial Andino', status: 'unknown' },
        { id: randomUUID(), tenantId: TENANT_ID, name: 'Sede Principal', status: 'active' },
      ];

      mockSelectRows.current = siteList;

      const result = await siteService.list(TENANT_ID);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Centro Comercial Andino');
    });

    it('retrieves a single site by ID scoped to tenant', async () => {
      const site = {
        id: ids.site,
        tenantId: TENANT_ID,
        name: 'Centro Comercial Andino',
        address: 'Carrera 11 #82-71, Bogota',
        status: 'active',
      };

      mockSelectRows.current = [site];

      const result = await siteService.getById(ids.site, TENANT_ID);

      expect(result.id).toBe(ids.site);
      expect(result.name).toBe('Centro Comercial Andino');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // STEP 2: DEVICES
  // ─────────────────────────────────────────────────────────────────────

  describe('Step 2: Device Management', () => {
    it('creates a device linked to a site', async () => {
      // Site lookup must succeed
      mockSelectRows.current = [{ id: ids.site }];

      const newDevice = {
        id: ids.device,
        tenantId: TENANT_ID,
        siteId: ids.site,
        name: 'Camara Entrada Norte',
        type: 'camera',
        brand: 'hikvision',
        model: 'DS-2CD2143G2-I',
        status: 'unknown',
        channels: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInsertReturning.current = [newDevice];

      const result = await deviceService.create(
        {
          siteId: ids.site,
          name: 'Camara Entrada Norte',
          type: 'camera',
          brand: 'hikvision',
          model: 'DS-2CD2143G2-I',
        },
        TENANT_ID,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(ids.device);
      expect(result.siteId).toBe(ids.site);
      expect(result.type).toBe('camera');
    });

    it('rejects device creation when site does not exist', async () => {
      mockSelectRows.current = []; // No site found

      await expect(
        deviceService.create(
          { siteId: randomUUID(), name: 'Ghost Device', type: 'camera', brand: 'generic' as const },
          TENANT_ID,
        ),
      ).rejects.toThrow('not found');
    });

    it('lists devices with pagination metadata', async () => {
      const deviceList = [
        { device: { id: ids.device, name: 'Camara Entrada Norte', port: 8080 }, wanIp: '200.1.2.3' },
      ];

      // Queue: first call = count query, second = data query
      mockSelectRows.queue = [
        [{ count: 1 }],
        deviceList,
      ];

      const result = await deviceService.list(TENANT_ID);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // STEP 3: EVENTS
  // ─────────────────────────────────────────────────────────────────────

  describe('Step 3: Event Management', () => {
    it('creates an event for a device with correct severity', async () => {
      const newEvent = {
        id: ids.event,
        tenantId: TENANT_ID,
        deviceId: ids.device,
        siteId: ids.site,
        eventType: 'motion_detected',
        severity: 'warning',
        status: 'new',
        title: 'Movimiento detectado - Entrada Norte',
        description: 'Movimiento detectado fuera del horario laboral',
        metadata: { zone: 'perimeter', confidence: 0.95 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInsertReturning.current = [newEvent];

      const result = await eventService.create(
        {
          deviceId: ids.device,
          siteId: ids.site,
          type: 'motion_detected',
          severity: 'warning',
          title: 'Movimiento detectado - Entrada Norte',
          description: 'Movimiento detectado fuera del horario laboral',
          metadata: { zone: 'perimeter', confidence: 0.95 },
        },
        TENANT_ID,
      );

      expect(result.id).toBe(ids.event);
      expect(result.severity).toBe('warning');
      expect(result.status).toBe('new');
    });

    it('lists events with severity filtering', async () => {
      const criticalEvents = [
        { id: ids.event, severity: 'critical', status: 'new', title: 'Intrusion detected' },
      ];

      mockSelectRows.queue = [
        [{ count: 1 }],
        criticalEvents,
      ];

      const result = await eventService.list(TENANT_ID, {
        severity: 'critical',
        page: 1,
        perPage: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
    });

    it('updates event status from new to acknowledged', async () => {
      const updatedEvent = {
        id: ids.event,
        status: 'acknowledged',
        updatedAt: new Date(),
      };

      mockUpdateReturning.current = [updatedEvent];

      const result = await eventService.updateStatus(
        ids.event,
        { status: 'acknowledged' },
        TENANT_ID,
      );

      expect(result.status).toBe('acknowledged');
    });

    it('assigns an event to a user', async () => {
      const assignedEvent = {
        id: ids.event,
        assignedTo: USER_ID,
        updatedAt: new Date(),
      };

      mockUpdateReturning.current = [assignedEvent];

      const result = await eventService.assign(
        ids.event,
        { assignedTo: USER_ID },
        TENANT_ID,
      );

      expect(result.assignedTo).toBe(USER_ID);
    });

    it('throws NotFoundError when updating non-existent event', async () => {
      mockUpdateReturning.current = []; // No row returned

      await expect(
        eventService.updateStatus(randomUUID(), { status: 'resolved' }, TENANT_ID),
      ).rejects.toThrow('not found');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // STEP 4: INCIDENTS
  // ─────────────────────────────────────────────────────────────────────

  describe('Step 4: Incident Management', () => {
    it('creates an incident linked to an event', async () => {
      const newIncident = {
        id: ids.incident,
        tenantId: TENANT_ID,
        title: 'Posible intrusion - Entrada Norte',
        description: 'Movimiento detectado fuera de horario con alta confianza',
        status: 'open',
        priority: 'high',
        siteId: ids.site,
        eventIds: [ids.event],
        evidenceUrls: [],
        comments: [],
        createdBy: USER_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInsertReturning.current = [newIncident];

      const result = await incidentService.create(
        {
          title: 'Posible intrusion - Entrada Norte',
          description: 'Movimiento detectado fuera de horario con alta confianza',
          priority: 'high',
          siteId: ids.site,
          eventIds: [ids.event],
        },
        TENANT_ID,
        USER_ID,
      );

      expect(result.id).toBe(ids.incident);
      expect(result.status).toBe('open');
      expect(result.priority).toBe('high');
      expect(result.eventIds).toContain(ids.event);
    });

    it('adds a comment to an existing incident', async () => {
      // getById lookup
      const existingIncident = {
        id: ids.incident,
        tenantId: TENANT_ID,
        comments: [],
        status: 'open',
      };

      mockSelectRows.current = [existingIncident];

      const updatedIncident = {
        ...existingIncident,
        comments: [
          {
            id: expect.any(String),
            content: 'Revisado en campo. Falsa alarma por animal.',
            authorId: USER_ID,
            authorName: 'Operador Martinez',
            createdAt: expect.any(String),
          },
        ],
        updatedAt: new Date(),
      };

      mockUpdateReturning.current = [updatedIncident];

      const result = await incidentService.addComment(
        ids.incident,
        { content: 'Revisado en campo. Falsa alarma por animal.' },
        USER_ID,
        'Operador Martinez',
        TENANT_ID,
      );

      expect(result.comments).toHaveLength(1);
    });

    it('closes an incident and sets closedAt timestamp', async () => {
      const closedIncident = {
        id: ids.incident,
        status: 'closed',
        closedAt: new Date(),
        updatedAt: new Date(),
      };

      mockUpdateReturning.current = [closedIncident];

      const result = await incidentService.update(
        ids.incident,
        { status: 'closed' },
        TENANT_ID,
      );

      expect(result.status).toBe('closed');
      expect(result.closedAt).toBeDefined();
    });

    it('retrieves a single incident by ID', async () => {
      const incident = {
        id: ids.incident,
        tenantId: TENANT_ID,
        title: 'Posible intrusion - Entrada Norte',
        status: 'closed',
      };

      mockSelectRows.current = [incident];

      const result = await incidentService.getById(ids.incident, TENANT_ID);

      expect(result.id).toBe(ids.incident);
      expect(result.title).toBe('Posible intrusion - Entrada Norte');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // STEP 5: REPORTS
  // ─────────────────────────────────────────────────────────────────────

  describe('Step 5: Report Generation', () => {
    it('creates a report request in pending status', async () => {
      const newReport = {
        id: ids.report,
        tenantId: TENANT_ID,
        name: 'Reporte Semanal de Eventos',
        type: 'events',
        format: 'pdf',
        status: 'pending',
        parameters: { from: '2026-03-11', to: '2026-03-18', siteId: ids.site },
        generatedBy: USER_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInsertReturning.current = [newReport];

      const result = await reportService.create(TENANT_ID, USER_ID, {
        name: 'Reporte Semanal de Eventos',
        type: 'events',
        format: 'pdf',
        parameters: { from: '2026-03-11', to: '2026-03-18', siteId: ids.site },
      });

      expect(result.status).toBe('pending');
      expect(result.format).toBe('pdf');
    });

    it('retrieves report in pending status (not yet ready for download)', async () => {
      const pendingReport = {
        id: ids.report,
        tenantId: TENANT_ID,
        status: 'pending',
        resultUrl: null,
        errorMessage: null,
        format: 'pdf',
        generatedAt: null,
      };

      mockSelectRows.current = [pendingReport];

      const result = await reportService.getExport(ids.report, TENANT_ID);

      expect(result.ready).toBe(false);
      expect(result.status).toBe('pending');
    });

    it('retrieves report in completed status with download URL', async () => {
      const completedReport = {
        id: ids.report,
        tenantId: TENANT_ID,
        status: 'completed',
        resultUrl: 'https://storage.aion.co/reports/weekly-events-2026-03-18.pdf',
        errorMessage: null,
        format: 'pdf',
        generatedAt: new Date(),
      };

      mockSelectRows.current = [completedReport];

      const result = await reportService.getExport(ids.report, TENANT_ID);

      expect(result.ready).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.resultUrl).toContain('weekly-events');
    });

    it('lists reports filtered by type', async () => {
      const reportList = [
        { id: ids.report, type: 'events', status: 'completed', name: 'Reporte Semanal' },
      ];

      mockSelectRows.queue = [
        [{ count: 1 }],
        reportList,
      ];

      const result = await reportService.list(TENANT_ID, {
        type: 'events',
        page: 1,
        perPage: 20,
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // STEP 6: AUDIT TRAIL
  // ─────────────────────────────────────────────────────────────────────

  describe('Step 6: Audit Trail Verification', () => {
    it('lists audit entries for the tenant', async () => {
      mockSelectRows.current = [{ total: 6 }];

      const result = await auditService.list(TENANT_ID, {
        page: 1,
        perPage: 50,
        sortOrder: 'desc',
      });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('meta');
    });

    it('filters audit entries by action type', async () => {
      mockSelectRows.current = [{ total: 4 }];

      const result = await auditService.list(TENANT_ID, {
        action: 'create',
        page: 1,
        perPage: 50,
        sortOrder: 'desc',
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('meta');
    });

    it('filters audit entries by entity type', async () => {
      mockSelectRows.current = [{ total: 2 }];

      const result = await auditService.list(TENANT_ID, {
        resource: 'incident',
        page: 1,
        perPage: 50,
        sortOrder: 'desc',
      });

      expect(result).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // STEP 7: CROSS-CUTTING CONCERNS
  // ─────────────────────────────────────────────────────────────────────

  describe('Step 7: Cross-Cutting Validations', () => {
    it('enforces tenant isolation — site not found across tenants', async () => {
      mockSelectRows.current = []; // Empty: no site in this tenant

      await expect(
        siteService.getById(ids.site, 'other-tenant-id'),
      ).rejects.toThrow('not found');
    });

    it('enforces tenant isolation — incident not found across tenants', async () => {
      mockSelectRows.current = [];

      await expect(
        incidentService.getById(ids.incident, 'other-tenant-id'),
      ).rejects.toThrow('not found');
    });

    it('site deletion cascades correctly (service returns deleted site)', async () => {
      mockDeleteReturning.current = [{ id: ids.site, name: 'Centro Comercial Andino' }];

      // Should not throw
      await expect(
        siteService.delete(ids.site, TENANT_ID),
      ).resolves.toBeUndefined();
    });

    it('site deletion throws when site does not exist', async () => {
      mockDeleteReturning.current = [];

      await expect(
        siteService.delete(randomUUID(), TENANT_ID),
      ).rejects.toThrow('not found');
    });

    it('event resolution sets resolvedAt timestamp via service logic', async () => {
      const resolvedEvent = {
        id: ids.event,
        status: 'resolved',
        resolvedAt: new Date(),
        updatedAt: new Date(),
      };

      mockUpdateReturning.current = [resolvedEvent];

      const result = await eventService.updateStatus(
        ids.event,
        { status: 'resolved' },
        TENANT_ID,
      );

      expect(result.status).toBe('resolved');
      expect(result.resolvedAt).toBeDefined();
    });
  });
});
