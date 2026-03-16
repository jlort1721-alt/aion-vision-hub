# AION Vision Hub -- Architecture Review

**Date:** 2026-03-08
**Version:** 2.0 (Post-Hardening)

---

## 1. System Overview

AION Vision Hub is a multi-tenant enterprise surveillance platform with the following architecture layers:

```
┌─────────────────────────────────────────┐
│ Frontend (React 18 + Vite + TypeScript) │
├─────────────────────────────────────────┤
│ Supabase (Auth, DB, RLS, Edge Fns)      │
├─────────────────────────────────────────┤
│ Backend API (Fastify monorepo)          │
├─────────────────────────────────────────┤
│ Edge Gateway (Device adapters, streams) │
├─────────────────────────────────────────┤
│ PostgreSQL 16 + MediaMTX               │
└─────────────────────────────────────────┘
```

---

## 2. Frontend Architecture

### 2.1 Stack

| Technology | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI framework |
| Vite | 5.4.19 | Build tooling |
| TypeScript | 5.8.3 | Type safety |
| Shadcn/UI (Radix) | Latest | Component library |
| TailwindCSS | 3.x | Styling |
| React Router | 6 | Client-side routing |
| TanStack React Query | 5 | Server state management |
| Supabase JS | 2.98.0 | Backend client |

### 2.2 Module Structure

20 frontend pages organized as:
- `src/pages/` -- Page components (20 modules)
- `src/components/` -- Shared UI components
- `src/hooks/` -- Custom React hooks (data fetching, state)
- `src/services/` -- API service layer, MCP registry
- `src/contexts/` -- AuthContext, I18nContext
- `src/lib/` -- Utilities, permissions, Supabase client
- `src/types/` -- TypeScript type definitions

### 2.3 Routing and Guards

All routes wrapped in:
1. `ProtectedRoute` -- JWT authentication check
2. `ModuleGuard` -- Role-based module access via `hasModuleAccess()`

### 2.4 State Management

- **Server state:** React Query (caching, refetch, optimistic updates)
- **Local state:** `useState`/`useReducer` (no Redux)
- **Auth state:** React Context (`AuthContext`)
- **I18n state:** React Context (`I18nContext` with ES/EN)

---

## 3. Backend Architecture

### 3.1 Fastify Monorepo

```
backend/
├── apps/
│   └── backend-api/         # Main API server
│       └── src/
│           ├── db/           # Drizzle ORM (client, schema)
│           ├── modules/      # 20 route modules
│           ├── plugins/      # auth, tenant, audit
│           └── app.ts        # Application entry
├── packages/
│   ├── shared-contracts/     # Shared types, error codes
│   └── common-utils/         # Encryption, validation
└── edge-gateway/             # Device adapter framework
    └── src/
        ├── adapters/         # ONVIF, ISAPI, HTTP-API
        ├── streaming/        # Stream state machine
        └── credentials/      # Credential vault (AES-256-GCM)
```

### 3.2 Plugin Chain

Registration order (enforced via Fastify dependencies):

1. **Auth Plugin** -- JWT verification, `request.userId`/`request.userRole`
2. **Tenant Plugin** -- Tenant resolution, `request.tenantId`, active check
3. **Audit Plugin** -- `request.audit()` method, auto-audit on mutations

### 3.3 Backend Modules (20)

Each module follows the pattern:
- `schemas.ts` -- Zod validation schemas
- `service.ts` -- Drizzle ORM business logic (tenant-scoped)
- `routes.ts` -- Fastify route handlers with `requireRole()` guards

Modules: users, sites, devices, events, incidents, integrations, reports, audit, health, ai, mcp-bridge, streams, domotics, access-control, intercom, reboots, database-records, sections, settings, admin.

---

## 4. Edge Gateway

### 4.1 Device Adapter Interfaces

- `IDeviceAdapter` -- Base: connect, disconnect, health, capabilities
- `IDiscoveryAdapter` -- ONVIF network scanning
- `IStreamAdapter` -- RTSP stream management via MediaMTX
- `IPlaybackAdapter` -- NVR recording search/retrieval
- `IPTZAdapter` -- Pan/tilt/zoom control

### 4.2 Protocol Support

