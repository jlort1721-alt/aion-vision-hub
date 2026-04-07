/**
 * Extensions Service
 *
 * Business logic for voice extension management. Extensions are stored
 * in tenant settings JSONB under the "extensions" key.
 */

import { db } from '../../db/client.js';
import { tenants } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

export interface Extension {
  id: string;
  name: string;
  type: 'greeting' | 'after_hours' | 'emergency' | 'maintenance' | 'announcement' | 'custom';
  text: string;
  voiceId: string;
  modelId: string;
  language: string;
  schedule: string | null;
  isActive: boolean;
  audioCache: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExtensionInput {
  name: string;
  type?: string;
  text: string;
  voiceId?: string;
  modelId?: string;
  language?: string;
  schedule?: string;
  isActive?: boolean;
}

export interface UpdateExtensionInput {
  name?: string;
  type?: string;
  text?: string;
  voiceId?: string;
  modelId?: string;
  language?: string;
  schedule?: string;
  isActive?: boolean;
}

class ExtensionsService {
  /**
   * Read extensions array from tenant settings JSONB.
   */
  async getTenantExtensions(tenantId: string): Promise<Extension[]> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!tenant) return [];
    const settings = (tenant.settings || {}) as Record<string, unknown>;
    return (settings.extensions || []) as Extension[];
  }

  /**
   * Persist extensions array into tenant settings JSONB.
   */
  async saveTenantExtensions(tenantId: string, extensions: Extension[]): Promise<void> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const currentSettings = ((tenant?.settings || {}) as Record<string, unknown>);
    await db.update(tenants).set({
      settings: { ...currentSettings, extensions },
    }).where(eq(tenants.id, tenantId));
  }

  /**
   * List all extensions for a tenant.
   */
  async listExtensions(tenantId: string): Promise<Extension[]> {
    return this.getTenantExtensions(tenantId);
  }

  /**
   * Get a single extension by ID.
   */
  async getExtension(tenantId: string, extensionId: string): Promise<Extension | null> {
    const extensions = await this.getTenantExtensions(tenantId);
    return extensions.find(e => e.id === extensionId) || null;
  }

  /**
   * Create a new extension.
   */
  async createExtension(tenantId: string, input: CreateExtensionInput): Promise<Extension> {
    if (!input.name?.trim() || !input.text?.trim()) {
      throw new Error('VALIDATION_ERROR: Nombre y texto son obligatorios');
    }

    const extensions = await this.getTenantExtensions(tenantId);

    const extension: Extension = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      type: (input.type || 'custom') as Extension['type'],
      text: input.text.trim(),
      voiceId: input.voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || '',
      modelId: input.modelId || process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
      language: input.language || 'es',
      schedule: input.schedule || null,
      isActive: input.isActive ?? true,
      audioCache: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    extensions.push(extension);
    await this.saveTenantExtensions(tenantId, extensions);

    return extension;
  }

  /**
   * Update an existing extension. Returns the updated extension or null if not found.
   */
  async updateExtension(tenantId: string, extensionId: string, updates: UpdateExtensionInput): Promise<Extension | null> {
    const extensions = await this.getTenantExtensions(tenantId);
    const idx = extensions.findIndex(e => e.id === extensionId);

    if (idx === -1) return null;

    if (updates.name !== undefined) extensions[idx].name = updates.name;
    if (updates.type !== undefined) extensions[idx].type = updates.type as Extension['type'];
    if (updates.text !== undefined) {
      extensions[idx].text = updates.text;
      extensions[idx].audioCache = null; // Invalidate cache when text changes
    }
    if (updates.voiceId !== undefined) {
      extensions[idx].voiceId = updates.voiceId;
      extensions[idx].audioCache = null;
    }
    if (updates.modelId !== undefined) extensions[idx].modelId = updates.modelId;
    if (updates.language !== undefined) extensions[idx].language = updates.language;
    if (updates.schedule !== undefined) extensions[idx].schedule = updates.schedule;
    if (updates.isActive !== undefined) extensions[idx].isActive = updates.isActive;
    extensions[idx].updatedAt = new Date().toISOString();

    await this.saveTenantExtensions(tenantId, extensions);

    return extensions[idx];
  }

  /**
   * Delete an extension by ID. Returns true if deleted, false if not found.
   */
  async deleteExtension(tenantId: string, extensionId: string): Promise<boolean> {
    const extensions = await this.getTenantExtensions(tenantId);
    const filtered = extensions.filter(e => e.id !== extensionId);

    if (filtered.length === extensions.length) return false;

    await this.saveTenantExtensions(tenantId, filtered);
    return true;
  }

  /**
   * Update audio cache for a specific extension.
   */
  async updateAudioCache(tenantId: string, extensionId: string, audioBase64: string): Promise<Extension | null> {
    const extensions = await this.getTenantExtensions(tenantId);
    const ext = extensions.find(e => e.id === extensionId);

    if (!ext) return null;

    ext.audioCache = audioBase64;
    ext.updatedAt = new Date().toISOString();
    await this.saveTenantExtensions(tenantId, extensions);

    return ext;
  }
}

export const extensionsService = new ExtensionsService();
