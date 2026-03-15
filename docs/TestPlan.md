# Test Plan -- AION Vision Hub

## Testing Strategy

Unit tests covering critical business logic. Every test validates meaningful behavior — no filler. Focus on auth boundaries, RBAC, tenant isolation patterns, device management, event processing, policy enforcement, component rendering, error states, and backend service contracts.

## Testing Stack

| Component | Purpose |
|---|---|
| Vitest 3.x | Test runner and assertion library |
| @testing-library/react | React component testing utilities |
| @testing-library/user-event | User interaction simulation |
| @testing-library/jest-dom | Custom DOM matchers |
| jsdom | Browser environment simulation (frontend) |
| vi.mock / vi.fn / vi.hoisted | Controlled mocking with TDZ-safe hoisting |
| Fastify inject | HTTP-level route testing (backend) |

## Test Setup

### Frontend (`src/test/`)
- `setup.ts` — IntersectionObserver, ResizeObserver, matchMedia mocks
- `test-utils.tsx` — Custom `render` with QueryClient, BrowserRouter, TooltipProvider
- `mocks/supabase.ts` — Chainable Supabase query mock

### Backend
- `vi.mock('../config/env.js')` pattern for config isolation
- Mock logger factory with `child()` chain support
- Mock Fastify request/reply for middleware tests
- Thenable chain mock pattern for Drizzle ORM query builders
- `vi.hoisted()` for mock data referenced in `vi.mock()` factories

---

## Test Categories

### Frontend Unit Tests

| File | Tests | What's Covered |
|---|---|---|
| `permissions.test.ts` | 15 | RBAC for all 5 roles, module access matrix, admin bypass, multi-role, custom perms |
| `ai-provider-config.test.ts` | 10 | Default config, model catalog, use case definitions, system prompts |
| `auth-boundaries.test.tsx` | 9 | Route guards, per-role access *(pre-existing)* |
| `tenant-isolation.test.ts` | 4 | RLS architecture enforcement *(pre-existing)* |
| `adapters.test.ts` | 12 | Device adapter contracts *(pre-existing)* |
| `stream-policy.test.ts` | 10 | Stream URL patterns, state machine *(pre-existing)* |
| `ai-provider.test.ts` | 5 | Provider interface contract *(pre-existing)* |
| `event-normalization.test.ts` | 12 | Event parsing *(pre-existing)* |
| `incident-workflows.test.ts` | 16 | FSM, SLA, priority *(pre-existing)* |

### Frontend Component Tests (NEW — Phase 2)

| File | Tests | What's Covered |
|---|---|---|
| `error-boundary.test.tsx` | 7 | ErrorBoundary rendering, error catch, fallback, recovery, logging |
| `protected-routes.test.tsx` | 12 | ProtectedRoute, PublicRoute, ModuleGuard with 5 roles |
| `login-page.test.tsx` | 9 | Login/signup forms, validation, password toggle, Google OAuth, error handling |
| `whatsapp-page.test.tsx` | 6 | Tab navigation, lazy loading, conversations/templates/config tabs |
| `domotics-contract.test.tsx` | 11 | Device table, status badges, search filter, add dialog, detail panel |
| `intercom-mode.test.tsx` | 10 | Attend mode selector, device list, IP/SIP display, call/WhatsApp/Voice tabs |
| `system-health.test.tsx` | 9 | Health checks, latency display, status badges, refresh, timestamp |
| `integrations-config.test.tsx` | 10 | Active/MCP/catalog tabs, test/toggle buttons, health/error counts |

### Backend: common-utils

| File | Tests | What's Covered |
|---|---|---|
| `validation.test.ts` | 25 | UUID, pagination, dateRange, IP, port, CIDR, slug, email, password schemas |
| `crypto.test.ts` | — | Encrypt/decrypt, hashing, tokens *(pre-existing)* |
| `result.test.ts` | — | Ok/Err, unwrap, tryCatch *(pre-existing)* |
| `retry.test.ts` | — | Retry with backoff, max attempts *(pre-existing)* |

### Backend: backend-api

| File | Tests | What's Covered |
|---|---|---|
| `env.test.ts` | 11 | Schema validation, defaults, required fields, coercion |
| `error-handler.test.ts` | 6 | AppError, ZodError, Fastify validation, production sanitization |
| `auth.test.ts` | 5 | requireRole middleware, role matching, 403 rejection |
| `token-refresh.test.ts` | 6 | JWT refresh/verify endpoints, payload signing, missing token rejection |
| `audit-plugin.test.ts` | 12 | Auto-audit on mutations, field mapping, skip conditions, action generation |
| `tenant-plugin.test.ts` | 7 | Active tenant check, inactive rejection, tenant isolation, skip logic |
| `webhook-validation.test.ts` | 13 | HMAC-SHA256, signature verify/reject, timing-safe, challenge verification |
| `secure-proxy.test.ts` | 15 | PUBLIC_ROUTES, JWT extraction, role validation, request decoration, tenant scope |

