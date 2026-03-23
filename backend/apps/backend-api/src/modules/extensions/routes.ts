/**
 * Voice Extensions Management Routes
 *
 * Manages greeting messages, announcements, and voice extensions
 * for the intercom/VoIP system. Extensions are stored in tenant
 * settings JSONB under the "extensions" key.
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { db } from '../../db/client.js';
import { tenants } from '../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { synthesize, listVoices, healthCheck as elevenHealthCheck, isConfigured } from '../../services/elevenlabs.js';
import crypto from 'crypto';

interface Extension {
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

async function getTenantExtensions(tenantId: string): Promise<Extension[]> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) return [];
  const settings = (tenant.settings || {}) as Record<string, unknown>;
  return (settings.extensions || []) as Extension[];
}

async function saveTenantExtensions(tenantId: string, extensions: Extension[]): Promise<void> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  const currentSettings = ((tenant?.settings || {}) as Record<string, unknown>);
  await db.update(tenants).set({
    settings: { ...currentSettings, extensions },
  }).where(eq(tenants.id, tenantId));
}

export async function registerExtensionRoutes(app: FastifyInstance) {

  // ── GET / — List all extensions ──
  app.get(
    '/',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Extensions'], summary: 'List all voice extensions for tenant' },
    },
    async (request, reply) => {
      const extensions = await getTenantExtensions(request.tenantId);
      return reply.send({ success: true, data: extensions });
    },
  );

  // ── POST / — Create extension ──
  app.post<{ Body: { name: string; type: string; text: string; voiceId?: string; modelId?: string; language?: string; schedule?: string; isActive?: boolean } }>(
    '/',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Extensions'], summary: 'Create a new voice extension' },
    },
    async (request, reply) => {
      const { name, type, text, voiceId, modelId, language, schedule, isActive } = request.body;

      if (!name?.trim() || !text?.trim()) {
        return reply.code(400).send({ success: false, error: 'Nombre y texto son obligatorios' });
      }

      const extensions = await getTenantExtensions(request.tenantId);

      const extension: Extension = {
        id: crypto.randomUUID(),
        name: name.trim(),
        type: (type || 'custom') as Extension['type'],
        text: text.trim(),
        voiceId: voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || '',
        modelId: modelId || process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
        language: language || 'es',
        schedule: schedule || null,
        isActive: isActive ?? true,
        audioCache: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      extensions.push(extension);
      await saveTenantExtensions(request.tenantId, extensions);

      await request.audit('extension.create', 'extensions', extension.id, { name, type });

      return reply.code(201).send({ success: true, data: extension });
    },
  );

  // ── PATCH /:id — Update extension ──
  app.patch<{ Params: { id: string }; Body: Partial<Omit<Extension, 'id' | 'createdAt'>> }>(
    '/:id',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Extensions'], summary: 'Update a voice extension' },
    },
    async (request, reply) => {
      const { id } = request.params;
      const extensions = await getTenantExtensions(request.tenantId);
      const idx = extensions.findIndex(e => e.id === id);

      if (idx === -1) {
        return reply.code(404).send({ success: false, error: 'Extensión no encontrada' });
      }

      const updates = request.body;
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

      await saveTenantExtensions(request.tenantId, extensions);

      await request.audit('extension.update', 'extensions', id, updates);

      return reply.send({ success: true, data: extensions[idx] });
    },
  );

  // ── DELETE /:id — Delete extension ──
  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Extensions'], summary: 'Delete a voice extension' },
    },
    async (request, reply) => {
      const { id } = request.params;
      const extensions = await getTenantExtensions(request.tenantId);
      const filtered = extensions.filter(e => e.id !== id);

      if (filtered.length === extensions.length) {
        return reply.code(404).send({ success: false, error: 'Extensión no encontrada' });
      }

      await saveTenantExtensions(request.tenantId, filtered);
      await request.audit('extension.delete', 'extensions', id);

      return reply.code(204).send();
    },
  );

  // ── POST /:id/preview — Generate TTS audio preview ──
  app.post<{ Params: { id: string } }>(
    '/:id/preview',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Extensions'], summary: 'Generate TTS audio preview for extension' },
    },
    async (request, reply) => {
      if (!isConfigured()) {
        return reply.code(503).send({ success: false, error: 'ElevenLabs no configurado. Configure ELEVENLABS_API_KEY.' });
      }

      const { id } = request.params;
      const extensions = await getTenantExtensions(request.tenantId);
      const ext = extensions.find(e => e.id === id);

      if (!ext) {
        return reply.code(404).send({ success: false, error: 'Extensión no encontrada' });
      }

      // Return cached audio if available
      if (ext.audioCache) {
        return reply.send({
          success: true,
          data: { audioBase64: ext.audioCache, cached: true, format: 'mp3' },
        });
      }

      const { audio, error } = await synthesize(ext.text, ext.voiceId, ext.modelId);

      if (!audio) {
        return reply.code(502).send({ success: false, error: error || 'Error al generar audio' });
      }

      // Cache the audio
      const base64 = audio.toString('base64');
      ext.audioCache = base64;
      ext.updatedAt = new Date().toISOString();
      await saveTenantExtensions(request.tenantId, extensions);

      return reply.send({
        success: true,
        data: { audioBase64: base64, cached: false, format: 'mp3' },
      });
    },
  );

  // ── POST /:id/synthesize — Generate fresh TTS (no cache) ──
  app.post<{ Params: { id: string } }>(
    '/:id/synthesize',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Extensions'], summary: 'Force-generate new TTS audio for extension' },
    },
    async (request, reply) => {
      if (!isConfigured()) {
        return reply.code(503).send({ success: false, error: 'ElevenLabs no configurado' });
      }

      const { id } = request.params;
      const extensions = await getTenantExtensions(request.tenantId);
      const ext = extensions.find(e => e.id === id);

      if (!ext) {
        return reply.code(404).send({ success: false, error: 'Extensión no encontrada' });
      }

      const { audio, error } = await synthesize(ext.text, ext.voiceId, ext.modelId);

      if (!audio) {
        return reply.code(502).send({ success: false, error: error || 'Error al sintetizar' });
      }

      const base64 = audio.toString('base64');
      ext.audioCache = base64;
      ext.updatedAt = new Date().toISOString();
      await saveTenantExtensions(request.tenantId, extensions);

      return reply.send({
        success: true,
        data: { audioBase64: base64, format: 'mp3' },
      });
    },
  );

  // ── GET /voices — List available ElevenLabs voices ──
  app.get(
    '/voices',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Extensions'], summary: 'List available TTS voices' },
    },
    async (_request, reply) => {
      if (!isConfigured()) {
        return reply.code(503).send({ success: false, error: 'ElevenLabs no configurado' });
      }

      const { voices, error } = await listVoices();
      if (error) {
        return reply.code(502).send({ success: false, error });
      }

      return reply.send({
        success: true,
        data: voices.map(v => ({
          id: v.voice_id,
          name: v.name,
          category: v.category,
          labels: v.labels,
          previewUrl: v.preview_url,
        })),
      });
    },
  );

  // ── GET /health — ElevenLabs health check ──
  app.get(
    '/health',
    {
      schema: { tags: ['Extensions'], summary: 'ElevenLabs service health check' },
    },
    async (_request, reply) => {
      const health = await elevenHealthCheck();
      return reply.send({ success: true, data: health });
    },
  );
}
