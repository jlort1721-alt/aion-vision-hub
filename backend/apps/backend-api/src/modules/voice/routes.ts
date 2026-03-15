import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/auth.js';
import { voiceService } from './service.js';
import {
  synthesizeSchema,
  generateGreetingSchema,
  synthesizeCallMessageSchema,
  voiceConfigSchema,
  testConnectionSchema,
} from './schemas.js';
import type { ApiResponse } from '@aion/shared-contracts';

export async function registerVoiceRoutes(app: FastifyInstance) {
  // ── Health Check ────────────────────────────────────────
  app.get('/health', async () => {
    const health = await voiceService.healthCheck();
    return { success: true, data: health } satisfies ApiResponse;
  });

  // ── Test Connection (health + test synthesis) ───────────
  app.post(
    '/test',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request) => {
      const input = testConnectionSchema.parse(request.body);
      const result = await voiceService.testConnection(input);
      await request.audit('voice.test_connection', 'voice', undefined, { provider: voiceService.getProviderName() });
      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ── Voice Config ────────────────────────────────────────
  app.get('/config', async () => {
    return { success: true, data: voiceService.getVoiceConfig() } satisfies ApiResponse;
  });

  app.patch(
    '/config',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request) => {
      const input = voiceConfigSchema.parse(request.body);
      voiceService.updateVoiceConfig(input);
      await request.audit('voice.config.update', 'voice', undefined, input);
      return { success: true, data: voiceService.getVoiceConfig() } satisfies ApiResponse;
    },
  );

  // ── List Voices ─────────────────────────────────────────
  app.get('/voices', async () => {
    const voices = await voiceService.listVoices();
    return { success: true, data: voices } satisfies ApiResponse;
  });

  // ── Get Single Voice ────────────────────────────────────
  app.get<{ Params: { voiceId: string } }>('/voices/:voiceId', async (request) => {
    const voice = await voiceService.getVoice(request.params.voiceId);
    if (!voice) {
      return { success: false, error: 'Voice not found' };
    }
    return { success: true, data: voice } satisfies ApiResponse;
  });

  // ── Synthesize (generic TTS) ────────────────────────────
  app.post(
    '/synthesize',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const input = synthesizeSchema.parse(request.body);
      const result = await voiceService.synthesize(input);

      reply.header('Content-Type', result.contentType);
      reply.header('X-Voice-Provider', result.provider);
      reply.header('X-Character-Count', String(result.characterCount));
      reply.header('X-Duration-Estimate-Ms', String(result.durationEstimateMs));
      return reply.send(result.audio);
    },
  );

  // ── Greeting Templates ──────────────────────────────────
  app.get('/greetings/templates', async () => {
    return { success: true, data: voiceService.getGreetingTemplates() } satisfies ApiResponse;
  });

  // ── Generate Greeting (synthesize template) ─────────────
  app.post(
    '/greetings/generate',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const input = generateGreetingSchema.parse(request.body);
      const result = await voiceService.generateGreeting(input);

      reply.header('Content-Type', result.contentType);
      reply.header('X-Voice-Provider', result.provider);
      reply.header('X-Greeting-Text', encodeURIComponent(result.text));
      reply.header('X-Character-Count', String(result.characterCount));
      return reply.send(result.audio);
    },
  );

  // ── Synthesize Call Message (intercom integration) ──────
  app.post(
    '/intercom/synthesize',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const input = synthesizeCallMessageSchema.parse(request.body);
      const result = await voiceService.synthesizeCallMessage(input);

      reply.header('Content-Type', result.contentType);
      reply.header('X-Voice-Provider', result.provider);
      reply.header('X-Call-Mode', input.mode);
      if (input.callId) reply.header('X-Call-Id', input.callId);
      if (input.deviceId) reply.header('X-Device-Id', input.deviceId);
      return reply.send(result.audio);
    },
  );

  // ── AION Agent Voice Response ───────────────────────────
  app.post(
    '/agent/synthesize',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const input = synthesizeSchema.parse(request.body);
      const result = await voiceService.synthesizeAgentResponse(input.text, input.voiceId);

      reply.header('Content-Type', result.contentType);
      reply.header('X-Voice-Provider', result.provider);
      reply.header('X-Character-Count', String(result.characterCount));
      return reply.send(result.audio);
    },
  );
}
