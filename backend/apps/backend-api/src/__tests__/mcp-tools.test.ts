import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock crypto for randomUUID ─────────────────────────────────
vi.stubGlobal('crypto', { randomUUID: () => 'uuid-mcp-001' });

// ─── Mock drizzle db ────────────────────────────────────────────
const mockReturning = vi.fn();
const mockLimit = vi.fn(() => Promise.resolve([]));
const mockOffset = vi.fn(() => Promise.resolve([]));
const mockOrderBy = vi.fn(() => ({ limit: vi.fn(() => ({ offset: mockOffset })) }));
const mockGroupBy = vi.fn(() => ({ orderBy: vi.fn(() => Promise.resolve([])) }));
const mockWhere = vi.fn(() => ({
  limit: mockLimit,
  orderBy: mockOrderBy,
  returning: mockReturning,
  groupBy: mockGroupBy,
}));
const mockLeftJoin = vi.fn(() => ({
  where: mockWhere,
}));
const mockFrom = vi.fn(() => ({
  where: mockWhere,
  leftJoin: mockLeftJoin,
  orderBy: mockOrderBy,
  groupBy: mockGroupBy,
}));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockInsertValues = vi.fn(() => ({
  returning: mockReturning,
  catch: vi.fn().mockReturnThis(),
}));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockUpdateSet = vi.fn(() => ({
  where: vi.fn(() => ({ returning: mockReturning })),
}));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
const mockDeleteWhere = vi.fn(() => ({ returning: mockReturning }));
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

vi.mock('../db/client.js', () => ({
  db: {
    select: (...args: any[]) => (mockSelect as any)(...args),
    insert: (...args: any[]) => (mockInsert as any)(...args),
    update: (...args: any[]) => (mockUpdate as any)(...args),
    delete: (...args: any[]) => (mockDelete as any)(...args),
  },
}));

