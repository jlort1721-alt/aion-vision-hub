# AION Vision Hub — API Architecture

## Edge Functions (Backend API Layer)

All mutations and sensitive operations are routed through backend functions for audit logging, validation, and tenant isolation.

## Endpoints

### `ai-chat`
- **Purpose**: AI assistant with streaming SSE
- **Auth**: JWT validated in code
- **Provider**: Lovable AI Gateway (Gemini/GPT-5)
- **Features**: Streaming, rate limit handling (429/402)

### `devices-api`
- **Methods**: GET (list/single), POST (create/test-connection), PUT (update), DELETE
- **Auth**: JWT + tenant isolation via RLS
- **Filters**: `site_id`, `status`, `brand`
- **Actions**: `test-connection` (simulated, gateway-ready)
- **Audit**: All mutations logged

### `events-api`
- **Methods**: GET (list with filters), POST (actions)
- **Filters**: `severity`, `status`, `site_id`, `device_id`, `limit`
- **Actions**: `acknowledge`, `resolve`, `assign`, `dismiss`, `ai-summary`
- **AI**: Auto-generates event summaries via Lovable AI
- **Audit**: All state changes logged

### `incidents-api`
- **Methods**: GET (list/single), POST (create/actions), PUT (update)
- **Actions**: `comment`, `close`, `ai-summary`
- **Features**: JSONB comments array, AI report generation
- **Audit**: Create/close logged

### `health-api`
- **Method**: GET
- **Checks**: Database, Devices, Event Pipeline, AI Gateway, Integrations, MCP Connectors, Sites, Authentication
- **Response**: Overall status + per-component breakdown with latency

### `reports-api`
- **Method**: GET
- **Types**: `summary`, `events`, `incidents`, `devices`
- **Features**: Date range filtering, aggregation by severity/status/brand/priority

### `integrations-api`
- **Methods**: GET, POST (create/test/toggle), PUT, DELETE
- **Actions**: `test` (connection test), `toggle` (activate/deactivate)
- **Audit**: Toggle and test actions logged

### `mcp-api`
- **Methods**: GET, POST (create/health-check/toggle), PUT, DELETE
- **Actions**: `health-check` (simulated), `toggle` (connect/disconnect)
- **Audit**: Status changes logged

## Security Model

1. All functions set `verify_jwt = false` in config.toml
2. JWT validated in code via `supabase.auth.getClaims()`
3. Authenticated Supabase client enforces RLS policies
4. Tenant isolation via `get_user_tenant_id()` security definer function
5. Audit logs written on all state-changing operations
6. No secrets exposed to frontend

## Frontend Integration

```typescript
import { eventsApi, devicesApi, healthApi } from '@/services/api';

// All API calls go through authenticated edge functions
await eventsApi.acknowledge(eventId);
await devicesApi.testConnection({ ip_address, brand });
const health = await healthApi.check();
```

## Gateway Integration (Future)

The `devices-api` test-connection endpoint currently returns simulated results. When the edge gateway is deployed:
1. Replace simulation with gateway HTTP call
2. Gateway handles RTSP/ONVIF/ISAPI protocols
3. Results flow back through the same API contract