| Protocol | Interface | Implementation Status |
|---|---|---|
| ONVIF Profile S | `IOnvifAdapter` | Interface defined, stub implementation |
| ISAPI (Hikvision) | `IHikvisionAdapter` | Interface defined, stub implementation |
| HTTP-API (Dahua) | `IDahuaAdapter` | Interface defined, stub implementation |
| RTSP | MediaMTX proxy | Configured, player not connected |

### 4.3 Stream State Machine

```
IDLE → CONNECTING → ACTIVE → DISCONNECTING → IDLE
                  ↘ ERROR ↗
```

### 4.4 Credential Vault

- AES-256-GCM encryption for device credentials
- In-memory `Map<string, string>` storage (persistence pending)
- Key: `CREDENTIAL_ENCRYPTION_KEY` (falls back to `JWT_SECRET`)

---

## 5. Database Architecture

### 5.1 Overview

- **Engine:** PostgreSQL 16 (Supabase-managed)
- **ORM:** Drizzle ORM with full schema parity
- **Tables:** 30+ with proper normalization
- **Security:** RLS on all tables, 42 policies, 4 security definer functions
- **Migrations:** 6 sequential SQL migrations

### 5.2 Key Tables

| Category | Tables |
|---|---|
| Core | tenants, profiles, user_roles, role_module_permissions |
| Operations | sites, sections, devices, events, incidents |
| Modules | domotic_devices, domotic_actions, access_people, access_vehicles, access_logs |
| Modules | reboot_tasks, intercom_devices, intercom_calls, database_records |
| Platform | integrations, mcp_connectors, ai_sessions, reports, audit_logs |
| UI State | live_view_layouts, camera_layouts, settings |

### 5.3 Security Functions

1. `get_user_tenant_id(UUID)` -- SECURITY DEFINER, extracts tenant from profile
2. `has_role(app_role[])` -- SECURITY DEFINER, checks user roles
3. `handle_new_user()` -- SECURITY DEFINER, auto-assigns tenant on signup
4. `update_updated_at()` -- Trigger function for timestamp management

---

## 6. Infrastructure

### 6.1 Docker Compose Services

| Service | Image | Purpose |
|---|---|---|
| backend-api | Custom Fastify | REST API server |
| edge-gateway | Custom Node.js | Device communication |
| mediamtx | bluenviern/mediamtx | RTSP→WebRTC/HLS proxy |
| postgres | postgres:16 | Database (dev only) |

### 6.2 Supabase Services

- Auth (JWT, MFA support, user management)
- Database (PostgreSQL 16 with RLS)
- Edge Functions (11 Deno functions)
- Realtime (subscriptions for events table)
- Storage (file uploads)

---

## 7. Strengths

1. **Clean separation of concerns** -- hooks, services, components, pages, contexts
2. **Consistent patterns** -- React Query + Supabase everywhere, Zod schemas on all endpoints
3. **Security-first** -- RLS on every table, JWT auth on every function, tenant scoping
4. **Type safety** -- TypeScript strict mode, shared contracts between frontend/backend
5. **Comprehensive i18n** -- Full ES/EN translations across all 20 modules
6. **Audit trail** -- Automatic audit logging on all mutation operations

---

## 8. Weaknesses and Gaps

1. **No video pipeline** -- MediaMTX configured but no frontend player connected
2. **No playback engine** -- UI exists, backend recording search absent
3. **Device adapters are stubs** -- Interfaces defined, no runtime implementations
4. **No automated tests** -- Zero test files, no CI/CD pipeline
5. **No monitoring stack** -- No Prometheus, Grafana, or log aggregation
6. **In-memory credential vault** -- Lost on process restart
7. **No code splitting** -- All 20 modules in main bundle
8. **Rate limiting gaps** -- Edge functions have no throttling

---

## 9. Recommendations

1. **Video pipeline:** Connect HLS.js/WebRTC player to MediaMTX proxy endpoints.
2. **Test infrastructure:** Add Vitest for unit/integration, Playwright for E2E.
3. **CI/CD:** GitHub Actions for lint, test, build, deploy.
4. **Monitoring:** Prometheus metrics endpoint + Grafana dashboards.
5. **Code splitting:** Lazy-load routes with `React.lazy()` + Suspense.
6. **Credential persistence:** Migrate vault to encrypted DB table.

---

*End of Architecture Review*
