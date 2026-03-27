import { eq, and, sql, desc, ilike, or } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { notificationTemplates } from '../../db/schema/index.js';
import { NotFoundError, AppError, ErrorCodes } from '@aion/shared-contracts';
import { createLogger } from '@aion/common-utils';
import { emailService } from '../email/service.js';
import { whatsappService } from '../whatsapp/service.js';
import { pushService } from '../push/service.js';
import { DEFAULT_TEMPLATES } from './defaults.js';
import type {
  CreateNotificationTemplateInput,
  UpdateNotificationTemplateInput,
  NotificationTemplateFilters,
  PreviewTemplateInput,
  SendTestNotificationInput,
} from './schemas.js';

const logger = createLogger({ name: 'notification-templates-service' });

// ── Template Rendering Engine ────────────────────────────────

/**
 * Renders a template body by interpolating `{{variable}}` placeholders,
 * evaluating `{{#if var}}...{{/if}}` conditional blocks, and replacing
 * `{{date}}` with the current formatted timestamp.
 */
export function renderTemplate(template: string, data: Record<string, string>): string {
  let result = template;

  // 1. Handle {{#if variable}}...{{/if}} blocks
  result = result.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, variable: string, content: string) => {
      const value = data[variable];
      // Truthy: non-empty string that isn't literally "false" or "0"
      if (value && value !== 'false' && value !== '0') {
        // Recursively render the inner content
        return renderTemplate(content, data);
      }
      return '';
    },
  );

  // 2. Replace {{date}} with formatted current date
  const now = new Date();
  const formattedDate = now.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  result = result.replace(/\{\{date\}\}/g, data['date'] || formattedDate);

  // 3. Replace all remaining {{variable}} placeholders
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, variable: string) => {
    return data[variable] ?? '';
  });

  // 4. Clean up empty lines left by removed conditionals
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
}

// ── Service ──────────────────────────────────────────────────

export class NotificationTemplateService {
  // ── List ───────────────────────────────────────────────────

  async list(tenantId: string, filters: NotificationTemplateFilters) {
    const conditions = [eq(notificationTemplates.tenantId, tenantId)];

    if (filters.category) {
      conditions.push(eq(notificationTemplates.category, filters.category));
    }
    if (filters.channel) {
      conditions.push(eq(notificationTemplates.channel, filters.channel));
    }
    if (filters.search) {
      conditions.push(
        or(
          ilike(notificationTemplates.name, `%${filters.search}%`),
          ilike(notificationTemplates.description, `%${filters.search}%`),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationTemplates)
      .where(whereClause);

    const total = countResult?.count ?? 0;
    const offset = (filters.page - 1) * filters.perPage;

    const rows = await db
      .select()
      .from(notificationTemplates)
      .where(whereClause)
      .orderBy(desc(notificationTemplates.updatedAt))
      .limit(filters.perPage)
      .offset(offset);

    return {
      items: rows,
      meta: {
        page: filters.page,
        perPage: filters.perPage,
        total,
        totalPages: Math.ceil(total / filters.perPage),
      },
    };
  }

  // ── Get by ID ──────────────────────────────────────────────

  async getById(id: string, tenantId: string) {
    const [template] = await db
      .select()
      .from(notificationTemplates)
      .where(and(eq(notificationTemplates.id, id), eq(notificationTemplates.tenantId, tenantId)))
      .limit(1);

    if (!template) throw new NotFoundError('NotificationTemplate', id);
    return template;
  }

  // ── Create ─────────────────────────────────────────────────

  async create(data: CreateNotificationTemplateInput, tenantId: string) {
    const [template] = await db
      .insert(notificationTemplates)
      .values({
        tenantId,
        name: data.name,
        description: data.description ?? null,
        category: data.category,
        channel: data.channel,
        subject: data.subject ?? null,
        bodyTemplate: data.bodyTemplate,
        variables: data.variables,
        isSystem: data.isSystem ?? false,
      })
      .returning();

    logger.info({ tenantId, templateId: template.id, name: data.name }, 'Notification template created');
    return template;
  }

  // ── Update ─────────────────────────────────────────────────

  async update(id: string, data: UpdateNotificationTemplateInput, tenantId: string) {
    // Verify it exists and belongs to tenant
    await this.getById(id, tenantId);

    // System templates allow body/subject edits but not deletion of system flag
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.channel !== undefined) updateData.channel = data.channel;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.bodyTemplate !== undefined) updateData.bodyTemplate = data.bodyTemplate;
    if (data.variables !== undefined) updateData.variables = data.variables;

    const [template] = await db
      .update(notificationTemplates)
      .set(updateData)
      .where(and(eq(notificationTemplates.id, id), eq(notificationTemplates.tenantId, tenantId)))
      .returning();

    if (!template) throw new NotFoundError('NotificationTemplate', id);

    logger.info({ tenantId, templateId: id }, 'Notification template updated');
    return template;
  }

