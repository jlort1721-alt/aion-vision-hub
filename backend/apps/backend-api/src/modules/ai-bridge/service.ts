import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { aiSessions } from '../../db/schema/index.js';
import { config } from '../../config/env.js';
import { AppError, ErrorCodes } from '@aion/shared-contracts';
import type { ChatRequestInput, UsageQueryInput } from './schemas.js';

// ── Provider Response Types ───────────────────────────────────

interface ChatCompletionResult {
  content: string;
  model: string;
  provider: string;
  tokens: { prompt: number; completion: number };
  finishReason: string;
}

// ── AI Bridge Service ─────────────────────────────────────────

export class AIBridgeService {
  /**
   * Resolve which provider and model to use.
   * Priority: explicit request -> available keys -> error.
   */
  private resolveProvider(requestedProvider?: string, requestedModel?: string): {
    provider: 'openai' | 'anthropic';
    model: string;
    apiKey: string;
  } {
    const provider = requestedProvider as 'openai' | 'anthropic' | undefined;

    if (provider === 'openai' || (!provider && config.OPENAI_API_KEY)) {
      if (!config.OPENAI_API_KEY) {
        throw new AppError(
          ErrorCodes.AI_PROVIDER_ERROR,
          'OpenAI API key is not configured',
          503,
        );
      }
      return {
        provider: 'openai',
        model: requestedModel ?? 'gpt-4o',
        apiKey: config.OPENAI_API_KEY,
      };
    }

    if (provider === 'anthropic' || (!provider && config.ANTHROPIC_API_KEY)) {
      if (!config.ANTHROPIC_API_KEY) {
        throw new AppError(
          ErrorCodes.AI_PROVIDER_ERROR,
          'Anthropic API key is not configured',
          503,
        );
      }
      return {
        provider: 'anthropic',
        model: requestedModel ?? 'claude-sonnet-4-20250514',
        apiKey: config.ANTHROPIC_API_KEY,
      };
    }

    throw new AppError(
      ErrorCodes.AI_PROVIDER_ERROR,
      'No AI provider is configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.',
      503,
    );
  }

  /**
   * Send a chat message to the configured AI provider and return the response.
   */
  async chat(params: ChatRequestInput, tenantId: string, userId: string): Promise<ChatCompletionResult> {
    const { provider, model, apiKey } = this.resolveProvider(params.provider, params.model);

    let result: ChatCompletionResult;

    if (provider === 'openai') {
      result = await this.chatOpenAI(params, model, apiKey);
    } else {
      result = await this.chatAnthropic(params, model, apiKey);
    }

    // Persist session record for usage tracking
    await db.insert(aiSessions).values({
      tenantId,
      userId,
      provider,
      model: result.model,
      messages: params.messages,
      totalTokens: result.tokens.prompt + result.tokens.completion,
    });

    return result;
  }

  /**
   * Stream a chat response via SSE from the configured AI provider.
   * Returns an async iterable of content chunks.
   */
  async *chatStream(
    params: ChatRequestInput,
    tenantId: string,
    userId: string,
  ): AsyncGenerator<{ content: string; done: boolean }> {
    const { provider, model, apiKey } = this.resolveProvider(params.provider, params.model);

    let totalContent = '';

    if (provider === 'openai') {
      yield* this.streamOpenAI(params, model, apiKey, (chunk) => {
        totalContent += chunk;
      });
    } else {
      yield* this.streamAnthropic(params, model, apiKey, (chunk) => {
        totalContent += chunk;
      });
    }

    // Persist session after stream completes
    await db.insert(aiSessions).values({
      tenantId,
      userId,
      provider,
      model,
      messages: params.messages,
      totalTokens: Math.ceil(totalContent.length / 4), // Approximate token count
    });
  }

  /**
   * Get AI usage statistics for a tenant.
   */
  async getUsage(tenantId: string, query?: UsageQueryInput) {
    const conditions = [eq(aiSessions.tenantId, tenantId)];

    if (query?.from) {
      conditions.push(gte(aiSessions.createdAt, new Date(query.from)));
    }
    if (query?.to) {
      conditions.push(lte(aiSessions.createdAt, new Date(query.to)));
    }
    if (query?.provider) {
      conditions.push(eq(aiSessions.provider, query.provider));
    }

    const sessions = await db
      .select()
      .from(aiSessions)
      .where(and(...conditions))
      .orderBy(desc(aiSessions.createdAt));

    const totalTokens = sessions.reduce(
      (sum, s) => sum + (s.totalTokens ?? 0),
      0,
    );

    // Aggregate by provider
    const byProvider = sessions.reduce<Record<string, { sessions: number; tokens: number }>>(
      (acc, s) => {
        if (!acc[s.provider]) {
          acc[s.provider] = { sessions: 0, tokens: 0 };
        }
        acc[s.provider].sessions += 1;
        acc[s.provider].tokens += s.totalTokens ?? 0;
        return acc;
      },
      {},
    );

    // Aggregate by model
    const byModel = sessions.reduce<Record<string, { sessions: number; tokens: number }>>(
      (acc, s) => {
        if (!acc[s.model]) {
          acc[s.model] = { sessions: 0, tokens: 0 };
        }
        acc[s.model].sessions += 1;
        acc[s.model].tokens += s.totalTokens ?? 0;
        return acc;
      },
      {},
    );

    return {
      totalSessions: sessions.length,
      totalTokens,
      byProvider,
      byModel,
    };
  }