### Backend: Module-Level Tests (NEW — Phase 2)

| File | Tests | What's Covered |
|---|---|---|
| `domotics/routes.test.ts` | 12 | Full CRUD, Zod validation, type enforcement, action execution |
| `domotics/service.test.ts` | 10 | list/getById/create/update/delete, toggle state, action history |
| `intercom/routes.test.ts` | 9 | Device CRUD, call logs, session lifecycle, stats |
| `intercom/service.test.ts` | 9 | listDevices/getById/create/update/delete, listCalls, createCallLog |
| `audit/service.test.ts` | 10 | Paginated list, filter by action/user/resource/date, getStats, schema integrity |
| `access-control/rbac.test.ts` | 12 | Role-based route access for people/audit/roles/domotics/integrations |
| `health/readiness.test.ts` | 10 | GET /health, /ready (DB check), /metrics, public access validation |

### Backend: edge-gateway

| File | Tests | What's Covered |
|---|---|---|
| `env.test.ts` | 10 | Schema validation, all defaults |
| `timeout.test.ts` | 6 | withTimeout resolution/rejection, error propagation |
| `reconnect.test.ts` | 12 | Attempt tracking, backoff, state machine, reset, exhaustion |
| `event-ingestion.test.ts` | 12 | Subscription lifecycle, callbacks, buffer flush |
| `device-manager.test.ts` | 12 | Connect/disconnect lifecycle, adapter routing |
| `stream-manager.test.ts` | 15 | Registration, stream selection, signed URLs, state transitions |
| `stream-policy.test.ts` | — | Profile selection, concurrency *(pre-existing)* |
| `local-cache.test.ts` | — | LRU, TTL *(pre-existing)* |

### Gateway (standalone)

| File | Tests | What's Covered |
|---|---|---|
| `event-ingestion.test.ts` | 20 | Hikvision 9 type mappings, Dahua 8 type mappings, severity, buffer, flush retry |

---

## Mock Strategy

| What | How | Why |
|---|---|---|
| Config/Env | `vi.mock('../config/env.js')` | Avoid process.env parsing at import |
| Logger | Mock object with `child()` returning self | No pino dependency in tests |
| Adapters | `vi.fn()` stubs | Test manager logic, not protocols |
| Timers | `vi.useFakeTimers()` | Deterministic timeout/reconnect tests |
| HTTP | `vi.mock('undici')` | Test flush logic without network |
| Supabase | `vi.mock('@supabase/supabase-js')` | Test normalization without DB |
| Drizzle ORM | Thenable chain mock via `vi.hoisted()` | Test service logic without DB |
| React Query | `vi.mock('@tanstack/react-query')` | Control query state in component tests |
| Auth Context | `vi.mock('@/contexts/AuthContext')` | Isolate component tests from auth |
| Math.random | `vi.spyOn(Math, 'random')` | Deterministic jitter in backoff |

---

## Running Tests

```bash
# Frontend
npm test                         # run once
npm run test:watch               # watch mode
npm run test:coverage            # with v8 coverage

# Backend (all packages via Turbo)
cd backend
pnpm test                        # run once
pnpm run test:coverage           # with coverage

# Backend API directly (bypasses turbo build)
cd backend/apps/backend-api
npx vitest run

# Gateway (standalone)
cd gateway
npm test
npm run test:coverage

# Single file
npx vitest run src/test/permissions.test.ts
```

---

## Coverage Goals

| Layer | Target |
|---|---|
| Auth/RBAC/Permissions | >80% |
| Validation/Crypto/Retry | >90% |
| Event normalization | >80% |
| Device/Stream services | >70% |
| Component rendering & guards | >70% |
| Backend CRUD services | >70% |
| No global threshold | Focus on test quality over arbitrary numbers |

---

## Not In Scope (Current Phase)

| Area | Reason | Future Plan |
|---|---|---|
| E2E (Playwright) | Requires running services + Supabase | Phase 3 |
| Supabase RLS | Requires live DB | SQL-level tests |
| Real device adapters | Requires hardware | Integration environment |
| WebSocket events | Requires running Fastify | Integration tests |
| Visual regression | Requires screenshots | Playwright comparisons |
| Live View drag-and-drop | Complex DOM interaction | Playwright + real browser |
| eWeLink API integration | Requires live API credentials | Contract tests with recorded responses |