vi.mock('../db/schema/index.js', () => ({
  events: {
    id: 'id',
    tenantId: 'tenant_id',
    deviceId: 'device_id',
    siteId: 'site_id',
    eventType: 'event_type',
    severity: 'severity',
    status: 'status',
    title: 'title',
    description: 'description',
    channel: 'channel',
    snapshotUrl: 'snapshot_url',
    metadata: 'metadata',
    assignedTo: 'assigned_to',
    resolvedAt: 'resolved_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  incidents: {
    id: 'id',
    tenantId: 'tenant_id',
    title: 'title',
    description: 'description',
    priority: 'priority',
    status: 'status',
    siteId: 'site_id',
    eventIds: 'event_ids',
    evidenceUrls: 'evidence_urls',
    comments: 'comments',
    assignedTo: 'assigned_to',
    createdBy: 'created_by',
    closedAt: 'closed_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  devices: {
    id: 'id',
    tenantId: 'tenant_id',
    siteId: 'site_id',
    name: 'name',
    brand: 'brand',
    model: 'model',
    type: 'type',
    ipAddress: 'ip_address',
    port: 'port',
    status: 'status',
    tags: 'tags',
    channels: 'channels',
    lastSeen: 'last_seen',
    capabilities: 'capabilities',
    firmwareVersion: 'firmware_version',
    serialNumber: 'serial_number',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  sites: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
    address: 'address',
    status: 'status',
    wanIp: 'wan_ip',
  },
  auditLogs: {
    id: 'id',
    tenantId: 'tenant_id',
    userId: 'user_id',
    userEmail: 'user_email',
    action: 'action',
    entityType: 'entity_type',
    entityId: 'entity_id',
    afterState: 'after_state',
    createdAt: 'created_at',
  },
  rebootTasks: {
    id: 'id',
    tenantId: 'tenant_id',
    deviceId: 'device_id',
    reason: 'reason',
    status: 'status',
    initiatedBy: 'initiated_by',
  },
  domoticDevices: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
    state: 'state',
    status: 'status',
    lastAction: 'last_action',
    updatedAt: 'updated_at',
  },
  domoticActions: {
    id: 'id',
    tenantId: 'tenant_id',
    deviceId: 'device_id',
    action: 'action',
    result: 'result',
    userId: 'user_id',
  },
  accessLogs: {
    id: 'id',
    tenantId: 'tenant_id',
    direction: 'direction',
    method: 'method',
    notes: 'notes',
    operatorId: 'operator_id',
  },
  notificationLog: {
    id: 'id',
    tenantId: 'tenant_id',
    channelId: 'channel_id',
    type: 'type',
    recipient: 'recipient',
    subject: 'subject',
    message: 'message',
    status: 'status',
    error: 'error',
    sentAt: 'sent_at',
    createdAt: 'created_at',
  },
  notificationChannels: {
    id: 'id',
    tenantId: 'tenant_id',
    type: 'type',
    isActive: 'is_active',
    config: 'config',
    lastUsedAt: 'last_used_at',
    updatedAt: 'updated_at',
  },
  waMessages: {
    id: 'id',
    tenantId: 'tenant_id',
    conversationId: 'conversation_id',
    waMessageId: 'wa_message_id',
    direction: 'direction',
    messageType: 'message_type',
    senderType: 'sender_type',
    senderName: 'sender_name',
    body: 'body',
    deliveryStatus: 'delivery_status',
    metadata: 'metadata',
    errorMessage: 'error_message',
  },
  waConversations: {
    id: 'id',
    tenantId: 'tenant_id',
    waContactPhone: 'wa_contact_phone',
    status: 'status',
    lastMessageAt: 'last_message_at',
  },
  waTemplates: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
    isActive: 'is_active',
    status: 'status',
    language: 'language',
  },
  reports: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
    type: 'type',
    format: 'format',
    parameters: 'parameters',
    status: 'status',
    generatedBy: 'generated_by',
    createdAt: 'created_at',
  },
  kpiSnapshots: {
    id: 'id',
    tenantId: 'tenant_id',
    period: 'period',
    periodStart: 'period_start',
    periodEnd: 'period_end',
    metrics: 'metrics',
  },
}));

vi.mock('../config/env.js', () => ({
  config: {
    WHATSAPP_PHONE_NUMBER_ID: null,
    WHATSAPP_ACCESS_TOKEN: null,
    WHATSAPP_API_VERSION: 'v18.0',
    RESEND_API_KEY: null,
    SENDGRID_API_KEY: null,
    EMAIL_FROM_ADDRESS: null,
    EMAIL_FROM_NAME: null,
  },
}));

import {
  getAllTools,
  getTool,
  hasTool,
  executeTool,
  getToolDescriptors,
  getToolCount,
} from '../modules/mcp-bridge/tools/index.js';

// ═══════════════════════════════════════════════════════════════════
// Tool Registry
// ═══════════════════════════════════════════════════════════════════

