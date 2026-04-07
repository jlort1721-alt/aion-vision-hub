/**
 * Voice Extensions Management Routes
 *
 * Manages greeting messages, announcements, and voice extensions
 * for the intercom/VoIP system. Extensions are stored in tenant
 * settings JSONB under the "extensions" key.
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { synthesize, listVoices, healthCheck as elevenHealthCheck, isConfigured } from '../../services/elevenlabs.js';
import { extensionsService } from './service.js';
import type { CreateExtensionInput, UpdateExtensionInput } from './service.js';

export async function registerExtensionRoutes(app: FastifyInstance) {

  // ── GET / — List all extensions ──
  app.get(
    '/',
    {
      preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
      schema: { tags: ['Extensions'], summary: 'List all voice extensions for tenant' },
    },
    async (request, reply) => {
      const extensions = await extensionsService.listExtensions(request.tenantId);
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

      try {
        const input: CreateExtensionInput = { name, type, text, voiceId, modelId, language, schedule, isActive };
        const extension = await extensionsService.createExtension(request.tenantId, input);

        await request.audit('extension.create', 'extensions', extension.id, { name, type });

        return reply.code(201).send({ success: true, data: extension });
      } catch (err) {
        const message = (err as Error).message;
        if (message.startsWith('VALIDATION_ERROR:')) {
          return reply.code(400).send({ success: false, error: message.replace('VALIDATION_ERROR: ', '') });
        }
        throw err;
      }
    },
  );

  // ── PATCH /:id — Update extension ──
  app.patch<{ Params: { id: string }; Body: Partial<{ name: string; type: string; text: string; voiceId: string; modelId: string; language: string; schedule: string; isActive: boolean }> }>(
    '/:id',
    {
      preHandler: [requireRole('tenant_admin', 'super_admin')],
      schema: { tags: ['Extensions'], summary: 'Update a voice extension' },
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates: UpdateExtensionInput = request.body;

      const result = await extensionsService.updateExtension(request.tenantId, id, updates);

      if (!result) {
        return reply.code(404).send({ success: false, error: 'Extensión no encontrada' });
      }

      await request.audit('extension.update', 'extensions', id, updates as Record<string, unknown>);

      return reply.send({ success: true, data: result });
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

      const deleted = await extensionsService.deleteExtension(request.tenantId, id);

      if (!deleted) {
        return reply.code(404).send({ success: false, error: 'Extensión no encontrada' });
      }

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
      const ext = await extensionsService.getExtension(request.tenantId, id);

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
      await extensionsService.updateAudioCache(request.tenantId, id, base64);

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
      const ext = await extensionsService.getExtension(request.tenantId, id);

      if (!ext) {
        return reply.code(404).send({ success: false, error: 'Extensión no encontrada' });
      }

      const { audio, error } = await synthesize(ext.text, ext.voiceId, ext.modelId);

      if (!audio) {
        return reply.code(502).send({ success: false, error: error || 'Error al sintetizar' });
      }

      const base64 = audio.toString('base64');
      await extensionsService.updateAudioCache(request.tenantId, id, base64);

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
