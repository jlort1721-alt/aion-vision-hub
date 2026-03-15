import { describe, it, expect } from 'vitest';
import { AI_MODELS, AI_USE_CASES, DEFAULT_AI_CONFIG } from '@/services/ai-provider';

describe('DEFAULT_AI_CONFIG', () => {
  it('defaults to lovable provider', () => {
    expect(DEFAULT_AI_CONFIG.provider).toBe('lovable');
  });

  it('has the expected default model', () => {
    expect(DEFAULT_AI_CONFIG.model).toBe('google/gemini-3-flash-preview');
  });

  it('has temperature set to 0.7', () => {
    expect(DEFAULT_AI_CONFIG.temperature).toBe(0.7);
  });

  it('has maxTokens set to 2048', () => {
    expect(DEFAULT_AI_CONFIG.maxTokens).toBe(2048);
  });
});

describe('AI_MODELS', () => {
  const providers = ['openai', 'anthropic', 'lovable'] as const;

  it('has entries for all 3 providers', () => {
    for (const provider of providers) {
      expect(AI_MODELS[provider]).toBeDefined();
    }
  });

  it('each provider has at least 2 models', () => {
    for (const provider of providers) {
      expect(AI_MODELS[provider].length).toBeGreaterThanOrEqual(2);
    }
  });

  it('each model has id, name, and description', () => {
    for (const provider of providers) {
      for (const model of AI_MODELS[provider]) {
        expect(model.id).toBeTruthy();
        expect(model.name).toBeTruthy();
        expect(model.description).toBeTruthy();
      }
    }
  });
});

describe('AI_USE_CASES', () => {
  const expectedUseCases = [
    'explain_event',
    'summarize_activity',
    'generate_sop',
    'draft_incident_report',
    'classify_event',
    'natural_language_search',
    'operational_assistant',
  ] as const;

  it('has all 7 expected use cases', () => {
    for (const uc of expectedUseCases) {
      expect(AI_USE_CASES[uc]).toBeDefined();
    }
  });

  it('each use case has name and systemPrompt', () => {
    for (const uc of expectedUseCases) {
      expect(AI_USE_CASES[uc].name).toBeTruthy();
      expect(AI_USE_CASES[uc].systemPrompt).toBeTruthy();
      expect(typeof AI_USE_CASES[uc].systemPrompt).toBe('string');
      expect(AI_USE_CASES[uc].systemPrompt.length).toBeGreaterThan(10);
    }
  });
});
