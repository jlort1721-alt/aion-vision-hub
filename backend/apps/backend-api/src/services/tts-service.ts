/**
 * TTS Service — Text-to-Speech for Asterisk IVR
 *
 * Generates speech audio from text for the phone system.
 * Primary: ElevenLabs API (if ELEVENLABS_API_KEY is configured).
 * Fallback: Edge TTS (Microsoft, free) via subprocess + ffmpeg conversion.
 *
 * Audio output format: WAV (8kHz mono, compatible with Asterisk).
 */
import { createLogger } from '@aion/common-utils';
import { execFile } from 'node:child_process';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const logger = createLogger({ name: 'tts-service' });

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TTSOptions {
  language?: string;   // default 'es'
  voice?: 'female' | 'male';
}

interface CommonMessages {
  welcome: string;
  'welcome-night': string;
  identify: string;
  'calling-resident': string;
  'access-granted': string;
  'access-denied': string;
  goodbye: string;
  error: string;
}

// ── Edge TTS voice mapping ───────────────────────────────────────────────────

const EDGE_VOICES: Record<string, { female: string; male: string }> = {
  es: { female: 'es-CO-SalomeNeural', male: 'es-CO-GonzaloNeural' },
  en: { female: 'en-US-JennyNeural', male: 'en-US-GuyNeural' },
  pt: { female: 'pt-BR-FranciscaNeural', male: 'pt-BR-AntonioNeural' },
};

// ── Predefined messages ──────────────────────────────────────────────────────

const COMMON_MESSAGES: CommonMessages = {
  welcome: 'Bienvenido al sistema de acceso. Por favor identifíquese.',
  'welcome-night': 'Buenas noches. Bienvenido al sistema de acceso. Por favor identifíquese.',
  identify: 'Por favor indique su nombre y el apartamento que visita.',
  'calling-resident': 'Un momento por favor, estamos contactando al residente.',
  'access-granted': 'Acceso autorizado. Puede ingresar.',
  'access-denied': 'Lo sentimos, el acceso no ha sido autorizado.',
  goodbye: 'Gracias por su visita. Hasta luego.',
  error: 'Ha ocurrido un error. Por favor intente nuevamente o comuníquese con portería.',
};

// ── Helper: determine voice by time of day ───────────────────────────────────

function resolveVoice(options?: TTSOptions): 'female' | 'male' {
  if (options?.voice) return options.voice;
  const hour = new Date().getHours();
  // Day: 6am–6pm → female, Night → male
  return hour >= 6 && hour < 18 ? 'female' : 'male';
}

// ── Helper: run subprocess ───────────────────────────────────────────────────

function execAsync(
  cmd: string,
  args: string[],
  timeoutMs = 30_000,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve({ stdout: stdout?.toString() ?? '', stderr: stderr?.toString() ?? '' });
    });
  });
}

// ── ElevenLabs synthesis ─────────────────────────────────────────────────────

