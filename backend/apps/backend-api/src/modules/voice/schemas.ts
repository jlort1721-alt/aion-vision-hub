import { z } from 'zod';

// ── Synthesis ────────────────────────────────────────────

export const synthesizeSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().max(128).optional(),
  modelId: z.string().max(128).optional(),
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  outputFormat: z.enum(['mp3_44100_128', 'mp3_22050_32', 'pcm_16000', 'pcm_44100', 'ulaw_8000']).optional(),
});
export type SynthesizeInput = z.infer<typeof synthesizeSchema>;

// ── Greeting Generation ──────────────────────────────────

export const generateGreetingSchema = z.object({
  context: z.enum(['default', 'after_hours', 'emergency', 'maintenance', 'custom']).default('default'),
  language: z.enum(['es', 'en']).default('es'),
  customText: z.string().max(500).optional(),
  voiceId: z.string().max(128).optional(),
  siteName: z.string().max(255).optional(),
});
export type GenerateGreetingInput = z.infer<typeof generateGreetingSchema>;

// ── Call Message Synthesis ───────────────────────────────

export const synthesizeCallMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  voiceId: z.string().max(128).optional(),
  callId: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
  mode: z.enum(['ai', 'human', 'mixed']).default('ai'),
});
export type SynthesizeCallMessageInput = z.infer<typeof synthesizeCallMessageSchema>;

// ── Voice Config ─────────────────────────────────────────

export const voiceConfigSchema = z.object({
  defaultVoiceId: z.string().max(128).optional(),
  defaultModel: z.string().max(128).optional(),
  stability: z.number().min(0).max(1).optional(),
  similarityBoost: z.number().min(0).max(1).optional(),
  greetingMode: z.enum(['ai', 'human', 'mixed']).optional(),
  greetingVoiceId: z.string().max(128).optional(),
  enabled: z.boolean().optional(),
});
export type VoiceConfigInput = z.infer<typeof voiceConfigSchema>;

// ── Test Connection ──────────────────────────────────────

export const testConnectionSchema = z.object({
  text: z.string().max(200).optional(),
  voiceId: z.string().max(128).optional(),
});
export type TestConnectionInput = z.infer<typeof testConnectionSchema>;
