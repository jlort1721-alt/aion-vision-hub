/**
 * ElevenLabs Voice Provider — Backend-Only Implementation
 *
 * All ElevenLabs API calls are made server-side.
 * API keys never reach the frontend.
 */

import type {
  VoiceProvider,
  VoiceSynthesisRequest,
  VoiceSynthesisResult,
  VoiceInfo,
  VoiceHealthCheck,
} from './types.js';

const API_BASE = 'https://api.elevenlabs.io/v1';

interface ElevenLabsProviderConfig {
  apiKey: string;
  defaultVoiceId: string;
  defaultModel: string;
  stability: number;
  similarityBoost: number;
}

export class ElevenLabsProvider implements VoiceProvider {
  readonly name = 'elevenlabs';
  private config: ElevenLabsProviderConfig;
  private logger: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

  constructor(
    config: Partial<ElevenLabsProviderConfig> & { apiKey: string },
    logger?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void },
  ) {
    this.config = {
      apiKey: config.apiKey,
      defaultVoiceId: config.defaultVoiceId ?? '21m00Tcm4TlvDq8ikWAM', // Rachel
      defaultModel: config.defaultModel ?? 'eleven_multilingual_v2',
      stability: config.stability ?? 0.5,
      similarityBoost: config.similarityBoost ?? 0.75,
    };
    this.logger = logger ?? { info: console.log, warn: console.warn, error: console.error };
  }

  isConfigured(): boolean {
    return this.config.apiKey.length > 0;
  }

  async healthCheck(): Promise<VoiceHealthCheck> {
    if (!this.isConfigured()) {
      return {
        provider: this.name,
        configured: false,
        status: 'not_configured',
        message: 'ELEVENLABS_API_KEY is not set.',
        latencyMs: 0,
      };
    }

    const start = Date.now();
    try {
      const resp = await fetch(`${API_BASE}/user`, {
        headers: { 'xi-api-key': this.config.apiKey },
      });
      const latencyMs = Date.now() - start;

      if (!resp.ok) {
        this.logger.error('[ElevenLabs] Health check failed:', resp.status, resp.statusText);
        return {
          provider: this.name,
          configured: true,
          status: 'error',
          message: `API error: ${resp.status} ${resp.statusText}`,
          latencyMs,
        };
      }

      const user = await resp.json() as {
        subscription?: {
          tier?: string;
          character_count?: number;
          character_limit?: number;
        };
      };

      const tier = user.subscription?.tier ?? 'unknown';
      const remaining = user.subscription?.character_limit != null && user.subscription?.character_count != null
        ? user.subscription.character_limit - user.subscription.character_count
        : undefined;

      this.logger.info(`[ElevenLabs] Health OK — tier=${tier}, remaining=${remaining ?? 'N/A'}, latency=${latencyMs}ms`);

      return {
        provider: this.name,
        configured: true,
        status: 'healthy',
        message: `Connected. Tier: ${tier}.${remaining != null ? ` Characters remaining: ${remaining}` : ''}`,
        latencyMs,
        quotaRemaining: remaining,
        tier,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error('[ElevenLabs] Health check error:', message);
      return {
        provider: this.name,
        configured: true,
        status: 'error',
        message,
        latencyMs,
      };
    }
  }

  async synthesize(request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs API key not configured. Set ELEVENLABS_API_KEY.');
    }

    const voiceId = request.voiceId || this.config.defaultVoiceId;
    const modelId = request.modelId || this.config.defaultModel;
    const outputFormat = request.outputFormat ?? 'mp3_44100_128';

    this.logger.info(`[ElevenLabs] Synthesizing ${request.text.length} chars, voice=${voiceId}, model=${modelId}, format=${outputFormat}`);

    const start = Date.now();
    const resp = await fetch(`${API_BASE}/text-to-speech/${voiceId}?output_format=${outputFormat}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.config.apiKey,
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: request.text,
        model_id: modelId,
        voice_settings: {
          stability: request.stability ?? this.config.stability,
          similarity_boost: request.similarityBoost ?? this.config.similarityBoost,
        },
      }),
    });

    if (!resp.ok) {
      const errorBody = await resp.text().catch(() => resp.statusText);
      this.logger.error(`[ElevenLabs] TTS failed: ${resp.status} — ${errorBody}`);
      throw new Error(`ElevenLabs TTS failed (${resp.status}): ${errorBody}`);
    }

    const arrayBuffer = await resp.arrayBuffer();
    const audio = Buffer.from(arrayBuffer);
    const durationEstimateMs = Math.ceil(request.text.length * 60); // ~60ms per char

    this.logger.info(`[ElevenLabs] Synthesis complete: ${audio.length} bytes, ~${durationEstimateMs}ms duration, latency=${Date.now() - start}ms`);

    return {
      audio,
      contentType: resp.headers.get('content-type') ?? 'audio/mpeg',
      characterCount: request.text.length,
      durationEstimateMs,
      provider: this.name,
    };
  }

  async listVoices(): Promise<VoiceInfo[]> {
    if (!this.isConfigured()) return [];

    this.logger.info('[ElevenLabs] Fetching voice list');

    const resp = await fetch(`${API_BASE}/voices`, {
      headers: { 'xi-api-key': this.config.apiKey },
    });

    if (!resp.ok) {
      this.logger.error(`[ElevenLabs] Failed to list voices: ${resp.status}`);
      throw new Error(`Failed to list voices: ${resp.status} ${resp.statusText}`);
    }

    const data = await resp.json() as {
      voices?: Array<{
        voice_id: string;
        name: string;
        category: string;
        labels: Record<string, string>;
        preview_url?: string;
      }>;
    };

    return (data.voices ?? []).map((v) => ({
      voiceId: v.voice_id,
      name: v.name,
      category: v.category,
      language: v.labels?.language,
      gender: v.labels?.gender,
      previewUrl: v.preview_url,
      labels: v.labels ?? {},
    }));
  }

  async getVoice(voiceId: string): Promise<VoiceInfo | null> {
    if (!this.isConfigured()) return null;

    const resp = await fetch(`${API_BASE}/voices/${voiceId}`, {
      headers: { 'xi-api-key': this.config.apiKey },
    });

    if (!resp.ok) return null;

    const v = await resp.json() as {
      voice_id: string;
      name: string;
      category: string;
      labels: Record<string, string>;
      preview_url?: string;
    };

    return {
      voiceId: v.voice_id,
      name: v.name,
      category: v.category,
      language: v.labels?.language,
      gender: v.labels?.gender,
      previewUrl: v.preview_url,
      labels: v.labels ?? {},
    };
  }
}
