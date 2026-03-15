# AION Vision Hub — AION Agent

## Overview
Transversal AI assistant and operational copilot for the entire monitoring platform.

## Capabilities
- Contextual assistance per module, section, event, incident
- Report generation
- Action suggestions
- Incident summarization
- SOP generation
- Reboot assistance
- Playback search support
- Access control queries
- Domotic control suggestions

## Architecture
- Provider abstraction: OpenAI (GPT-4), Claude, Lovable AI
- Fallback chain between providers
- Streaming SSE responses
- Session persistence (`ai_sessions` table)
- Token tracking and cost estimation
- Structured outputs when applicable

## Modes
- **Assistant**: General Q&A and guidance
- **Copilot**: Contextual suggestions based on current view
- **Operator**: Guided execution of procedures
- **Executor**: Limited autonomous actions (with permissions)

## Integration Points
- Floating panel in Live View
- Dedicated page for extended conversations
- Context injection from all modules
- Prompt templates per use case

## Security
- All AI calls routed through backend Edge Functions
- No API keys in frontend
- Per-tenant settings and limits
- Full audit trail of AI interactions