  // ── OpenAI Implementation ─────────────────────────────────────

  private async chatOpenAI(
    params: ChatRequestInput,
    model: string,
    apiKey: string,
  ): Promise<ChatCompletionResult> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new AppError(
        ErrorCodes.AI_PROVIDER_ERROR,
        `OpenAI API error (${response.status}): ${errorBody}`,
        response.status === 429 ? 429 : 502,
      );
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      model: string;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    const choice = data.choices[0];

    return {
      content: choice.message.content,
      model: data.model,
      provider: 'openai',
      tokens: {
        prompt: data.usage.prompt_tokens,
        completion: data.usage.completion_tokens,
      },
      finishReason: choice.finish_reason,
    };
  }

  private async *streamOpenAI(
    params: ChatRequestInput,
    model: string,
    apiKey: string,
    onChunk: (content: string) => void,
  ): AsyncGenerator<{ content: string; done: boolean }> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new AppError(
        ErrorCodes.AI_PROVIDER_ERROR,
        `OpenAI streaming error (${response.status}): ${errorBody}`,
        502,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, 'No response body from OpenAI', 502);
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          const payload = trimmed.slice(6);
          if (payload === '[DONE]') {
            yield { content: '', done: true };
            return;
          }

          try {
            const parsed = JSON.parse(payload) as {
              choices: Array<{ delta: { content?: string }; finish_reason: string | null }>;
            };
            const content = parsed.choices[0]?.delta?.content ?? '';
            if (content) {
              onChunk(content);
              yield { content, done: false };
            }
          } catch {
            // Skip malformed SSE chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { content: '', done: true };
  }

  // ── Anthropic Implementation ──────────────────────────────────

  private async chatAnthropic(
    params: ChatRequestInput,
    model: string,
    apiKey: string,
  ): Promise<ChatCompletionResult> {
    // Anthropic expects system message separately
    const systemMessage = params.messages.find((m) => m.role === 'system');
    const nonSystemMessages = params.messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model,
      messages: nonSystemMessages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperature,
    };
    if (systemMessage) {
      body.system = systemMessage.content;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new AppError(
        ErrorCodes.AI_PROVIDER_ERROR,
        `Anthropic API error (${response.status}): ${errorBody}`,
        response.status === 429 ? 429 : 502,
      );
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
      model: string;
      usage: { input_tokens: number; output_tokens: number };
      stop_reason: string;
    };

    const textContent = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      content: textContent,
      model: data.model,
      provider: 'anthropic',
      tokens: {
        prompt: data.usage.input_tokens,
        completion: data.usage.output_tokens,
      },
      finishReason: data.stop_reason,
    };
  }

  private async *streamAnthropic(
    params: ChatRequestInput,
    model: string,
    apiKey: string,
    onChunk: (content: string) => void,
  ): AsyncGenerator<{ content: string; done: boolean }> {
    const systemMessage = params.messages.find((m) => m.role === 'system');
    const nonSystemMessages = params.messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model,
      messages: nonSystemMessages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperature,
      stream: true,
    };
    if (systemMessage) {
      body.system = systemMessage.content;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new AppError(
        ErrorCodes.AI_PROVIDER_ERROR,
        `Anthropic streaming error (${response.status}): ${errorBody}`,
        502,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, 'No response body from Anthropic', 502);
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          const payload = trimmed.slice(6);

          try {
            const event = JSON.parse(payload) as {
              type: string;
              delta?: { type: string; text?: string };
            };

            if (event.type === 'content_block_delta' && event.delta?.text) {
              onChunk(event.delta.text);
              yield { content: event.delta.text, done: false };
            }

            if (event.type === 'message_stop') {
              yield { content: '', done: true };
              return;
            }
          } catch {
            // Skip malformed SSE chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { content: '', done: true };
  }
}

export const aiBridgeService = new AIBridgeService();
