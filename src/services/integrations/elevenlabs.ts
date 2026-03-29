/**
 * ElevenLabs Integration Service — Frontend Client
 *
 * All TTS calls are proxied through the backend /voice API.
 * API keys are stored server-side only (ELEVENLABS_API_KEY).
 *
 * For direct frontend testing with VITE_ELEVENLABS_API_KEY,
 * the service falls back to direct ElevenLabs API calls.
 *
 * SETUP:
 *   1. Create ElevenLabs account at https://elevenlabs.io
 *   2. Generate API key at https://elevenlabs.io/settings/api-keys
 *   3. Set ELEVENLABS_API_KEY in backend .env
 *   4. Configure voice selection via /voice/config endpoint
 */


// ── Types ─────────────────────────────────────────────────

export interface ElevenLabsConfig {
  apiKey: string;
  defaultVoiceId?: string;
  modelId?: string;
}

export interface TTSRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  outputFormat?: 'mp3_44100_128' | 'mp3_22050_32' | 'pcm_16000' | 'pcm_44100' | 'ulaw_8000';
}

export interface TTSResponse {
  audioBlob: Blob;
  contentType: string;
  characterCount: number;
}

export interface VoiceInfo {
  voiceId: string;
  name: string;
  category: string;
  language?: string;
  gender?: string;
  previewUrl?: string;
  labels: Record<string, string>;
}

export interface VoiceHealthCheck {
  provider: string;
  configured: boolean;
  status: 'healthy' | 'degraded' | 'error' | 'not_configured';
  message: string;
  latencyMs: number;
  quotaRemaining?: number;
  tier?: string;
}

export interface VoiceConfig {
  provider: string;
  configured: boolean;
  defaultVoiceId?: string;
  defaultModel?: string;
  stability?: number;
  similarityBoost?: number;
  greetingMode?: 'ai' | 'human' | 'mixed';
  greetingVoiceId?: string;
  enabled?: boolean;
}

export interface GreetingTemplate {
  id: string;
  name: string;
  textEs: string;
  textEn: string;
  context: 'default' | 'after_hours' | 'emergency' | 'maintenance' | 'custom';
}

export interface TestConnectionResult {
  health: VoiceHealthCheck;
  synthesis?: {
    success: boolean;
    audioBytes: number;
    durationEstimateMs: number;
    error?: string;
  };
}

// ── Backend Voice API Base ────────────────────────────────

const BACKEND_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('aion_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function voiceApiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const headers = getAuthHeaders();
  const resp = await fetch(`${BACKEND_BASE}/voice-api${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers || {}) },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `Voice API error ${resp.status}`);
  }
  return resp.json();
}

async function voiceApiFetchBlob(path: string, options?: RequestInit): Promise<{ blob: Blob; headers: Headers }> {
  const headers = getAuthHeaders();
  const resp = await fetch(`${BACKEND_BASE}/voice-api${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers || {}) },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `Voice API error ${resp.status}`);
  }
  return { blob: await resp.blob(), headers: resp.headers };
}

// ── Service Class ─────────────────────────────────────────

export class ElevenLabsService {
  private frontendApiKey: string;

  constructor(config?: Partial<ElevenLabsConfig>) {
    this.frontendApiKey = config?.apiKey || import.meta.env.VITE_ELEVENLABS_API_KEY || '';
  }

  /** Check if backend voice service is configured */
  isConfigured(): boolean {
    return this.frontendApiKey.length > 0;
  }

  /** Test connection via backend */
  async testConnection(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    try {
      const result = await voiceApiFetch<{ data: TestConnectionResult }>('/test', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const health = result.data.health;
      return {
        success: health.status === 'healthy',
        message: health.message,
        latencyMs: health.latencyMs,
      };
    } catch {
      // Fallback to direct API if backend not available
      if (!this.frontendApiKey) {
        return { success: false, message: 'Voice not configured. Set ELEVENLABS_API_KEY in backend .env', latencyMs: 0 };
      }
      return this.testConnectionDirect();
    }
  }

  /** Direct test (fallback) */
  private async testConnectionDirect(): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    try {
      const resp = await fetch(`${ELEVENLABS_API_BASE}/user`, {
        headers: { 'xi-api-key': this.frontendApiKey },
      });
      const latencyMs = Date.now() - start;
      if (!resp.ok) return { success: false, message: `API error: ${resp.status}`, latencyMs };
      const user = await resp.json();
      return {
        success: true,
        message: `Connected (${user.subscription?.tier || 'user'}). Chars: ${user.subscription?.character_count ?? '?'}`,
        latencyMs,
      };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Connection failed', latencyMs: Date.now() - start };
    }
  }

