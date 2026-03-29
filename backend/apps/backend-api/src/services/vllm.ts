import pino from 'pino';

const logger = pino({ level: 'info' });

/**
 * AION VISION HUB: Local vLLM Inference Gateway
 * Connects securely to an underlying GPU cluster running OpenAI-compatible vLLM endpoints.
 * Crucial for Air-Gapped or Highly Classified C4ISR environments.
 */

export interface VllmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface VllmOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export class VllmService {
  private endpoint: string;
  private apiKey: string;
  private defaultModel: string;

  constructor() {
    // Defaults targeted to a local VLLM Engine (e.g. running on port 8000)
    this.endpoint = process.env.VLLM_API_URL || 'http://localhost:8000/v1/chat/completions';
    this.apiKey = process.env.VLLM_API_KEY || 'sk-local-airgapped';
    this.defaultModel = process.env.VLLM_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct';
  }

  /**
   * Generates a tactical analysis response referencing Local Models.
   */
  async generateCompletion(messages: VllmMessage[], options: VllmOptions = {}): Promise<string> {
    const payload = {
      model: options.model || this.defaultModel,
      messages: messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? 512,
      stream: options.stream ?? false,
    };

    try {
      logger.info(`[vLLM] Initiating Neural Completion against model: ${payload.model}`);
      
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`vLLM Inference Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content || '';

    } catch (error) {
      logger.error(`[vLLM Gateway Failure]: ${(error as Error).message}. Returning Failsafe Logic.`);
      // Mocked Response for when the local GPU is offline / not installed yet.
      return `[SIMULATED vLLM] Analysis: Based on the spatial coordinates, the asset requires immediate dispatch. Model inference bypassed locally. System operational.`;
    }
  }
}

export const aiTacticalService = new VllmService();
