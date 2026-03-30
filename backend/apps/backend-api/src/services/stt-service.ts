/**
 * STT Service — Speech-to-Text using Whisper
 *
 * Transcribes audio from intercom/phone systems to text.
 * Primary: OpenAI Whisper API (cloud).
 * Fallback: Local faster-whisper via subprocess.
 *
 * Also provides helpers for extracting apartment numbers from spoken
 * text and classifying visitor type (resident, visitor, delivery).
 */
import { createLogger } from '@aion/common-utils';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const logger = createLogger({ name: 'stt-service' });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';
const WHISPER_MODEL = 'whisper-1';
const DEFAULT_LANGUAGE = 'es';
const WHISPER_TIMEOUT_MS = 30_000;
const LOCAL_WHISPER_TIMEOUT_MS = 60_000;

// ── Types ───────────────────────────────────────────────────────────────────

export type VisitorClassification = 'resident' | 'visitor' | 'delivery' | 'unknown';

// ── Helper: run subprocess ──────────────────────────────────────────────────

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

// ── Number word mapping (Spanish) ───────────────────────────────────────────

const SPANISH_NUMBERS: Record<string, string> = {
  cero: '0',
  uno: '1',
  una: '1',
  dos: '2',
  tres: '3',
  cuatro: '4',
  cinco: '5',
  seis: '6',
  siete: '7',
  ocho: '8',
  nueve: '9',
  diez: '10',
  once: '11',
  doce: '12',
  trece: '13',
  catorce: '14',
  quince: '15',
};

// ── STT Service Class ───────────────────────────────────────────────────────

class STTService {
  /**
   * Transcribe an audio file to text.
   * Tries OpenAI Whisper API first, falls back to local faster-whisper.
   */
  async transcribe(audioPath: string, language?: string): Promise<string> {
    const lang = language ?? DEFAULT_LANGUAGE;

    if (!existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    // Primary: OpenAI Whisper API
    if (OPENAI_API_KEY) {
      try {
        const result = await this.transcribeWithOpenAI(audioPath, lang);
        if (result) {
          logger.info({ audioPath, language: lang, chars: result.length }, 'Transcribed via OpenAI Whisper');
          return result;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn({ audioPath, error: message }, 'OpenAI Whisper failed, trying local fallback');
      }
    } else {
      logger.debug('OPENAI_API_KEY not set, skipping cloud Whisper');
    }

    // Fallback: local faster-whisper
    try {
      const result = await this.transcribeWithLocalWhisper(audioPath, lang);
      logger.info({ audioPath, language: lang, chars: result.length }, 'Transcribed via local faster-whisper');
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ audioPath, error: message }, 'Local faster-whisper also failed');
      throw new Error(`All STT backends failed for ${audioPath}: ${message}`);
    }
  }

  /**
   * Extract apartment number from spoken text.
   *
   * Handles patterns like:
   *   "apartamento 301", "apto 301", "el 301",
   *   "tres cero uno" (spoken digits)
   *
   * Returns the apartment number as a string, or null if not found.
   */
  extractApartmentNumber(text: string): string | null {
    if (!text) return null;

    const normalized = text.toLowerCase().trim();

    // Pattern 1: "apartamento NNN", "apto NNN", "apto. NNN"
    const aptoMatch = normalized.match(/(?:apartamento|apto\.?|apt\.?)\s*(\d{1,5})/);
    if (aptoMatch) return aptoMatch[1];

    // Pattern 2: "el NNN" (common shorthand: "el 301")
    const elMatch = normalized.match(/\bel\s+(\d{1,5})\b/);
    if (elMatch) return elMatch[1];

    // Pattern 3: "torre X apartamento NNN" or "torre X apto NNN"
    const torreAptoMatch = normalized.match(/torre\s*\w+\s*(?:apartamento|apto\.?)\s*(\d{1,5})/);
    if (torreAptoMatch) return torreAptoMatch[1];

    // Pattern 4: "casa NNN"
    const casaMatch = normalized.match(/\bcasa\s+(\d{1,5})\b/);
    if (casaMatch) return casaMatch[1];

    // Pattern 5: Spoken digits — "tres cero uno" → "301"
    const spokenDigits = this.parseSpokenDigits(normalized);
    if (spokenDigits && spokenDigits.length >= 2 && spokenDigits.length <= 5) {
      return spokenDigits;
    }

    // Pattern 6: standalone number that looks like an apartment (2-5 digits)
    const standaloneMatch = normalized.match(/\b(\d{2,5})\b/);
    if (standaloneMatch) return standaloneMatch[1];

    return null;
  }

