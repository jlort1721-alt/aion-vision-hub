import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock drizzle db ────────────────────────────────────────────
const mockReturning = vi.fn();
const mockLimit = vi.fn(() => Promise.resolve([]));
const mockOffset = vi.fn(() => Promise.resolve([]));
const mockOrderBy = vi.fn(() => ({ limit: vi.fn(() => ({ offset: mockOffset })) }));
const mockWhere = vi.fn(() => ({
  limit: mockLimit,
  orderBy: mockOrderBy,
  returning: mockReturning,
}));
const mockFrom = vi.fn(() => ({
  where: mockWhere,
}));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockInsertValues = vi.fn(() => ({ returning: mockReturning }));
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
  notificationTemplates: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
    description: 'description',
    category: 'category',
    channel: 'channel',
    subject: 'subject',
    bodyTemplate: 'body_template',
    variables: 'variables',
    isSystem: 'is_system',
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
  AppError: class AppError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, message: string, statusCode: number) {
      super(message);
      this.name = 'AppError';
      this.code = code;
      this.statusCode = statusCode;
    }
  },
  ErrorCodes: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
  },
}));

vi.mock('@aion/common-utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../modules/email/service.js', () => ({
  emailService: { sendGeneric: vi.fn() },
}));

vi.mock('../modules/whatsapp/service.js', () => ({
  whatsappService: { sendMessage: vi.fn() },
}));

vi.mock('../modules/push/service.js', () => ({
  pushService: { sendToUser: vi.fn() },
}));

import {
  renderTemplate,
  NotificationTemplateService,
} from '../modules/notification-templates/service.js';
import { DEFAULT_TEMPLATES } from '../modules/notification-templates/defaults.js';
import {
  createNotificationTemplateSchema,
  updateNotificationTemplateSchema,
  notificationTemplateFiltersSchema,
  previewTemplateSchema,
  sendTestNotificationSchema,
} from '../modules/notification-templates/schemas.js';

// ═══════════════════════════════════════════════════════════════════
// renderTemplate — Template Rendering Engine
// ═══════════════════════════════════════════════════════════════════

