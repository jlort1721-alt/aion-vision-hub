// ═══════════════════════════════════════════════════════════
// AION VISION HUB — AI Provider Abstraction Layer
// ═══════════════════════════════════════════════════════════
// All AI calls go through backend edge functions.
// This module provides the client-side abstraction.

import { AIProvider, AIMessage } from '@/types';

export interface AIProviderConfig {
  provider: AIProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIRequest {
  messages: AIMessage[];
  config: AIProviderConfig;
  tools?: AITool[];
  responseFormat?: 'text' | 'json';
  contextType?: string;
  contextId?: string;
}

export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AIResponse {
  content: string;
  provider: AIProvider;
  model: string;
  tokens: { prompt: number; completion: number; total: number };
  latency_ms: number;
  tool_calls?: unknown[];
}

export const AI_MODELS: Record<AIProvider, { id: string; name: string; description: string }[]> = {
  openai: [
    { id: 'gpt-5', name: 'GPT-5', description: 'Most capable model' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Fast and efficient' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Balanced capability' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and affordable' },
  ],
  lovable: [
    { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Default fast model' },
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Top-tier reasoning' },
  ],
};

export const DEFAULT_AI_CONFIG: AIProviderConfig = {
  provider: 'lovable',
  model: 'google/gemini-3-flash-preview',
  temperature: 0.7,
  maxTokens: 2048,
};

/** AI use case definitions for the platform */
export const AI_USE_CASES = {
  explain_event: {
    name: 'Explain Event',
    systemPrompt: 'You are a video surveillance operations AI. Explain the given security event clearly and suggest operator actions. Be concise and actionable.',
  },
  summarize_activity: {
    name: 'Summarize Activity',
    systemPrompt: 'You are a surveillance operations AI. Summarize the activity for the given period, highlighting anomalies and key events.',
  },
  generate_sop: {
    name: 'Generate SOP',
    systemPrompt: 'You are an operations expert. Generate a standard operating procedure for the given security scenario. Use numbered steps.',
  },
  draft_incident_report: {
    name: 'Draft Incident Report',
    systemPrompt: 'You are a security report writer. Draft a professional incident report based on the provided event data.',
  },
  classify_event: {
    name: 'Classify Event',
    systemPrompt: 'You are a security event classifier. Classify the event and return structured JSON with: category, severity, recommended_action, confidence.',
  },
  natural_language_search: {
    name: 'Natural Language Search',
    systemPrompt: 'Convert the user natural language query into structured search filters. Return JSON with: device_ids, event_types, date_range, severity, keywords.',
  },
  operational_assistant: {
    name: 'Operational Assistant',
    systemPrompt: 'You are AION, an AI operations assistant for a video surveillance platform. Help operators with device status, event handling, incident management, and operational best practices. Be professional and concise.',
  },
} as const;
