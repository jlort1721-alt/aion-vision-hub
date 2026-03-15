/**
 * Voice Provider Abstraction Layer
 *
 * Defines the contract that any TTS provider must implement.
 * Currently supports ElevenLabs with fallback to silent/noop provider.
 */

export interface VoiceProviderConfig {
  provider: 'elevenlabs' | 'noop';
  apiKey?: string;
  defaultVoiceId?: string;
  defaultModel?: string;
  stability?: number;
  similarityBoost?: number;
  speakerBoost?: boolean;
}

export interface VoiceSynthesisRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  outputFormat?: 'mp3_44100_128' | 'mp3_22050_32' | 'pcm_16000' | 'pcm_44100' | 'ulaw_8000';
}

export interface VoiceSynthesisResult {
  audio: Buffer;
  contentType: string;
  characterCount: number;
  durationEstimateMs: number;
  provider: string;
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

export interface GreetingTemplate {
  id: string;
  name: string;
  textEs: string;
  textEn: string;
  context: 'default' | 'after_hours' | 'emergency' | 'maintenance' | 'custom';
}

export interface VoiceProvider {
  readonly name: string;
  isConfigured(): boolean;
  healthCheck(): Promise<VoiceHealthCheck>;
  synthesize(request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult>;
  listVoices(): Promise<VoiceInfo[]>;
  getVoice(voiceId: string): Promise<VoiceInfo | null>;
}