  // ── Delete ─────────────────────────────────────────────────

  async delete(id: string, tenantId: string) {
    const existing = await this.getById(id, tenantId);

    if (existing.isSystem) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'System templates cannot be deleted',
        400,
      );
    }

    const [template] = await db
      .delete(notificationTemplates)
      .where(and(eq(notificationTemplates.id, id), eq(notificationTemplates.tenantId, tenantId)))
      .returning();

    if (!template) throw new NotFoundError('NotificationTemplate', id);

    logger.info({ tenantId, templateId: id }, 'Notification template deleted');
    return template;
  }

  // ── Preview ────────────────────────────────────────────────

  async preview(id: string, tenantId: string, input: PreviewTemplateInput) {
    const template = await this.getById(id, tenantId);

    // Build sample data by merging variable samples with provided overrides
    const sampleData: Record<string, string> = {};
    const variables = (template.variables as Array<{ name: string; sample?: string }>) ?? [];
    for (const v of variables) {
      if (v.sample) sampleData[v.name] = v.sample;
    }
    Object.assign(sampleData, input.data);

    const renderedBody = renderTemplate(template.bodyTemplate, sampleData);
    const renderedSubject = template.subject
      ? renderTemplate(template.subject, sampleData)
      : null;

    return {
      subject: renderedSubject,
      body: renderedBody,
      channel: template.channel,
      data: sampleData,
    };
  }

  // ── Send Test ──────────────────────────────────────────────

  async sendTest(input: SendTestNotificationInput, tenantId: string) {
    const template = await this.getById(input.templateId, tenantId);

    // Build sample data
    const sampleData: Record<string, string> = {};
    const variables = (template.variables as Array<{ name: string; sample?: string }>) ?? [];
    for (const v of variables) {
      if (v.sample) sampleData[v.name] = v.sample;
    }
    Object.assign(sampleData, input.data);

    const renderedBody = renderTemplate(template.bodyTemplate, sampleData);
    const renderedSubject = template.subject
      ? renderTemplate(template.subject, sampleData)
      : `[Test] ${template.name}`;

    switch (input.channel) {
      case 'email': {
        const result = await emailService.sendGeneric({
          to: [input.recipient],
          subject: `[TEST] ${renderedSubject}`,
          text: renderedBody,
          html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap;">${renderedBody.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
        });

        return {
          success: result.success,
          channel: 'email',
          recipient: input.recipient,
          error: result.error,
        };
      }

      case 'whatsapp': {
        try {
          const result = await whatsappService.sendMessage(
            tenantId,
            { to: input.recipient, type: 'text', body: `[TEST] ${renderedSubject}\n\n${renderedBody}` },
            'system',
            'Template Test',
          );

          return {
            success: result.success,
            channel: 'whatsapp',
            recipient: input.recipient,
            error: result.error,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'WhatsApp send failed';
          return { success: false, channel: 'whatsapp', recipient: input.recipient, error: msg };
        }
      }

      case 'push': {
        // recipient = userId for push notifications
        const result = await pushService.sendToUser(tenantId, input.recipient, {
          title: `[TEST] ${renderedSubject}`,
          body: renderedBody.slice(0, 200),
        });

        return {
          success: result.sent > 0,
          channel: 'push',
          recipient: input.recipient,
          sent: result.sent,
          failed: result.failed,
        };
      }

      default:
        throw new AppError(ErrorCodes.VALIDATION_ERROR, `Unsupported test channel: ${input.channel}`, 400);
    }
  }

  // ── Seed Defaults ──────────────────────────────────────────

  async seedDefaults(tenantId: string): Promise<{ seeded: number; skipped: number }> {
    let seeded = 0;
    let skipped = 0;

    for (const tpl of DEFAULT_TEMPLATES) {
      // Check if already exists for this tenant
      const [existing] = await db
        .select({ id: notificationTemplates.id })
        .from(notificationTemplates)
        .where(
          and(
            eq(notificationTemplates.tenantId, tenantId),
            eq(notificationTemplates.name, tpl.name),
          ),
        )
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      await db.insert(notificationTemplates).values({
        tenantId,
        name: tpl.name,
        description: tpl.description ?? null,
        category: tpl.category,
        channel: tpl.channel,
        subject: tpl.subject ?? null,
        bodyTemplate: tpl.bodyTemplate,
        variables: tpl.variables,
        isSystem: tpl.isSystem ?? false,
      });

      seeded++;
    }

    logger.info({ tenantId, seeded, skipped }, 'Default notification templates seeded');
    return { seeded, skipped };
  }
}

export const notificationTemplateService = new NotificationTemplateService();