async function synthesizeElevenLabs(text: string): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  const voiceId = process.env.ELEVENLABS_DEFAULT_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

  try {
    const resp = await fetch(`${ELEVENLABS_API}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      logger.warn({ status: resp.status, errText }, 'ElevenLabs synthesis failed, will fallback');
      return null;
    }

    const arrayBuffer = await resp.arrayBuffer();
    const mp3Buffer = Buffer.from(arrayBuffer);

    // Convert MP3 → WAV (8kHz mono for Asterisk)
    return await convertToWav(mp3Buffer, 'mp3');
  } catch (err) {
    logger.warn({ err }, 'ElevenLabs API error, will fallback to Edge TTS');
    return null;
  }
}

// ── Edge TTS synthesis (fallback) ────────────────────────────────────────────

async function synthesizeEdgeTTS(
  text: string,
  language: string,
  voice: 'female' | 'male',
): Promise<Buffer> {
  const lang = EDGE_VOICES[language] ? language : 'es';
  const voiceName = EDGE_VOICES[lang][voice];

  const id = randomUUID();
  const mp3Path = join(tmpdir(), `tts-${id}.mp3`);
  const wavPath = join(tmpdir(), `tts-${id}.wav`);

  try {
    await execAsync('edge-tts', [
      '--voice', voiceName,
      '--text', text,
      '--write-media', mp3Path,
    ]);

    // Convert mp3 → WAV (8kHz mono, 16-bit, for Asterisk)
    await execAsync('ffmpeg', [
      '-y', '-i', mp3Path,
      '-ar', '8000',
      '-ac', '1',
      '-sample_fmt', 's16',
      '-f', 'wav',
      wavPath,
    ]);

    const wavBuffer = await readFile(wavPath);
    return wavBuffer;
  } finally {
    // Cleanup temp files
    await unlink(mp3Path).catch(() => {});
    await unlink(wavPath).catch(() => {});
  }
}

// ── Convert raw audio buffer to WAV via ffmpeg ───────────────────────────────

async function convertToWav(audioBuffer: Buffer, inputFormat: string): Promise<Buffer> {
  const id = randomUUID();
  const inputPath = join(tmpdir(), `tts-input-${id}.${inputFormat}`);
  const outputPath = join(tmpdir(), `tts-output-${id}.wav`);

  try {
    await writeFile(inputPath, audioBuffer);

    await execAsync('ffmpeg', [
      '-y', '-i', inputPath,
      '-ar', '8000',
      '-ac', '1',
      '-sample_fmt', 's16',
      '-f', 'wav',
      outputPath,
    ]);

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

// ── TTS Service class ────────────────────────────────────────────────────────

class TTSService {
  private cache = new Map<string, Buffer>();

  /**
   * Synthesize text to speech. Returns WAV audio buffer.
   * Tries ElevenLabs first, falls back to Edge TTS.
   */
  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    const language = options?.language ?? 'es';
    const voice = resolveVoice(options);
    const cacheKey = `${language}:${voice}:${text}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug({ cacheKey }, 'TTS cache hit');
      return cached;
    }

    let audioBuffer: Buffer | null = null;

    // Primary: ElevenLabs
    if (process.env.ELEVENLABS_API_KEY) {
      logger.debug('Attempting ElevenLabs synthesis');
      audioBuffer = await synthesizeElevenLabs(text);
    }

    // Fallback: Edge TTS
    if (!audioBuffer) {
      logger.debug({ voice, language }, 'Using Edge TTS fallback');
      audioBuffer = await synthesizeEdgeTTS(text, language, voice);
    }

    // Cache the result
    this.cache.set(cacheKey, audioBuffer);
    logger.info({ text: text.substring(0, 50), voice, language, bytes: audioBuffer.length }, 'TTS synthesized');

    return audioBuffer;
  }

  /**
   * Pre-generate common IVR messages as WAV files.
   * Generates both female (day) and male (night) variants where applicable.
   */
  async preGenerateMessages(): Promise<{ generated: number; errors: string[] }> {
    const errors: string[] = [];
    let generated = 0;

    const keys = Object.keys(COMMON_MESSAGES) as (keyof CommonMessages)[];

    for (const key of keys) {
      const text = COMMON_MESSAGES[key];
      const voice: 'female' | 'male' = key === 'welcome-night' ? 'male' : 'female';

      try {
        await this.synthesize(text, { language: 'es', voice });
        generated++;
        logger.info({ key, voice }, 'Pre-generated TTS message');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${key}: ${msg}`);
        logger.error({ key, err }, 'Failed to pre-generate TTS message');
      }
    }

    // Also generate male variants of daytime messages for completeness
    for (const key of ['welcome', 'identify', 'calling-resident', 'access-granted', 'access-denied', 'goodbye', 'error'] as const) {
      const text = COMMON_MESSAGES[key];
      try {
        await this.synthesize(text, { language: 'es', voice: 'male' });
        generated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${key}-male: ${msg}`);
      }
    }

    logger.info({ generated, errors: errors.length }, 'TTS pre-generation complete');
    return { generated, errors };
  }

  /**
   * Get a pre-generated common message by key.
   * Falls back to on-the-fly synthesis if not cached.
   */
  async getMessage(
    key: keyof CommonMessages,
    options?: TTSOptions,
  ): Promise<Buffer> {
    const text = COMMON_MESSAGES[key];
    if (!text) throw new Error(`Unknown TTS message key: ${key}`);
    return this.synthesize(text, options);
  }

  /**
   * Clear the audio cache.
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info({ cleared: size }, 'TTS cache cleared');
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { entries: number; estimatedSizeMB: number } {
    let totalBytes = 0;
    for (const buf of this.cache.values()) {
      totalBytes += buf.length;
    }
    return {
      entries: this.cache.size,
      estimatedSizeMB: Math.round((totalBytes / 1024 / 1024) * 100) / 100,
    };
  }
}

export const ttsService = new TTSService();
