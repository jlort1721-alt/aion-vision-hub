/**
 * NoOp Voice Provider — Fallback when no TTS provider is configured.
 *
 * Returns silent audio and logs warnings so the system
 * keeps working without crashing when ElevenLabs is not set up.
 */

import type {
  VoiceProvider,
  VoiceSynthesisRequest,
  VoiceSynthesisResult,
  VoiceInfo,
  VoiceHealthCheck,
} from './types.js';

// Minimal valid MP3 frame (silent) — 144 bytes
const SILENT_MP3 = Buffer.from(
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYAAAAAAAAAAAAAAAAA',
  'base64',
);

export class NoopVoiceProvider implements VoiceProvider {
  readonly name = 'noop';
  private logger: { warn: (...args: unknown[]) => void };

  constructor(logger?: { warn: (...args: unknown[]) => void }) {
    this.logger = logger ?? { warn: console.warn };
  }

  isConfigured(): boolean {
    return false;
  }

  async healthCheck(): Promise<VoiceHealthCheck> {
    return {
      provider: this.name,
      configured: false,
      status: 'not_configured',
      message: 'No voice provider configured. Set ELEVENLABS_API_KEY to enable TTS.',
      latencyMs: 0,
    };
  }

  async synthesize(request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult> {
    this.logger.warn(`[NoopVoice] Synthesis requested but no provider configured. Text: "${request.text.slice(0, 60)}..."`);
    return {
      audio: SILENT_MP3,
      contentType: 'audio/mpeg',
      characterCount: request.text.length,
      durationEstimateMs: 0,
      provider: this.name,
    };
  }

  async listVoices(): Promise<VoiceInfo[]> {
    return [];
  }

  async getVoice(): Promise<VoiceInfo | null> {
    return null;
  }
}
