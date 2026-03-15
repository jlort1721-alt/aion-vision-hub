# AION Vision Hub — AI Integration

## Architecture

```
[Frontend] → [Edge Function: ai-chat] → [Lovable AI Gateway] → [Model]
                                              ↓
                                    [google/gemini-3-flash-preview]
```

## Provider Abstraction

The platform uses a provider abstraction layer (`src/services/ai-provider.ts`) that supports:

| Provider | Models | Status |
|----------|--------|--------|
| Lovable AI | Gemini 3 Flash, Gemini 2.5 Pro | ✅ Active (no API key required) |
| OpenAI | GPT-5, GPT-5 Mini | 📋 Ready (requires API key) |
| Anthropic | Claude Sonnet 4, Claude 3.5 Haiku | 📋 Ready (requires API key) |

## AI Use Cases

| Use Case | System Prompt | Context |
|----------|--------------|---------|
| Explain Event | Security event analysis | Event metadata |
| Summarize Activity | Period activity summary | Site/device scope |
| Generate SOP | Standard operating procedures | Event type |
| Draft Incident Report | Professional report writing | Incident + events |
| Classify Event | Structured classification | Event data |
| Natural Language Search | Query → search filters | User query |
| Operational Assistant | General operations help | Full platform context |

## Streaming

- Server-Sent Events (SSE) for real-time token streaming
- Edge function proxies OpenAI-compatible streaming format
- Frontend handles `data: [DONE]` termination signal
- Partial content displayed as tokens arrive

## Security

- API keys stored as Supabase secrets
- Edge function validates request format
- Rate limiting (429) and credit exhaustion (402) handled gracefully
- System prompt is server-side only — not exposed to client

## Cost Tracking

AI sessions are stored in `ai_sessions` table with:
- `total_tokens` — Usage count
- `estimated_cost` — Cost estimate
- `provider` / `model` — For billing breakdown
