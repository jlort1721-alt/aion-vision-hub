/**
 * ElevenLabs TTS API Client
 *
 * Provides text-to-speech synthesis, voice listing, and health checks
 * for the intercom greeting/extension system.
 */

import { fetchWithTimeout } from '../lib/http-client.js';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';

function getApiKey(): string {
  return process.env.ELEVENLABS_API_KEY || '';
}

function getHeaders(): Record<string, string> {
  return {
    'xi-api-key': getApiKey(),
    'Content-Type': 'application/json',
  };
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url: string;
}

export interface ElevenLabsSubscription {
  tier: string;
  character_count: number;
  character_limit: number;
  next_character_count_reset_unix: number;
}

/**
 * List all available voices.
 */
export async function listVoices(): Promise<{ voices: ElevenLabsVoice[]; error?: string }> {
  try {
    const resp = await fetchWithTimeout(`${ELEVENLABS_API}/voices`, { headers: getHeaders() });
    if (!resp.ok) return { voices: [], error: `HTTP ${resp.status}` };
    const data = await resp.json() as { voices: ElevenLabsVoice[] };
    return { voices: data.voices || [] };
  } catch (e: unknown) {
    return { voices: [], error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Synthesize text to speech. Returns audio as Buffer.
 */
export async function synthesize(
  text: string,
  voiceId?: string,
  modelId?: string,
): Promise<{ audio: Buffer | null; error?: string }> {
  const voice = voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  const model = modelId || process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

  try {
    const resp = await fetchWithTimeout(`${ELEVENLABS_API}/text-to-speech/${voice}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        text,
        model_id: model,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { audio: null, error: `ElevenLabs error ${resp.status}: ${err}` };
    }

    const arrayBuffer = await resp.arrayBuffer();
    return { audio: Buffer.from(arrayBuffer) };
  } catch (e: unknown) {
    return { audio: null, error: e instanceof Error ? e.message : 'Synthesis failed' };
  }
}

/**
 * Get subscription/quota info.
 */
export async function getSubscription(): Promise<{ subscription: ElevenLabsSubscription | null; error?: string }> {
  try {
    const resp = await fetchWithTimeout(`${ELEVENLABS_API}/user/subscription`, { headers: getHeaders() });
    if (!resp.ok) return { subscription: null, error: `HTTP ${resp.status}` };
    const data = await resp.json() as ElevenLabsSubscription;
    return { subscription: data };
  } catch (e: unknown) {
    return { subscription: null, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

/**
 * Health check: verify API key, get quota.
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number;
  tier?: string;
  charactersUsed?: number;
  charactersLimit?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    if (!getApiKey()) {
      return { status: 'down', latencyMs: 0, error: 'ELEVENLABS_API_KEY not configured' };
    }

    const { subscription, error } = await getSubscription();
    const latencyMs = Date.now() - start;

    if (!subscription) {
      return { status: 'down', latencyMs, error };
    }

    return {
      status: 'healthy',
      latencyMs,
      tier: subscription.tier,
      charactersUsed: subscription.character_count,
      charactersLimit: subscription.character_limit,
    };
  } catch {
    return { status: 'down', latencyMs: Date.now() - start, error: 'Connection failed' };
  }
}

/**
 * Check if ElevenLabs is configured.
 */
export function isConfigured(): boolean {
  return !!getApiKey();
}
