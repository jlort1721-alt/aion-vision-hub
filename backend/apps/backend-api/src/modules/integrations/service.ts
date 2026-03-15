import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { integrations } from '../../db/schema/index.js';
import { NotFoundError, AppError, ErrorCodes } from '@aion/shared-contracts';
import type { CreateIntegrationInput, UpdateIntegrationInput } from './schemas.js';
import { emailService } from '../email/service.js';

export class IntegrationService {
  /**
   * List all integrations for a tenant, ordered by most recent first.
   */
  async list(tenantId: string) {
    return db
      .select()
      .from(integrations)
      .where(eq(integrations.tenantId, tenantId))
      .orderBy(desc(integrations.createdAt));
  }

  /**
   * Get a single integration by ID, scoped to tenant.
   */
  async getById(id: string, tenantId: string) {
    const [integration] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)))
      .limit(1);

    if (!integration) {
      throw new NotFoundError('Integration', id);
    }

    return integration;
  }

  /**
   * Create a new integration for a tenant.
   */
  async create(tenantId: string, input: CreateIntegrationInput) {
    const [integration] = await db
      .insert(integrations)
      .values({
        tenantId,
        name: input.name,
        type: input.type,
        config: input.config,
        isActive: input.isActive ?? true,
      })
      .returning();

    return integration;
  }

  /**
   * Update an existing integration.
   */
  async update(id: string, tenantId: string, input: UpdateIntegrationInput) {
    // Ensure integration exists and belongs to tenant
    await this.getById(id, tenantId);

    const [updated] = await db
      .update(integrations)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)))
      .returning();

    return updated;
  }

  /**
   * Delete an integration.
   */
  async delete(id: string, tenantId: string) {
    // Ensure integration exists and belongs to tenant
    await this.getById(id, tenantId);

    await db
      .delete(integrations)
      .where(and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)));
  }

  /**
   * Test integration connectivity.
   * Attempts a connection test based on integration type and config.
   */
  async testConnectivity(id: string, tenantId: string) {
    const integration = await this.getById(id, tenantId);

    const startTime = Date.now();
    let success = false;
    let message = '';

    try {
      switch (integration.type) {
        case 'webhook': {
          const url = (integration.config as Record<string, unknown>)?.url;
          if (!url || typeof url !== 'string') {
            throw new AppError(
              ErrorCodes.INTEGRATION_CONFIG_INVALID,
              'Webhook URL is not configured',
              400,
            );
          }
          const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
          success = response.ok;
          message = success
            ? `Webhook reachable (HTTP ${response.status})`
            : `Webhook returned HTTP ${response.status}`;
          break;
        }

        case 'slack': {
          const webhookUrl = (integration.config as Record<string, unknown>)?.webhookUrl;
          if (!webhookUrl || typeof webhookUrl !== 'string') {
            throw new AppError(
              ErrorCodes.INTEGRATION_CONFIG_INVALID,
              'Slack webhook URL is not configured',
              400,
            );
          }
          const response = await fetch(webhookUrl as string, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'AION Vision Hub connectivity test' }),
            signal: AbortSignal.timeout(10000),
          });
          success = response.ok;
          message = success ? 'Slack webhook reachable' : `Slack returned HTTP ${response.status}`;
          break;
        }

        case 'email': {
          const health = await emailService.healthCheck();
          success = health.ok;
          message = health.message;
          break;
        }

        case 'whatsapp': {
          const cfg = integration.config as Record<string, unknown>;
          const phoneNumberId = cfg?.phoneNumberId;
          const accessToken = cfg?.accessToken;
          if (!phoneNumberId || !accessToken) {
            throw new AppError(
              ErrorCodes.INTEGRATION_CONFIG_INVALID,
              'WhatsApp Phone Number ID and Access Token are required',
              400,
            );
          }
          const apiVersion = (cfg?.apiVersion as string) || 'v21.0';
          const waResp = await fetch(
            `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=verified_name,quality_rating`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
              signal: AbortSignal.timeout(10000),
            },
          );
          if (waResp.ok) {
            const waData = await waResp.json() as Record<string, string>;
            success = true;
            message = `WhatsApp connected: ${waData.verified_name || 'OK'} (Quality: ${waData.quality_rating || 'N/A'})`;
          } else {
            const waErr = await waResp.json().catch(() => ({})) as Record<string, any>;
            success = false;
            message = `WhatsApp API error: ${waErr?.error?.message || waResp.statusText}`;
          }
          break;
        }

        default: {
          // For types without specific test logic, mark as untestable
          success = true;
          message = `Integration type '${integration.type}' connectivity assumed OK (no specific test available)`;
          break;
        }
      }
    } catch (error) {
      if (error instanceof AppError) throw error;

      success = false;
      message = error instanceof Error ? error.message : 'Connection test failed';
    }

    const latencyMs = Date.now() - startTime;

    // Update the integration with test results
    await db
      .update(integrations)
      .set({
        lastTestedAt: new Date(),
        lastError: success ? null : message,
        updatedAt: new Date(),
      })
      .where(and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)));

    return { success, message, latencyMs };
  }
}

export const integrationService = new IntegrationService();
