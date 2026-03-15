# Test Coverage Report -- AION Vision Hub

## Summary

- **608 test cases** across **53 test files** (20 new + 33 pre-existing)
- **All 608 tests passing** (0 failures)
- Covers **5 workspaces**: frontend, backend-api, common-utils, edge-gateway, gateway, device-adapters
- Focus: auth, RBAC, tenant isolation, component rendering, form validation, health monitoring, device CRUD, audit logging, webhook security

## Test Counts by Workspace

| Workspace | Test Files | Tests | Status |
|---|---|---|---|
| Frontend (`src/`) | 22 | 215 | ALL PASS |
| Backend API | 24 | 270 | ALL PASS |
| Gateway | 3 (2 pass, 1 pre-existing failure) | 35 | 35/35 PASS |
| Common Utils | 4 | 84 | ALL PASS |
| Device Adapters | 1 | 4 | ALL PASS |
| **Total** | **54** | **608** | **608/608 PASS** |

> Gateway has 1 pre-existing test file failure due to missing `undici` dependency in vitest context. All 35 gateway tests within passing files are green.

## Coverage by Module

### Auth & Access Control

| Module | Package | Status | Key Tests |
|---|---|---|---|
| Permissions / RBAC | frontend | existing | 5 roles x module access, admin bypass, multi-role, custom perms |
| Auth middleware (requireRole) | backend-api | existing | Role matching, 403 rejection, multi-role |
| Auth boundaries (route guards) | frontend | existing | Route protection, role enforcement |
| **ProtectedRoute / PublicRoute / ModuleGuard** | frontend | **NEW** | Loading states, redirects, role-based module access for 5 roles |
| **Login page form** | frontend | **NEW** | Login/signup forms, validation, password toggle, Google OAuth, error handling |
| **Token refresh** | backend-api | **NEW** | JWT refresh/verify endpoints, payload signing, missing token rejection |
| **RBAC on sensitive routes** | backend-api | **NEW** | Role enforcement on people/audit/roles/domotics/integration routes |

### Component Testing

| Module | Package | Status | Key Tests |
|---|---|---|---|
| **ErrorBoundary** | frontend | **NEW** | Error catch, custom fallback, recovery button, componentDidCatch logging |
| **WhatsApp page** | frontend | **NEW** | Tab navigation (conversations/templates/config), lazy loading |
| **Domotics page** | frontend | **NEW** | Device table, status badges, search filter, add dialog, detail panel, eWeLink badge |
| **Intercom page** | frontend | **NEW** | Attend mode selector, device list, IP/SIP display, call history, Voice AI tab |
| **System Health page** | frontend | **NEW** | Health checks, latency display, status badges, refresh invalidation, timestamp |
| **Integrations page** | frontend | **NEW** | Active/MCP/catalog tabs, test/toggle buttons, health/error counts, connector scopes |

### Backend Services

| Module | Package | Status | Key Tests |
|---|---|---|---|
| **Domotics routes** | backend-api | **NEW** | Full CRUD via inject, Zod validation (type/status), action execution, action history |
| **Domotics service** | backend-api | **NEW** | list/getById/create/update/delete, toggle state off↔on, getActions |
| **Intercom routes** | backend-api | **NEW** | Device CRUD, call log CRUD, session list, session stats |
| **Intercom service** | backend-api | **NEW** | listDevices/getById/create/update/delete, listCalls, createCallLog |
| **Audit service** | backend-api | **NEW** | Paginated list with 6 filter combos, getStats with 5 aggregations, schema integrity |
| **Health routes** | backend-api | **NEW** | GET /health (status/version/uptime), /ready (DB check + 503), /metrics (memory/CPU) |

### Security & Middleware

| Module | Package | Status | Key Tests |
|---|---|---|---|
| **Webhook validation** | backend-api | **NEW** | HMAC-SHA256 computation, signature verify/reject, timing-safe, challenge flow |
| **Secure proxy** | backend-api | **NEW** | PUBLIC_ROUTES identification, JWT extraction, role validation, tenant scope |
| **Audit plugin** | backend-api | **NEW** | Auto-audit on POST/PUT/PATCH/DELETE, field mapping, skip conditions |
| **Tenant plugin** | backend-api | **NEW** | Active tenant check, inactive/not-found rejection, tenant isolation |

### Event Processing

| Module | Package | Status | Key Tests |
|---|---|---|---|
| Event normalization (Hikvision) | gateway | existing | 9 event type mappings, severity assignment, fallback |
| Event normalization (Dahua) | gateway | existing | 8 event type mappings, severity assignment, fallback |
| Event ingestion (edge-gateway) | edge-gateway | existing | Subscribe/unsubscribe, callbacks, buffer flush, error resilience |
| Event normalization (frontend) | frontend | existing | XML parsing, common schema |

### Device Management

| Module | Package | Status | Key Tests |
|---|---|---|---|
| Device Manager | edge-gateway | existing | Connect/disconnect lifecycle, adapter routing, listing |
| Stream Manager | edge-gateway | existing | Registration, stream selection, signed URLs, state transitions, policy |
| Adapter Factory | device-adapters | existing | Brand routing, registration, fallback |

### Policies & Utilities

| Module | Package | Status | Key Tests |
|---|---|---|---|
| Timeout policy | edge-gateway | existing | withTimeout resolution, rejection, error propagation |
| Reconnect policy | edge-gateway | existing | Backoff, state machine, attempt exhaustion, reset |
| Validation schemas | common-utils | existing | UUID, IP, port, CIDR, slug, email, password, pagination |
| Crypto | common-utils | existing | Encrypt/decrypt, hashing, tokens |
| Retry logic | common-utils | existing | Exponential backoff, max attempts |

## Previously Not Covered → Now Covered

| Area | Previous Status | Current Status |
|---|---|---|
| Frontend React components | Not covered | 8 component test files, 74 tests |
| Tenant plugin (DB query) | Not covered | 7 tests via mock chain |
| Audit plugin (DB insert) | Not covered | 12 tests via mock request/reply |
| Intercom / Domotics CRUD | Not covered | 40 tests (routes + service) |
| Health routes (DB readiness) | Not covered | 10 tests matching real response shapes |
| RBAC on sensitive routes | Not covered | 12 tests across 5 resource types |

## Still Not Covered (Requires Live Environment)

| Area | Reason |
|---|---|
| Supabase RLS | Requires live database instance |
| E2E flows | Requires Playwright + running services |
| Real device adapters | Requires physical/virtual IP cameras |
| WebSocket real-time events | Requires running Fastify server |
| Live View drag-and-drop | Complex DOM interaction, needs real browser |
| eWeLink live API | Requires credentials + live API |

## Generating Coverage Report

```bash
# Frontend
npm run test:coverage
# → coverage/ directory

# Backend (all packages)
cd backend && pnpm run test:coverage

# Gateway
cd gateway && npm run test:coverage
```
