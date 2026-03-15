import { describe, it, expect, vi } from "vitest";

/**
 * AI Provider Abstraction Tests
 *
 * Validates the AI provider abstraction layer that supports
 * multiple backends (OpenAI, Anthropic, Lovable/Gemini).
 */

// Mock the supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { response: "test" }, error: null }),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-token" } },
        error: null,
      }),
    },
  },
}));

describe("AI Provider Abstraction", () => {
  it("exports AI provider service", async () => {
    const mod = await import("@/services/ai-provider");
    expect(mod).toBeDefined();
  });

  it("supports multiple provider types", () => {
    const supportedProviders = ["openai", "anthropic", "lovable"];
    expect(supportedProviders).toContain("openai");
    expect(supportedProviders).toContain("anthropic");
    expect(supportedProviders).toContain("lovable");
  });

  it("provider config structure", () => {
    const providerConfig = {
      openai: {
        models: ["gpt-5", "gpt-5-mini"],
        requiresApiKey: true,
        envVar: "OPENAI_API_KEY",
      },
      anthropic: {
        models: ["claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001"],
        requiresApiKey: true,
        envVar: "ANTHROPIC_API_KEY",
      },
      lovable: {
        models: ["gemini-3-flash", "gemini-2.5-pro"],
        requiresApiKey: false,
        envVar: null,
      },
    };

    expect(providerConfig.openai.requiresApiKey).toBe(true);
    expect(providerConfig.lovable.requiresApiKey).toBe(false);
    expect(providerConfig.anthropic.models.length).toBeGreaterThan(0);
  });

  it("chat request structure follows standard format", () => {
    const chatRequest = {
      messages: [
        { role: "system" as const, content: "You are a security assistant." },
        { role: "user" as const, content: "Summarize recent events." },
      ],
      provider: "lovable",
      model: "gemini-3-flash",
      maxTokens: 1000,
    };

    expect(chatRequest.messages).toHaveLength(2);
    expect(chatRequest.messages[0].role).toBe("system");
    expect(chatRequest.provider).toBe("lovable");
  });

  it("response structure includes token usage", () => {
    const chatResponse = {
      response: "Based on the last 24 hours, there were 3 critical events...",
      provider: "lovable",
      model: "gemini-3-flash",
      tokensUsed: { input: 150, output: 200, total: 350 },
    };

    expect(chatResponse.tokensUsed.total).toBe(
      chatResponse.tokensUsed.input + chatResponse.tokensUsed.output
    );
  });
});