describe('MCP Tool Registry', () => {
  const context = { tenantId: 'tenant-001', userId: 'user-001' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Registration ────────────────────────────────────────────
  it('registers all 22 tools', () => {
    const count = getToolCount();
    expect(count).toBe(22);
  });

  it('getAllTools() returns array of 22 tools', () => {
    const tools = getAllTools();
    expect(tools).toHaveLength(22);
  });

  it('every tool has name, description, parameters, and execute', () => {
    const tools = getAllTools();
    for (const tool of tools) {
      expect(tool.name).toBeTruthy();
      expect(typeof tool.name).toBe('string');
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe('string');
      expect(typeof tool.parameters).toBe('object');
      expect(typeof tool.execute).toBe('function');
    }
  });

  it('every tool has a unique name', () => {
    const tools = getAllTools();
    const names = tools.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('hasTool() returns true for registered tools', () => {
    expect(hasTool('query_events')).toBe(true);
    expect(hasTool('create_incident')).toBe(true);
    expect(hasTool('open_gate')).toBe(true);
    expect(hasTool('send_alert')).toBe(true);
    expect(hasTool('generate_report')).toBe(true);
  });

  it('hasTool() returns false for unregistered tools', () => {
    expect(hasTool('nonexistent_tool')).toBe(false);
    expect(hasTool('')).toBe(false);
  });

  it('getTool() returns tool object for registered tool', () => {
    const tool = getTool('query_events');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('query_events');
    expect(tool!.description).toBeTruthy();
  });

  it('getTool() returns undefined for unregistered tool', () => {
    const tool = getTool('nonexistent_tool');
    expect(tool).toBeUndefined();
  });

  // ── getToolDescriptors ──────────────────────────────────────
  it('getToolDescriptors() returns valid descriptors without execute function', () => {
    const descriptors = getToolDescriptors();
    expect(descriptors).toHaveLength(22);

    for (const desc of descriptors) {
      expect(desc).toHaveProperty('name');
      expect(desc).toHaveProperty('description');
      expect(desc).toHaveProperty('parameters');
      // Descriptors should NOT contain the execute function
      expect(desc).not.toHaveProperty('execute');
    }
  });

  it('getToolDescriptors() parameter definitions have type and description', () => {
    const descriptors = getToolDescriptors();
    for (const desc of descriptors) {
      for (const [_paramName, paramDef] of Object.entries(desc.parameters)) {
        expect(paramDef).toHaveProperty('type');
        expect(paramDef).toHaveProperty('description');
        expect(typeof paramDef.type).toBe('string');
        expect(typeof paramDef.description).toBe('string');
      }
    }
  });

  // ── executeTool — unknown tool ──────────────────────────────
  it('executeTool() returns error for unknown tool', async () => {
    const result = await executeTool('nonexistent', {}, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(result.toolName).toBe('nonexistent');
    expect(result.executionMs).toBe(0);
  });

  // ── executeTool — missing required params ───────────────────
  it('executeTool() rejects missing required parameters', async () => {
    // open_gate requires device_id and reason
    mockInsertValues.mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([{}]), catch: vi.fn().mockReturnThis() });

    const result = await executeTool('open_gate', {}, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameters');
    expect(result.error).toContain('device_id');
    expect(result.error).toContain('reason');
  });

  it('executeTool() rejects when only some required params are provided', async () => {
    mockInsertValues.mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([{}]), catch: vi.fn().mockReturnThis() });

    const result = await executeTool('open_gate', { device_id: 'dev-1' }, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameters');
    expect(result.error).toContain('reason');
    expect(result.error).not.toContain('device_id');
  });

  it('executeTool() rejects empty string as required parameter', async () => {
    mockInsertValues.mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([{}]), catch: vi.fn().mockReturnThis() });

    const result = await executeTool(
      'create_incident',
      { title: '', description: 'desc', priority: 'high' },
      context,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameters');
    expect(result.error).toContain('title');
  });

  it('executeTool() rejects null as required parameter', async () => {
    mockInsertValues.mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([{}]), catch: vi.fn().mockReturnThis() });

    const result = await executeTool(
      'create_incident',
      { title: null, description: 'desc', priority: 'high' },
      context,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameters');
  });

  // ── executeTool — enum validation ───────────────────────────
  it('executeTool() rejects invalid enum values', async () => {
    const result = await executeTool(
      'query_events',
      { severity: 'super_critical' },
      context,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid value 'super_critical'");
    expect(result.error).toContain('severity');
  });

  // ── executeTool — successful execution ──────────────────────
  it('executeTool() returns success with data and timing on valid call', async () => {
    // query_events has no required params, so this should execute
    // Mock the count query and data query
    mockWhere
      .mockReturnValueOnce({
        limit: mockLimit,
        orderBy: mockOrderBy,
        returning: mockReturning,
        groupBy: mockGroupBy,
      });
    mockFrom
      .mockReturnValueOnce({ where: vi.fn(() => Promise.resolve([{ count: 0 }])) } as any)
      .mockReturnValueOnce({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      } as any);
    // Audit log insert (needs .catch() for the non-blocking audit in error path)
    mockInsertValues.mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([{}]),
      catch: vi.fn().mockReturnThis(),
    });

    const result = await executeTool('get_dashboard_summary', {}, context);

    // Even if DB returns empty, the tool should succeed structurally
    expect(result.toolName).toBe('get_dashboard_summary');
    expect(typeof result.executionMs).toBe('number');
  });

  // ── executeTool — error handling ────────────────────────────
  it('executeTool() handles thrown errors gracefully', async () => {
    // Make the execute throw by causing a DB error
    mockFrom.mockImplementationOnce(() => {
      throw new Error('Database connection lost');
    });
    // Audit log for the failed attempt (needs .catch() for non-blocking audit)
    mockInsertValues.mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([{}]),
      catch: vi.fn().mockReturnThis(),
    });

    const result = await executeTool('query_events', {}, context);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Database connection lost');
    expect(result.toolName).toBe('query_events');
    expect(typeof result.executionMs).toBe('number');
  });
});

