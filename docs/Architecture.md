# Architecture

## Layers

### Layer 1: Frontend (React/TypeScript/PWA)
- Desktop-first responsive UI
- Dark mode optimized for 24/7 operations
- Component-based architecture with shadcn/ui
- Protected routing with RBAC guards

### Layer 2: Backend (Edge Functions)
- RESTful API via Supabase Edge Functions
- Service layer pattern with DTOs
- Input validation with Zod
- Structured error handling

### Layer 3: Edge Gateway (Future)
- Local service per site
- RTSP proxy and ONVIF listener
- Brand-specific SDK wrappers
- Protocol translation layer

### Layer 4: AI + MCP
- Multi-provider abstraction (OpenAI, Anthropic, Lovable AI)
- Versioned system prompts per use case
- MCP connector registry with health checks
- Tool calling for structured AI responses

### Layer 5: Cloud Services
- Auth (Supabase Auth)
- Database (PostgreSQL)
- Storage (Supabase Storage)
- Secrets management
- Edge Functions for server-side logic

## Device Adapter Pattern

```typescript
IDeviceAdapter
├── GenericOnvifAdapter  (ONVIF Profile S/T/M)
├── HikvisionAdapter    (ISAPI + Device Network SDK)
└── DahuaAdapter         (HTTP API + NetSDK)
```

## Stream Strategy
- Mosaic (4/9/16/25/36): Always substream
- Single view / fullscreen: Main stream
- Playback: Direct from NVR/device
- Remote: WebRTC via gateway

## Security Architecture
- All secrets in Cloud Secrets (never in frontend)
- AI calls routed through edge functions
- RBAC with tenant isolation
- Audit trail on all mutations
- Rate limiting on API endpoints
