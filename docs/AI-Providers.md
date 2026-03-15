# AI Providers

## Supported Providers

| Provider | Models | Use Case |
|----------|--------|----------|
| Lovable AI | Gemini 3 Flash, Gemini 2.5 Pro | Default, general operations |
| OpenAI | GPT-5, GPT-5 Mini | Advanced reasoning |
| Anthropic | Claude Sonnet 4, Claude 3.5 Haiku | Report generation |

## Architecture
- All AI calls go through backend edge functions
- No API keys exposed in frontend
- Provider abstraction layer with fallback
- Structured output via tool calling

## Use Cases
1. Explain security events
2. Summarize activity by camera/site/period
3. Suggest operational actions
4. Generate incident reports
5. Classify events (structured JSON)
6. Natural language to search filters
7. Generate SOPs
8. Operational assistant (chat)

## Security
- API keys stored as Cloud Secrets
- Edge function validates requests
- Token usage tracked per session
- Cost estimation logged