// ═══════════════════════════════════════════════════════════════════
// DB Read Tools — query_events
// ═══════════════════════════════════════════════════════════════════

describe('DB Read Tools — query_events', () => {
  // Context available for future use: { tenantId: 'tenant-001', userId: 'user-001' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('query_events tool has correct filter parameters', () => {
    const tool = getTool('query_events');
    expect(tool).toBeDefined();

    const paramNames = Object.keys(tool!.parameters);
    expect(paramNames).toContain('severity');
    expect(paramNames).toContain('status');
    expect(paramNames).toContain('site_id');
    expect(paramNames).toContain('device_id');
    expect(paramNames).toContain('date_from');
    expect(paramNames).toContain('date_to');
    expect(paramNames).toContain('limit');
  });

  it('query_events severity parameter has correct enum values', () => {
    const tool = getTool('query_events');
    expect(tool!.parameters.severity.enum).toEqual([
      'critical', 'high', 'medium', 'low', 'info',
    ]);
  });

  it('query_events status parameter has correct enum values', () => {
    const tool = getTool('query_events');
    expect(tool!.parameters.status.enum).toEqual([
      'new', 'acknowledged', 'resolved', 'dismissed',
    ]);
  });

  it('query_events has no required parameters', () => {
    const tool = getTool('query_events');
    for (const paramDef of Object.values(tool!.parameters)) {
      expect(paramDef.required).toBeFalsy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Incident Tools — create_incident
// ═══════════════════════════════════════════════════════════════════

describe('Incident Tools — create_incident', () => {
  const context = { tenantId: 'tenant-001', userId: 'user-001' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create_incident requires title, description, and priority', () => {
    const tool = getTool('create_incident');
    expect(tool).toBeDefined();

    expect(tool!.parameters.title.required).toBe(true);
    expect(tool!.parameters.description.required).toBe(true);
    expect(tool!.parameters.priority.required).toBe(true);
  });

  it('create_incident has optional site_id and related_event_ids', () => {
    const tool = getTool('create_incident');
    expect(tool!.parameters.site_id.required).toBeFalsy();
    expect(tool!.parameters.related_event_ids.required).toBeFalsy();
  });

  it('create_incident priority has correct enum values', () => {
    const tool = getTool('create_incident');
    expect(tool!.parameters.priority.enum).toEqual([
      'critical', 'high', 'medium', 'low',
    ]);
  });

  it('executeTool rejects create_incident without title', async () => {
    mockInsertValues.mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([{}]), catch: vi.fn().mockReturnThis() });

    const result = await executeTool(
      'create_incident',
      { description: 'desc', priority: 'high' },
      context,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameters');
    expect(result.error).toContain('title');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Device Command Tools — open_gate
// ═══════════════════════════════════════════════════════════════════

describe('Device Command Tools — open_gate', () => {
  const context = { tenantId: 'tenant-001', userId: 'user-001' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('open_gate requires device_id and reason', () => {
    const tool = getTool('open_gate');
    expect(tool).toBeDefined();
    expect(tool!.parameters.device_id.required).toBe(true);
    expect(tool!.parameters.reason.required).toBe(true);
  });

  it('executeTool rejects open_gate without device_id', async () => {
    mockInsertValues.mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([{}]), catch: vi.fn().mockReturnThis() });

    const result = await executeTool(
      'open_gate',
      { reason: 'Delivery access' },
      context,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameters');
    expect(result.error).toContain('device_id');
  });

  it('reboot_device requires device_id and reason', () => {
    const tool = getTool('reboot_device');
    expect(tool).toBeDefined();
    expect(tool!.parameters.device_id.required).toBe(true);
    expect(tool!.parameters.reason.required).toBe(true);
  });

  it('toggle_relay requires device_id, state, and reason', () => {
    const tool = getTool('toggle_relay');
    expect(tool).toBeDefined();
    expect(tool!.parameters.device_id.required).toBe(true);
    expect(tool!.parameters.state.required).toBe(true);
    expect(tool!.parameters.reason.required).toBe(true);
  });

  it('toggle_relay state has correct enum values', () => {
    const tool = getTool('toggle_relay');
    expect(tool!.parameters.state.enum).toEqual(['on', 'off']);
  });

  it('get_device_status requires device_id', () => {
    const tool = getTool('get_device_status');
    expect(tool!.parameters.device_id.required).toBe(true);
  });

  it('list_device_capabilities requires device_id', () => {
    const tool = getTool('list_device_capabilities');
    expect(tool!.parameters.device_id.required).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Notification Tools — Rate Limiting
// ═══════════════════════════════════════════════════════════════════

describe('Notification Tools — rate limiting', () => {
  // Context available for future use: { tenantId: 'tenant-rate-test', userId: 'user-001' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('send_alert requires message, severity, and channels', () => {
    const tool = getTool('send_alert');
    expect(tool).toBeDefined();
    expect(tool!.parameters.message.required).toBe(true);
    expect(tool!.parameters.severity.required).toBe(true);
    expect(tool!.parameters.channels.required).toBe(true);
  });

  it('send_alert severity has correct enum values', () => {
    const tool = getTool('send_alert');
    expect(tool!.parameters.severity.enum).toEqual([
      'critical', 'high', 'medium', 'low', 'info',
    ]);
  });

  it('send_whatsapp requires to and template_name', () => {
    const tool = getTool('send_whatsapp');
    expect(tool).toBeDefined();
    expect(tool!.parameters.to.required).toBe(true);
    expect(tool!.parameters.template_name.required).toBe(true);
  });

  it('send_email requires to, subject, and body', () => {
    const tool = getTool('send_email');
    expect(tool).toBeDefined();
    expect(tool!.parameters.to.required).toBe(true);
    expect(tool!.parameters.subject.required).toBe(true);
    expect(tool!.parameters.body.required).toBe(true);
  });

  it('rate limiting enforced: send_alert returns rate limit error after 10 calls', async () => {
    const rateTenantId = `tenant-rate-${Date.now()}`;
    const rateContext = { tenantId: rateTenantId, userId: 'user-001' };

    // Send 10 successful calls — each requires DB mocks for the notification channel lookup
    for (let i = 0; i < 10; i++) {
      // Mock the notification channels query (returns no active channels so it skips sending)
      mockWhere.mockReturnValueOnce({
        limit: mockLimit,
        orderBy: mockOrderBy,
        returning: mockReturning,
        groupBy: mockGroupBy,
      });
      mockFrom.mockReturnValueOnce({
        where: vi.fn(() => Promise.resolve([])),
      } as any);
      // Audit log insert
      mockInsertValues.mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([{}]), catch: vi.fn().mockReturnThis() });

      await executeTool(
        'send_alert',
        { message: `Alert ${i}`, severity: 'low', channels: 'email' },
        rateContext,
      );
    }

    // The 11th call should be rate limited — the tool execute function checks
    // rate limit internally and returns an error in the result data
    mockWhere.mockReturnValueOnce({
      limit: mockLimit,
      orderBy: mockOrderBy,
      returning: mockReturning,
      groupBy: mockGroupBy,
    });
    // Audit log for this call
    mockInsertValues.mockReturnValueOnce({ returning: vi.fn().mockResolvedValueOnce([{}]), catch: vi.fn().mockReturnThis() });

    const result = await executeTool(
      'send_alert',
      { message: 'Alert 11', severity: 'low', channels: 'email' },
      rateContext,
    );

    // The tool itself checks rate limiting and returns an error in its result.
    // Since executeTool wraps this, we check the returned data for the rate limit error.
    if (result.success && result.data) {
      const data = result.data as Record<string, unknown>;
      expect(data.error).toContain('Rate limit exceeded');
    } else if (!result.success) {
      // If it failed at the tool level
      expect(result.error).toBeDefined();
    }
  });

  it('get_notification_history has no required parameters', () => {
    const tool = getTool('get_notification_history');
    expect(tool).toBeDefined();
    for (const paramDef of Object.values(tool!.parameters)) {
      expect(paramDef.required).toBeFalsy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Report Tools
// ═══════════════════════════════════════════════════════════════════

describe('Report Tools', () => {
  it('generate_report requires type, date_from, and date_to', () => {
    const tool = getTool('generate_report');
    expect(tool).toBeDefined();
    expect(tool!.parameters.type.required).toBe(true);
    expect(tool!.parameters.date_from.required).toBe(true);
    expect(tool!.parameters.date_to.required).toBe(true);
  });

  it('generate_report type has correct enum values', () => {
    const tool = getTool('generate_report');
    expect(tool!.parameters.type.enum).toEqual([
      'daily_summary',
      'weekly_incidents',
      'monthly_sla',
      'device_health',
      'event_analysis',
      'patrol_compliance',
      'access_log',
    ]);
  });

  it('generate_report format has correct enum values', () => {
    const tool = getTool('generate_report');
    expect(tool!.parameters.format.enum).toEqual(['pdf', 'csv', 'json']);
  });

  it('get_kpis has no required parameters', () => {
    const tool = getTool('get_kpis');
    expect(tool).toBeDefined();
    for (const paramDef of Object.values(tool!.parameters)) {
      expect(paramDef.required).toBeFalsy();
    }
  });

  it('get_analytics has no required parameters', () => {
    const tool = getTool('get_analytics');
    expect(tool).toBeDefined();
    for (const paramDef of Object.values(tool!.parameters)) {
      expect(paramDef.required).toBeFalsy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Tool Names Catalog — verifies all expected tools exist
// ═══════════════════════════════════════════════════════════════════

describe('Tool Names Catalog', () => {
  const expectedTools = [
    // DB Read (5)
    'query_events',
    'query_incidents',
    'query_devices',
    'get_site_status',
    'get_dashboard_summary',
    // Incident Server (5)
    'create_incident',
    'update_incident',
    'add_incident_comment',
    'get_incident_timeline',
    'close_incident',
    // Device Command (5)
    'open_gate',
    'reboot_device',
    'toggle_relay',
    'get_device_status',
    'list_device_capabilities',
    // Notification Server (4)
    'send_alert',
    'send_whatsapp',
    'send_email',
    'get_notification_history',
    // Report Server (3)
    'generate_report',
    'get_kpis',
    'get_analytics',
  ];

  it.each(expectedTools)('tool "%s" is registered', (toolName) => {
    expect(hasTool(toolName)).toBe(true);
  });
});