describe('renderTemplate', () => {
  // ── Variable interpolation ──────────────────────────────────
  it('interpolates {{variable}} placeholders', () => {
    const template = 'Hello {{name}}, welcome to {{site}}.';
    const result = renderTemplate(template, { name: 'Carlos', site: 'Main Office' });
    expect(result).toBe('Hello Carlos, welcome to Main Office.');
  });

  it('replaces missing variables with empty string', () => {
    const template = 'Device: {{device_name}} Status: {{status}}';
    const result = renderTemplate(template, { device_name: 'CAM-01' });
    expect(result).toBe('Device: CAM-01 Status:');
  });

  it('handles multiple occurrences of the same variable', () => {
    const template = '{{name}} said hello. Goodbye {{name}}.';
    const result = renderTemplate(template, { name: 'Ana' });
    expect(result).toBe('Ana said hello. Goodbye Ana.');
  });

  // ── Conditional blocks ──────────────────────────────────────
  it('renders {{#if condition}}...{{/if}} when variable is truthy', () => {
    const template = 'Event occurred.{{#if description}} Details: {{description}}{{/if}}';
    const result = renderTemplate(template, { description: 'Motion in zone B' });
    expect(result).toBe('Event occurred.Details: Motion in zone B');
  });

  it('removes {{#if condition}}...{{/if}} when variable is missing', () => {
    const template = 'Event occurred.{{#if description}} Details: {{description}}{{/if}} End.';
    const result = renderTemplate(template, {});
    expect(result).toContain('Event occurred.');
    expect(result).toContain('End.');
    expect(result).not.toContain('Details:');
  });

  it('removes {{#if condition}}...{{/if}} when variable is empty string', () => {
    const template = '{{#if notes}}Notes: {{notes}}{{/if}} Done.';
    const result = renderTemplate(template, { notes: '' });
    expect(result).not.toContain('Notes:');
    expect(result).toContain('Done.');
  });

  it('removes {{#if condition}}...{{/if}} when variable is "false"', () => {
    const template = '{{#if active}}Active: yes{{/if}} End.';
    const result = renderTemplate(template, { active: 'false' });
    expect(result).not.toContain('Active: yes');
  });

  it('removes {{#if condition}}...{{/if}} when variable is "0"', () => {
    const template = '{{#if count}}Count: {{count}}{{/if}} End.';
    const result = renderTemplate(template, { count: '0' });
    expect(result).not.toContain('Count:');
  });

  it('renders nested variables inside conditional blocks', () => {
    const template = '{{#if host_name}}Host: {{host_name}}{{/if}}';
    const result = renderTemplate(template, { host_name: 'Juan Perez' });
    expect(result).toBe('Host: Juan Perez');
  });

  // ── Date formatting ─────────────────────────────────────────
  it('replaces {{date}} with provided date value', () => {
    const template = 'Time: {{date}}';
    const result = renderTemplate(template, { date: '2026-03-25 14:30:00' });
    expect(result).toBe('Time: 2026-03-25 14:30:00');
  });

  it('replaces {{date}} with formatted current date when not in data', () => {
    const template = 'Generated at: {{date}}';
    const result = renderTemplate(template, {});
    // Should contain a date-like string (digits, slashes or dashes)
    expect(result).toMatch(/Generated at: .+/);
    expect(result).not.toContain('{{date}}');
  });

  // ── Empty line cleanup ──────────────────────────────────────
  it('collapses multiple empty lines left by removed conditionals', () => {
    const template = 'Line 1\n\n\n\n\nLine 2';
    const result = renderTemplate(template, {});
    // Should have at most two consecutive newlines
    expect(result).not.toMatch(/\n{3,}/);
  });

  // ── Complex template ────────────────────────────────────────
  it('renders a complex template with variables, conditionals, and date', () => {
    const template = [
      'Incident #{{incident_id}}: {{incident_title}}',
      'Priority: {{priority}}',
      '',
      '{{#if description}}{{description}}{{/if}}',
      '',
      '{{#if assigned_to}}Assigned to: {{assigned_to}}{{/if}}',
      'Created at: {{date}}',
    ].join('\n');

    const result = renderTemplate(template, {
      incident_id: 'abc123',
      incident_title: 'Unauthorized access',
      priority: 'high',
      description: 'Badge reader bypass detected.',
      assigned_to: 'Carlos M.',
      date: '2026-03-25 09:15:00',
    });

    expect(result).toContain('Incident #abc123: Unauthorized access');
    expect(result).toContain('Priority: high');
    expect(result).toContain('Badge reader bypass detected.');
    expect(result).toContain('Assigned to: Carlos M.');
    expect(result).toContain('Created at: 2026-03-25 09:15:00');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Default Templates
// ═══════════════════════════════════════════════════════════════════

describe('DEFAULT_TEMPLATES', () => {
  it('contains exactly 8 default templates', () => {
    expect(DEFAULT_TEMPLATES).toHaveLength(8);
  });

  it('all templates have valid structure (name, category, channel, bodyTemplate, variables)', () => {
    for (const tpl of DEFAULT_TEMPLATES) {
      expect(tpl.name).toBeTruthy();
      expect(tpl.category).toBeTruthy();
      expect(tpl.channel).toBeTruthy();
      expect(tpl.bodyTemplate).toBeTruthy();
      expect(Array.isArray(tpl.variables)).toBe(true);
    }
  });

  it('all templates have at least one variable defined', () => {
    for (const tpl of DEFAULT_TEMPLATES) {
      expect(tpl.variables.length).toBeGreaterThan(0);
    }
  });

  it('all templates are marked as system templates', () => {
    for (const tpl of DEFAULT_TEMPLATES) {
      expect(tpl.isSystem).toBe(true);
    }
  });

  it('all templates pass createNotificationTemplateSchema validation', () => {
    for (const tpl of DEFAULT_TEMPLATES) {
      const result = createNotificationTemplateSchema.safeParse(tpl);
      expect(result.success).toBe(true);
    }
  });

  it('all variables in each template have a name and sample value', () => {
    for (const tpl of DEFAULT_TEMPLATES) {
      for (const v of tpl.variables) {
        expect(v.name).toBeTruthy();
        expect(v.sample).toBeTruthy();
      }
    }
  });

  it('all bodyTemplates contain at least one {{variable}} placeholder', () => {
    for (const tpl of DEFAULT_TEMPLATES) {
      expect(tpl.bodyTemplate).toMatch(/\{\{\w+\}\}/);
    }
  });

  it('each template has a unique name', () => {
    const names = DEFAULT_TEMPLATES.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Notification Template Schemas
// ═══════════════════════════════════════════════════════════════════

describe('Notification Template Schemas', () => {
  describe('createNotificationTemplateSchema', () => {
    it('accepts a valid full payload', () => {
      const result = createNotificationTemplateSchema.safeParse({
        name: 'test_template',
        category: 'alert',
        channel: 'email',
        bodyTemplate: 'Hello {{name}}, new alert at {{site}}.',
        variables: [{ name: 'name', sample: 'Carlos' }, { name: 'site', sample: 'HQ' }],
      });
      expect(result.success).toBe(true);
    });

    it('rejects when name is missing', () => {
      const result = createNotificationTemplateSchema.safeParse({
        category: 'alert',
        channel: 'email',
        bodyTemplate: 'Hello',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid category', () => {
      const result = createNotificationTemplateSchema.safeParse({
        name: 'test',
        category: 'invalid_category',
        channel: 'email',
        bodyTemplate: 'Hello',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid channel', () => {
      const result = createNotificationTemplateSchema.safeParse({
        name: 'test',
        category: 'alert',
        channel: 'telegram',
        bodyTemplate: 'Hello',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty bodyTemplate', () => {
      const result = createNotificationTemplateSchema.safeParse({
        name: 'test',
        category: 'alert',
        channel: 'email',
        bodyTemplate: '',
      });
      expect(result.success).toBe(false);
    });

    it('defaults variables to empty array', () => {
      const result = createNotificationTemplateSchema.safeParse({
        name: 'test',
        category: 'alert',
        channel: 'email',
        bodyTemplate: 'Hello world',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.variables).toEqual([]);
      }
    });

    it('defaults isSystem to false', () => {
      const result = createNotificationTemplateSchema.safeParse({
        name: 'test',
        category: 'alert',
        channel: 'email',
        bodyTemplate: 'Hello world',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isSystem).toBe(false);
      }
    });

    it('accepts all valid categories', () => {
      const categories = ['alert', 'incident', 'shift', 'visitor', 'access', 'system', 'automation'];
      for (const category of categories) {
        const result = createNotificationTemplateSchema.safeParse({
          name: 'test',
          category,
          channel: 'email',
          bodyTemplate: 'Hello',
        });
        expect(result.success).toBe(true);
      }
    });

    it('accepts all valid channels', () => {
      const channels = ['email', 'whatsapp', 'push', 'all'];
      for (const channel of channels) {
        const result = createNotificationTemplateSchema.safeParse({
          name: 'test',
          category: 'alert',
          channel,
          bodyTemplate: 'Hello',
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('updateNotificationTemplateSchema', () => {
    it('accepts partial updates', () => {
      const result = updateNotificationTemplateSchema.safeParse({
        name: 'updated_name',
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty object (no fields to update)', () => {
      const result = updateNotificationTemplateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('notificationTemplateFiltersSchema', () => {
    it('defaults page to 1 and perPage to 25', () => {
      const result = notificationTemplateFiltersSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.perPage).toBe(25);
      }
    });

    it('accepts valid filter combination', () => {
      const result = notificationTemplateFiltersSchema.safeParse({
        category: 'alert',
        channel: 'email',
        search: 'incident',
        page: 2,
        perPage: 10,
      });
      expect(result.success).toBe(true);
    });

    it('rejects perPage over 100', () => {
      const result = notificationTemplateFiltersSchema.safeParse({ perPage: 200 });
      expect(result.success).toBe(false);
    });
  });

  describe('previewTemplateSchema', () => {
    it('defaults data to empty object', () => {
      const result = previewTemplateSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.data).toEqual({});
      }
    });

    it('accepts custom data overrides', () => {
      const result = previewTemplateSchema.safeParse({
        data: { name: 'Test', site: 'HQ' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('sendTestNotificationSchema', () => {
    it('accepts a valid payload', () => {
      const result = sendTestNotificationSchema.safeParse({
        templateId: '11111111-1111-1111-1111-111111111111',
        channel: 'email',
        recipient: 'admin@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid channel', () => {
      const result = sendTestNotificationSchema.safeParse({
        templateId: '11111111-1111-1111-1111-111111111111',
        channel: 'telegram',
        recipient: 'admin@example.com',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing templateId', () => {
      const result = sendTestNotificationSchema.safeParse({
        channel: 'email',
        recipient: 'admin@example.com',
      });
      expect(result.success).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// NotificationTemplateService
// ═══════════════════════════════════════════════════════════════════

describe('NotificationTemplateService', () => {
  let service: NotificationTemplateService;
  const tenantId = 'tenant-001';
  const templateId = 'template-001';

  const fakeTemplate = {
    id: templateId,
    tenantId,
    name: 'event_alert',
    description: 'General event alert',
    category: 'alert',
    channel: 'all',
    subject: '[{{severity}}] {{event_title}}',
    bodyTemplate: 'New {{severity}} event: {{event_title}} at {{site_name}}.\n\n{{#if description}}Details: {{description}}{{/if}}\n\nTime: {{date}}',
    variables: [
      { name: 'severity', sample: 'critical' },
      { name: 'event_title', sample: 'Motion detected' },
      { name: 'site_name', sample: 'Main Office' },
      { name: 'description', sample: 'Movement in zone B' },
      { name: 'date', sample: '2026-03-25 14:30:00' },
    ],
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const fakeUserTemplate = {
    ...fakeTemplate,
    id: 'template-002',
    name: 'custom_alert',
    isSystem: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationTemplateService();
  });

  // ── getById ─────────────────────────────────────────────────
  it('getById() returns template when found', async () => {
    mockLimit.mockResolvedValueOnce([fakeTemplate] as any);

    const result = await service.getById(templateId, tenantId);

    expect(result).toEqual(fakeTemplate);
  });

  it('getById() throws NotFoundError when template does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.getById('missing', tenantId)).rejects.toThrow('NotificationTemplate');
  });

  // ── create ──────────────────────────────────────────────────
  it('create() inserts a new template', async () => {
    mockReturning.mockResolvedValueOnce([fakeUserTemplate]);

    const result = await service.create(
      {
        name: 'custom_alert',
        category: 'alert',
        channel: 'all',
        bodyTemplate: 'Hello {{name}}',
        variables: [{ name: 'name', sample: 'Carlos' }],
      } as any,
      tenantId,
    );

    expect(mockInsert).toHaveBeenCalled();
    expect(result.name).toBe('custom_alert');
  });

  // ── delete (system template protection) ─────────────────────
  it('delete() throws AppError when trying to delete a system template', async () => {
    // getById returns a system template
    mockLimit.mockResolvedValueOnce([fakeTemplate] as any);

    await expect(service.delete(templateId, tenantId)).rejects.toThrow(
      'System templates cannot be deleted',
    );
  });

  it('delete() succeeds for non-system templates', async () => {
    // getById returns a non-system template
    mockLimit.mockResolvedValueOnce([fakeUserTemplate] as any);
    // delete returning
    mockReturning.mockResolvedValueOnce([fakeUserTemplate]);

    const result = await service.delete(fakeUserTemplate.id, tenantId);

    expect(mockDelete).toHaveBeenCalled();
    expect(result.name).toBe('custom_alert');
  });

  it('delete() throws NotFoundError when template does not exist', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(service.delete('missing', tenantId)).rejects.toThrow('NotificationTemplate');
  });

  // ── preview ─────────────────────────────────────────────────
  it('preview() renders the template with sample data from variables', async () => {
    mockLimit.mockResolvedValueOnce([fakeTemplate] as any);

    const result = await service.preview(templateId, tenantId, { data: {} });

    expect(result.body).toContain('critical');
    expect(result.body).toContain('Motion detected');
    expect(result.body).toContain('Main Office');
    expect(result.body).toContain('Movement in zone B');
    expect(result.subject).toContain('critical');
    expect(result.channel).toBe('all');
  });

  it('preview() allows data overrides to replace sample values', async () => {
    mockLimit.mockResolvedValueOnce([fakeTemplate] as any);

    const result = await service.preview(templateId, tenantId, {
      data: { severity: 'low', event_title: 'Test event' },
    });

    expect(result.body).toContain('low');
    expect(result.body).toContain('Test event');
    expect(result.subject).toContain('low');
    expect(result.subject).toContain('Test event');
  });

  it('preview() returns null subject when template has no subject', async () => {
    const noSubjectTemplate = { ...fakeTemplate, subject: null };
    mockLimit.mockResolvedValueOnce([noSubjectTemplate] as any);

    const result = await service.preview(templateId, tenantId, { data: {} });

    expect(result.subject).toBeNull();
  });

  it('preview() includes the data map used for rendering', async () => {
    mockLimit.mockResolvedValueOnce([fakeTemplate] as any);

    const result = await service.preview(templateId, tenantId, {
      data: { severity: 'high' },
    });

    expect(result.data).toHaveProperty('severity', 'high');
    // Sample values should also be present for other variables
    expect(result.data).toHaveProperty('event_title', 'Motion detected');
  });

  // ── update ──────────────────────────────────────────────────
  it('update() returns the updated template', async () => {
    // getById
    mockLimit.mockResolvedValueOnce([fakeTemplate] as any);
    const updated = { ...fakeTemplate, name: 'updated_event_alert' };
    const mockWhereReturning = vi.fn(() => ({ returning: vi.fn().mockResolvedValueOnce([updated]) }));
    mockUpdateSet.mockReturnValueOnce({ where: mockWhereReturning });

    const result = await service.update(
      templateId,
      { name: 'updated_event_alert' } as any,
      tenantId,
    );

    expect(result.name).toBe('updated_event_alert');
  });
});