  /** Synthesize text to speech via backend */
  async synthesize(request: TTSRequest): Promise<TTSResponse> {
    try {
      const { blob, headers } = await voiceApiFetchBlob('/synthesize', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      return {
        audioBlob: blob,
        contentType: headers.get('content-type') || 'audio/mpeg',
        characterCount: request.text.length,
      };
    } catch {
      // Fallback to direct if backend unavailable
      if (!this.frontendApiKey) throw new Error('Voice not configured');
      return this.synthesizeDirect(request);
    }
  }

  /** Direct synthesis (fallback) */
  private async synthesizeDirect(request: TTSRequest): Promise<TTSResponse> {
    const voiceId = request.voiceId || '21m00Tcm4TlvDq8ikWAM';
    const resp = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': this.frontendApiKey, Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: request.text,
        model_id: request.modelId || 'eleven_multilingual_v2',
        voice_settings: { stability: request.stability ?? 0.5, similarity_boost: request.similarityBoost ?? 0.75 },
      }),
    });
    if (!resp.ok) {
      const error = await resp.json().catch(() => ({ detail: resp.statusText }));
      throw new Error(`ElevenLabs TTS failed: ${error.detail || resp.statusText}`);
    }
    return { audioBlob: await resp.blob(), contentType: resp.headers.get('content-type') || 'audio/mpeg', characterCount: request.text.length };
  }

  /** List available voices via backend */
  async listVoices(): Promise<VoiceInfo[]> {
    try {
      const result = await voiceApiFetch<{ data: VoiceInfo[] }>('/voices');
      return result.data;
    } catch {
      if (!this.frontendApiKey) return [];
      const resp = await fetch(`${ELEVENLABS_API_BASE}/voices`, { headers: { 'xi-api-key': this.frontendApiKey } });
      if (!resp.ok) return [];
      const data = await resp.json();
      return (data.voices || []).map((v: any) => ({
        voiceId: v.voice_id, name: v.name, category: v.category,
        language: v.labels?.language, gender: v.labels?.gender,
        previewUrl: v.preview_url, labels: v.labels ?? {},
      }));
    }
  }

  /** Get health check via backend */
  async healthCheck(): Promise<VoiceHealthCheck> {
    try {
      const result = await voiceApiFetch<{ data: VoiceHealthCheck }>('/health');
      return result.data;
    } catch {
      return {
        provider: 'unknown', configured: false, status: 'not_configured',
        message: 'Backend voice API not reachable', latencyMs: 0,
      };
    }
  }

  /** Get voice config from backend */
  async getConfig(): Promise<VoiceConfig> {
    try {
      const result = await voiceApiFetch<{ data: VoiceConfig }>('/config');
      return result.data;
    } catch {
      return { provider: 'noop', configured: false };
    }
  }

  /** Get greeting templates */
  async getGreetingTemplates(): Promise<GreetingTemplate[]> {
    try {
      const result = await voiceApiFetch<{ data: GreetingTemplate[] }>('/greetings/templates');
      return result.data;
    } catch {
      return [];
    }
  }

  /** Generate and play greeting */
  async generateGreeting(context: string, language: string, siteName?: string, voiceId?: string): Promise<TTSResponse> {
    const { blob, headers } = await voiceApiFetchBlob('/greetings/generate', {
      method: 'POST',
      body: JSON.stringify({ context, language, siteName, voiceId }),
    });
    return {
      audioBlob: blob,
      contentType: headers.get('content-type') || 'audio/mpeg',
      characterCount: parseInt(headers.get('x-character-count') || '0', 10),
    };
  }

  /** Synthesize and play audio directly in browser */
  async playTTS(text: string, voiceId?: string): Promise<void> {
    const { audioBlob } = await this.synthesize({ text, voiceId });
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    await audio.play();
    audio.onended = () => URL.revokeObjectURL(audioUrl);
  }
}

// Singleton instance
export const elevenlabs = new ElevenLabsService();
