import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { aiSessions } from '../../db/schema/index.js';
import { config } from '../../config/env.js';
import { AppError, ErrorCodes } from '@aion/shared-contracts';
import {
  openaiCircuitBreaker,
  anthropicCircuitBreaker,
  CircuitBreakerError,
} from '../../lib/circuit-breaker.js';
import type { ChatRequestInput, ChatRequestRawInput, UsageQueryInput } from './schemas.js';
import {
  getAllTools,
  executeTool,
  type MCPServerTool,
} from '../mcp-bridge/tools/index.js';
import { knowledgeBase } from '../knowledge-base/service.js';

// ── Constants ─────────────────────────────────────────────────

/** Maximum tool-calling loop iterations to prevent infinite loops */
const MAX_TOOL_ITERATIONS = 5;

// ── Provider Response Types ───────────────────────────────────

interface ChatCompletionResult {
  content: string;
  model: string;
  provider: string;
  tokens: { prompt: number; completion: number };
  finishReason: string;
}

// ── Provider-specific Tool Formats ────────────────────────────

interface OpenAIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
}

interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

// ── OpenAI Tool Call Types ────────────────────────────────────

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

// ── Anthropic Content Block Types ─────────────────────────────

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock;

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[] | AnthropicToolResultBlock[];
}

// ── Stream Event Types ────────────────────────────────────────

interface StreamContentChunk {
  type: 'content';
  content: string;
  done: boolean;
}

interface StreamToolCallEvent {
  type: 'tool_call';
  tool: string;
  params: Record<string, unknown>;
}

interface StreamToolResultEvent {
  type: 'tool_result';
  tool: string;
  result: unknown;
  success: boolean;
}

export type ToolStreamEvent = StreamContentChunk | StreamToolCallEvent | StreamToolResultEvent;

// ── AI Bridge Service ─────────────────────────────────────────

export class AIBridgeService {

  // ── RAG Helpers ──────────────────────────────────────────────

  /**
   * Extract the last user message text from the conversation for RAG lookup.
   */
  private extractLastUserMessage(messages: Array<{ role: string; content: string }>): string {
    const userMessages = messages.filter((m) => m.role === 'user');
    return userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';
  }

  /**
   * Enrich chat params with RAG context from the knowledge base.
   * Injects relevant knowledge as a system message prepended to the conversation.
   */
  private async enrichWithRAG(params: ChatRequestRawInput): Promise<ChatRequestRawInput> {
    const userMessage = this.extractLastUserMessage(params.messages);
    if (!userMessage) return params;

    const ragContext = await knowledgeBase.buildContext(userMessage);
    if (!ragContext) return params;

    // Find existing system message or create one
    const existingSystem = params.messages.find((m) => m.role === 'system');
    if (existingSystem) {
      return {
        ...params,
        messages: params.messages.map((m) =>
          m.role === 'system'
            ? { ...m, content: m.content + ragContext }
            : m,
        ),
      };
    }

    return {
      ...params,
      messages: [{ role: 'system' as const, content: ragContext.trim() }, ...params.messages],
    };
  }