  /**
   * Classify a visitor based on spoken text content.
   *
   * Categories:
   *   - 'delivery': domiciliario, rappi, pedido, uber eats, entrega, paquete, mercado
   *   - 'resident': residente, vivo aqui, soy del, mi apartamento, propietario
   *   - 'visitor': visita, vengo a ver, me esperan
   *   - 'unknown': no match
   */
  classifyVisitor(text: string): VisitorClassification {
    if (!text) return 'unknown';

    const normalized = text.toLowerCase().trim();

    // Delivery keywords
    const deliveryKeywords = [
      'domiciliario',
      'domicilio',
      'rappi',
      'pedido',
      'uber eats',
      'ubereats',
      'didi food',
      'entrega',
      'paquete',
      'mercado',
      'envio',
      'envío',
      'mensajero',
      'correspondencia',
      'correo',
    ];

    for (const keyword of deliveryKeywords) {
      if (normalized.includes(keyword)) {
        logger.debug({ text: normalized, keyword, classification: 'delivery' }, 'Visitor classified');
        return 'delivery';
      }
    }

    // Resident keywords
    const residentKeywords = [
      'residente',
      'vivo aquí',
      'vivo aqui',
      'vivo aca',
      'vivo acá',
      'soy del',
      'mi apartamento',
      'mi apto',
      'propietario',
      'propietaria',
      'inquilino',
      'inquilina',
      'yo vivo',
      'mi casa',
    ];

    for (const keyword of residentKeywords) {
      if (normalized.includes(keyword)) {
        logger.debug({ text: normalized, keyword, classification: 'resident' }, 'Visitor classified');
        return 'resident';
      }
    }

    // Visitor keywords
    const visitorKeywords = [
      'visita',
      'vengo a ver',
      'me esperan',
      'me están esperando',
      'me estan esperando',
      'invitado',
      'invitada',
      'vengo donde',
      'busco a',
      'vengo a visitar',
    ];

    for (const keyword of visitorKeywords) {
      if (normalized.includes(keyword)) {
        logger.debug({ text: normalized, keyword, classification: 'visitor' }, 'Visitor classified');
        return 'visitor';
      }
    }

    logger.debug({ text: normalized, classification: 'unknown' }, 'Visitor classification: no match');
    return 'unknown';
  }

  /**
   * Check whether the cloud STT service is properly configured.
   */
  isConfigured(): boolean {
    return !!OPENAI_API_KEY;
  }

  /**
   * Return current service status for health checks.
   */
  getStatus(): Record<string, unknown> {
    return {
      configured: this.isConfigured(),
      provider: this.isConfigured() ? 'openai-whisper' : 'local-faster-whisper',
      model: WHISPER_MODEL,
      defaultLanguage: DEFAULT_LANGUAGE,
      message: this.isConfigured()
        ? 'STT active with OpenAI Whisper API'
        : 'Set OPENAI_API_KEY for cloud STT; local faster-whisper as fallback',
    };
  }

  // ── Private: OpenAI Whisper API ───────────────────────────────────────────

  private async transcribeWithOpenAI(audioPath: string, language: string): Promise<string | null> {
    const audioBuffer = await readFile(audioPath);
    const fileName = audioPath.split('/').pop() || 'audio.wav';

    // Determine MIME type from extension
    const ext = fileName.split('.').pop()?.toLowerCase() ?? 'wav';
    const mimeTypes: Record<string, string> = {
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      ogg: 'audio/ogg',
      webm: 'audio/webm',
      flac: 'audio/flac',
    };
    const mimeType = mimeTypes[ext] ?? 'audio/wav';

    // Build multipart/form-data manually
    const boundary = `----AionSTTBoundary${Date.now()}`;
    const parts: Buffer[] = [];

    // File part
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
    ));
    parts.push(audioBuffer);
    parts.push(Buffer.from('\r\n'));

    // Model part
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="model"\r\n\r\n` +
      `${WHISPER_MODEL}\r\n`,
    ));

    // Language part
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="language"\r\n\r\n` +
      `${language}\r\n`,
    ));

    // Response format part
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="response_format"\r\n\r\n` +
      `text\r\n`,
    ));

    // Closing boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WHISPER_TIMEOUT_MS);

    try {
      const resp = await fetch(OPENAI_WHISPER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => 'unknown');
        logger.warn({ status: resp.status, errText }, 'OpenAI Whisper API error');
        return null;
      }

      const text = await resp.text();
      return text.trim();
    } finally {
      clearTimeout(timeout);
    }
  }

  // ── Private: Local faster-whisper fallback ────────────────────────────────

  private async transcribeWithLocalWhisper(audioPath: string, language: string): Promise<string> {
    // Escape single quotes in audioPath for safe embedding in Python string
    const safePath = audioPath.replace(/'/g, "\\'");

    const pythonScript = [
      'from faster_whisper import WhisperModel;',
      `m=WhisperModel('tiny',device='cpu');`,
      `segs,_=m.transcribe('${safePath}',language='${language}');`,
      `print(' '.join(s.text for s in segs))`,
    ].join(' ');

    const { stdout, stderr } = await execAsync(
      'python3',
      ['-c', pythonScript],
      LOCAL_WHISPER_TIMEOUT_MS,
    );

    if (stderr) {
      logger.debug({ stderr: stderr.substring(0, 200) }, 'faster-whisper stderr (may be progress info)');
    }

    const result = stdout.trim();
    if (!result) {
      throw new Error('Local faster-whisper returned empty transcription');
    }

    return result;
  }

  // ── Private: Parse spoken digits ──────────────────────────────────────────

  /**
   * Parse spoken Spanish digit words into a number string.
   * Example: "tres cero uno" → "301"
   *
   * Only returns a result if the text contains a sequence of number words
   * that looks like an apartment/unit number.
   */
  private parseSpokenDigits(text: string): string | null {
    const words = text.split(/\s+/);
    let digitSequence = '';
    let foundAny = false;

    for (const word of words) {
      const digit = SPANISH_NUMBERS[word];
      if (digit !== undefined) {
        // For numbers > 9 (diez, once, etc.), use as-is
        digitSequence += digit;
        foundAny = true;
      } else if (foundAny) {
        // Stop accumulating once we hit a non-number word after finding digits
        break;
      }
    }

    return foundAny ? digitSequence : null;
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

export const sttService = new STTService();