  // ── Provider Resolution ────────────────────────────────────

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
   * Injects relevant knowledge base context (RAG) into the conversation.
   */
  async chat(params: ChatRequestRawInput, tenantId: string, userId: string): Promise<ChatCompletionResult> {
    const { provider, model, apiKey } = this.resolveProvider(params.provider, params.model);

    // RAG: retrieve relevant knowledge and inject into messages
    const enrichedParams = await this.enrichWithRAG(params);

    let result: ChatCompletionResult;

    try {
      if (provider === 'openai') {
        result = await openaiCircuitBreaker.execute(
          () => this.chatOpenAI(enrichedParams, model, apiKey),
        );
      } else {
        result = await anthropicCircuitBreaker.execute(
          () => this.chatAnthropic(enrichedParams, model, apiKey),
        );
      }
    } catch (error) {
      if (error instanceof CircuitBreakerError) {
        throw new AppError(
          ErrorCodes.AI_PROVIDER_ERROR,
          `AI provider "${provider}" is temporarily unavailable (circuit open). Try again later.`,
          503,
        );
      }
      throw error;
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
    params: ChatRequestRawInput,
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

  // ── Tool Format Converters ───────────────────────────────────

  /**
   * Convert MCPServerTool[] to OpenAI function-calling tool format.
   */
  private convertToolsForOpenAI(tools: MCPServerTool[]): OpenAIToolDefinition[] {
    return tools.map((tool) => {
      const properties: Record<string, { type: string; description: string; enum?: string[] }> = {};
      const required: string[] = [];

      for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
        const prop: { type: string; description: string; enum?: string[] } = {
          type: paramDef.type,
          description: paramDef.description,
        };
        if (paramDef.enum) {
          prop.enum = paramDef.enum;
        }
        properties[paramName] = prop;
        if (paramDef.required) {
          required.push(paramName);
        }
      }

      return {
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: 'object' as const,
            properties,
            required,
          },
        },
      };
    });
  }

  /**
   * Convert MCPServerTool[] to Anthropic tool format.
   */
  private convertToolsForAnthropic(tools: MCPServerTool[]): AnthropicToolDefinition[] {
    return tools.map((tool) => {
      const properties: Record<string, { type: string; description: string; enum?: string[] }> = {};
      const required: string[] = [];

      for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
        const prop: { type: string; description: string; enum?: string[] } = {
          type: paramDef.type,
          description: paramDef.description,
        };
        if (paramDef.enum) {
          prop.enum = paramDef.enum;
        }
        properties[paramName] = prop;
        if (paramDef.required) {
          required.push(paramName);
        }
      }

      return {
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: 'object' as const,
          properties,
          required,
        },
      };
    });
  }

  /**
   * Build the AION security-context system prompt with available tools.
   * Optionally appends RAG context from the knowledge base.
   */
  private buildSystemPrompt(tools: MCPServerTool[], ragContext = ''): string {
    const toolList = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
    return `Eres AION, el agente de inteligencia artificial de la plataforma de seguridad Clave Seguridad.
Tienes acceso a herramientas reales para consultar datos y ejecutar acciones en el sistema.
Siempre responde en español. Sé conciso y profesional.
Cuando necesites datos del sistema, usa las herramientas disponibles en lugar de adivinar.
Para acciones que modifican el sistema (abrir puertas, reiniciar dispositivos, enviar alertas),
siempre confirma con el operador antes de ejecutar.

Herramientas disponibles:
${toolList}

Hora actual: ${new Date().toISOString()}${ragContext}`;
  }

  // ── Tool-Calling Chat (non-streaming) ───────────────────────

  /**
   * Chat with tool calling support. Sends messages + tools to LLM,
   * executes any requested tools, and loops until LLM returns text
   * (or max iterations are reached).
   */
  async chatWithTools(
    params: ChatRequestInput,
    tenantId: string,
    userId: string,
  ): Promise<ChatCompletionResult> {
    const { provider, model, apiKey } = this.resolveProvider(params.provider, params.model);
    const tools = getAllTools();

    // RAG: retrieve relevant knowledge for the tool-calling path
    const userMessage = this.extractLastUserMessage(params.messages);
    const ragContext = userMessage ? await knowledgeBase.buildContext(userMessage) : '';
    const systemPrompt = this.buildSystemPrompt(tools, ragContext);

    const context = { tenantId, userId };

    let result: ChatCompletionResult;

    if (provider === 'openai') {
      result = await this.chatWithToolsOpenAI(params, model, apiKey, tools, systemPrompt, context);
    } else {
      result = await this.chatWithToolsAnthropic(params, model, apiKey, tools, systemPrompt, context);
    }

    // Persist session
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
   * OpenAI tool-calling loop (non-streaming).
   */
  private async chatWithToolsOpenAI(
    params: ChatRequestInput,
    model: string,
    apiKey: string,
    tools: MCPServerTool[],
    systemPrompt: string,
    context: { tenantId: string; userId: string },
  ): Promise<ChatCompletionResult> {
    const openaiTools = this.convertToolsForOpenAI(tools);

    // Build messages: inject system prompt, then user messages
    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...params.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as OpenAIMessage['role'], content: m.content })),
    ];

    // Include any original system messages from the request
    const userSystemMsg = params.messages.find((m) => m.role === 'system');
    if (userSystemMsg) {
      messages[0] = {
        role: 'system',
        content: `${systemPrompt}\n\n${userSystemMsg.content}`,
      };
    }

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let finalModel = model;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: params.temperature,
          max_tokens: params.maxTokens,
          tools: openaiTools,
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
        choices: Array<{
          message: {
            content: string | null;
            tool_calls?: OpenAIToolCall[];
            role: string;
          };
          finish_reason: string;
        }>;
        model: string;
        usage: { prompt_tokens: number; completion_tokens: number };
      };

      totalPromptTokens += data.usage.prompt_tokens;
      totalCompletionTokens += data.usage.completion_tokens;
      finalModel = data.model;

      const choice = data.choices[0];

      // If the LLM wants to call tools
      if (choice.finish_reason === 'tool_calls' || choice.message.tool_calls?.length) {
        // Add assistant message with tool_calls to conversation
        messages.push({
          role: 'assistant',
          content: choice.message.content,
          tool_calls: choice.message.tool_calls,
        });

        // Execute each tool call and add results
        for (const toolCall of choice.message.tool_calls ?? []) {
          let parsedArgs: Record<string, unknown>;
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          } catch {
            parsedArgs = {};
          }

          const toolResult = await executeTool(toolCall.function.name, parsedArgs, context);

          messages.push({
            role: 'tool',
            content: JSON.stringify(toolResult),
            tool_call_id: toolCall.id,
          });
        }

        // Continue the loop to let the LLM process tool results
        continue;
      }

      // LLM returned a text response -- we're done
      return {
        content: choice.message.content ?? '',
        model: finalModel,
        provider: 'openai',
        tokens: { prompt: totalPromptTokens, completion: totalCompletionTokens },
        finishReason: choice.finish_reason,
      };
    }

    // Max iterations reached -- return whatever content we have
    const lastAssistant = [...messages].reverse().find(
      (m) => m.role === 'assistant' && m.content,
    );
    return {
      content: lastAssistant?.content ?? '[Se alcanzó el límite de iteraciones de herramientas]',
      model: finalModel,
      provider: 'openai',
      tokens: { prompt: totalPromptTokens, completion: totalCompletionTokens },
      finishReason: 'max_tool_iterations',
    };
  }

  /**
   * Anthropic tool-calling loop (non-streaming).
   */
  private async chatWithToolsAnthropic(
    params: ChatRequestInput,
    model: string,
    apiKey: string,
    tools: MCPServerTool[],
    systemPrompt: string,
    context: { tenantId: string; userId: string },
  ): Promise<ChatCompletionResult> {
    const anthropicTools = this.convertToolsForAnthropic(tools);

    // Build system prompt (Anthropic uses a separate `system` field)
    const userSystemMsg = params.messages.find((m) => m.role === 'system');
    const fullSystem = userSystemMsg
      ? `${systemPrompt}\n\n${userSystemMsg.content}`
      : systemPrompt;

    const messages: AnthropicMessage[] = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let finalModel = model;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          system: fullSystem,
          messages,
          max_tokens: params.maxTokens ?? 2048,
          temperature: params.temperature,
          tools: anthropicTools,
        }),
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
        content: AnthropicContentBlock[];
        model: string;
        usage: { input_tokens: number; output_tokens: number };
        stop_reason: string;
      };

      totalInputTokens += data.usage.input_tokens;
      totalOutputTokens += data.usage.output_tokens;
      finalModel = data.model;

      // Check if any tool_use blocks are present
      const toolUseBlocks = data.content.filter(
        (block): block is AnthropicToolUseBlock => block.type === 'tool_use',
      );

      if (data.stop_reason === 'tool_use' && toolUseBlocks.length > 0) {
        // Add assistant message with the full content (text + tool_use blocks)
        messages.push({
          role: 'assistant',
          content: data.content,
        });

        // Execute each tool call and build tool_result content blocks
        const toolResults: AnthropicToolResultBlock[] = [];
        for (const toolUse of toolUseBlocks) {
          const toolResult = await executeTool(
            toolUse.name,
            toolUse.input as Record<string, unknown>,
            context,
          );

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(toolResult),
          });
        }

        // Add tool results as user message
        messages.push({
          role: 'user',
          content: toolResults,
        });

        // Continue the loop
        continue;
      }

      // LLM returned a text response -- extract text
      const textContent = data.content
        .filter((block): block is AnthropicTextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return {
        content: textContent,
        model: finalModel,
        provider: 'anthropic',
        tokens: { prompt: totalInputTokens, completion: totalOutputTokens },
        finishReason: data.stop_reason,
      };
    }

    // Max iterations reached
    return {
      content: '[Se alcanzó el límite de iteraciones de herramientas]',
      model: finalModel,
      provider: 'anthropic',
      tokens: { prompt: totalInputTokens, completion: totalOutputTokens },
      finishReason: 'max_tool_iterations',
    };
  }

  // ── Tool-Calling Stream ─────────────────────────────────────

  /**
   * Stream a chat response with tool calling support.
   * Yields content chunks, tool_call events, and tool_result events.
   */
  async *chatStreamWithTools(
    params: ChatRequestInput,
    tenantId: string,
    userId: string,
  ): AsyncGenerator<ToolStreamEvent> {
    const { provider, model, apiKey } = this.resolveProvider(params.provider, params.model);
    const tools = getAllTools();

    // RAG: retrieve relevant knowledge for the streaming tool-calling path
    const userMessage = this.extractLastUserMessage(params.messages);
    const ragContext = userMessage ? await knowledgeBase.buildContext(userMessage) : '';
    const systemPrompt = this.buildSystemPrompt(tools, ragContext);

    const context = { tenantId, userId };

    let totalContent = '';

    if (provider === 'openai') {
      for await (const event of this.streamWithToolsOpenAI(
        params, model, apiKey, tools, systemPrompt, context,
      )) {
        if (event.type === 'content') {
          totalContent += event.content;
        }
        yield event;
      }
    } else {
      for await (const event of this.streamWithToolsAnthropic(
        params, model, apiKey, tools, systemPrompt, context,
      )) {
        if (event.type === 'content') {
          totalContent += event.content;
        }
        yield event;
      }
    }

    // Persist session after stream completes
    await db.insert(aiSessions).values({
      tenantId,
      userId,
      provider,
      model,
      messages: params.messages,
      totalTokens: Math.ceil(totalContent.length / 4),
    });
  }

  /**
   * OpenAI streaming with tool calling.
   * Uses non-streaming for tool calls, then streams the final response.
   */
  private async *streamWithToolsOpenAI(
    params: ChatRequestInput,
    model: string,
    apiKey: string,
    tools: MCPServerTool[],
    systemPrompt: string,
    context: { tenantId: string; userId: string },
  ): AsyncGenerator<ToolStreamEvent> {
    const openaiTools = this.convertToolsForOpenAI(tools);

    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...params.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as OpenAIMessage['role'], content: m.content })),
    ];

    const userSystemMsg = params.messages.find((m) => m.role === 'system');
    if (userSystemMsg) {
      messages[0] = {
        role: 'system',
        content: `${systemPrompt}\n\n${userSystemMsg.content}`,
      };
    }

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      // Use non-streaming call to detect tool_calls
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: params.temperature,
          max_tokens: params.maxTokens,
          tools: openaiTools,
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
        choices: Array<{
          message: {
            content: string | null;
            tool_calls?: OpenAIToolCall[];
            role: string;
          };
          finish_reason: string;
        }>;
        model: string;
        usage: { prompt_tokens: number; completion_tokens: number };
      };

      const choice = data.choices[0];

      if (choice.finish_reason === 'tool_calls' || choice.message.tool_calls?.length) {
        // Add assistant message with tool_calls
        messages.push({
          role: 'assistant',
          content: choice.message.content,
          tool_calls: choice.message.tool_calls,
        });

        // Execute each tool call
        for (const toolCall of choice.message.tool_calls ?? []) {
          let parsedArgs: Record<string, unknown>;
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          } catch {
            parsedArgs = {};
          }

          yield {
            type: 'tool_call',
            tool: toolCall.function.name,
            params: parsedArgs,
          };

          const toolResult = await executeTool(toolCall.function.name, parsedArgs, context);

          yield {
            type: 'tool_result',
            tool: toolCall.function.name,
            result: toolResult.data ?? toolResult.error,
            success: toolResult.success,
          };

          messages.push({
            role: 'tool',
            content: JSON.stringify(toolResult),
            tool_call_id: toolCall.id,
          });
        }

        // Continue the loop
        continue;
      }

      // No more tool calls -- stream the final response
      // Re-issue the request with streaming enabled (same messages)
      const streamResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: params.temperature,
          max_tokens: params.maxTokens,
          stream: true,
        }),
      });

      if (!streamResponse.ok) {
        const errorBody = await streamResponse.text();
        throw new AppError(
          ErrorCodes.AI_PROVIDER_ERROR,
          `OpenAI streaming error (${streamResponse.status}): ${errorBody}`,
          502,
        );
      }

      const reader = streamResponse.body?.getReader();
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
              yield { type: 'content', content: '', done: true };
              return;
            }

            try {
              const parsed = JSON.parse(payload) as {
                choices: Array<{ delta: { content?: string }; finish_reason: string | null }>;
              };
              const content = parsed.choices[0]?.delta?.content ?? '';
              if (content) {
                yield { type: 'content', content, done: false };
              }
            } catch {
              // Skip malformed SSE chunks
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      yield { type: 'content', content: '', done: true };
      return;
    }

    // Max iterations reached
    yield {
      type: 'content',
      content: '[Se alcanzó el límite de iteraciones de herramientas]',
      done: true,
    };
  }

  /**
   * Anthropic streaming with tool calling.
   * Uses non-streaming for tool calls, then streams the final response.
   */
  private async *streamWithToolsAnthropic(
    params: ChatRequestInput,
    model: string,
    apiKey: string,
    tools: MCPServerTool[],
    systemPrompt: string,
    context: { tenantId: string; userId: string },
  ): AsyncGenerator<ToolStreamEvent> {
    const anthropicTools = this.convertToolsForAnthropic(tools);

    const userSystemMsg = params.messages.find((m) => m.role === 'system');
    const fullSystem = userSystemMsg
      ? `${systemPrompt}\n\n${userSystemMsg.content}`
      : systemPrompt;

    const messages: AnthropicMessage[] = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      // Use non-streaming call to detect tool_use
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          system: fullSystem,
          messages,
          max_tokens: params.maxTokens ?? 2048,
          temperature: params.temperature,
          tools: anthropicTools,
        }),
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
        content: AnthropicContentBlock[];
        model: string;
        usage: { input_tokens: number; output_tokens: number };
        stop_reason: string;
      };

      const toolUseBlocks = data.content.filter(
        (block): block is AnthropicToolUseBlock => block.type === 'tool_use',
      );

      if (data.stop_reason === 'tool_use' && toolUseBlocks.length > 0) {
        // Add assistant message
        messages.push({
          role: 'assistant',
          content: data.content,
        });

        // Execute each tool and yield events
        const toolResults: AnthropicToolResultBlock[] = [];
        for (const toolUse of toolUseBlocks) {
          yield {
            type: 'tool_call',
            tool: toolUse.name,
            params: toolUse.input as Record<string, unknown>,
          };

          const toolResult = await executeTool(
            toolUse.name,
            toolUse.input as Record<string, unknown>,
            context,
          );

          yield {
            type: 'tool_result',
            tool: toolUse.name,
            result: toolResult.data ?? toolResult.error,
            success: toolResult.success,
          };

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(toolResult),
          });
        }

        messages.push({
          role: 'user',
          content: toolResults,
        });

        // Continue the loop
        continue;
      }

      // No more tool calls -- stream the final response
      const streamResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          system: fullSystem,
          messages,
          max_tokens: params.maxTokens ?? 2048,
          temperature: params.temperature,
          stream: true,
        }),
      });

      if (!streamResponse.ok) {
        const errorBody = await streamResponse.text();
        throw new AppError(
          ErrorCodes.AI_PROVIDER_ERROR,
          `Anthropic streaming error (${streamResponse.status}): ${errorBody}`,
          502,
        );
      }

      const reader = streamResponse.body?.getReader();
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
                yield { type: 'content', content: event.delta.text, done: false };
              }

              if (event.type === 'message_stop') {
                yield { type: 'content', content: '', done: true };
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

      yield { type: 'content', content: '', done: true };
      return;
    }

    // Max iterations reached
    yield {
      type: 'content',
      content: '[Se alcanzó el límite de iteraciones de herramientas]',
      done: true,
    };
  }

  // ── OpenAI Implementation ─────────────────────────────────────

  private async chatOpenAI(
    params: ChatRequestRawInput,
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
    params: ChatRequestRawInput,
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
    params: ChatRequestRawInput,
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
    params: ChatRequestRawInput,
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
