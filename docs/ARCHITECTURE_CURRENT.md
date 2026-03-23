# ARCHITECTURE_CURRENT.md - Clave Seguridad / AION Vision Hub

> Generated: 2026-03-23 | Based on: repository audit of actual code

---

## 1. System Overview

**Product Name:** Clave Seguridad (rebranded from AION Vision Hub)
**Purpose:** Enterprise multi-tenant Video Management System (VMS) + IoT + Security Operations Platform
**Target:** Security companies managing multiple client sites with cameras, access control, intercoms, and smart devices

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     FRONTEND (React SPA)                      │
│  React 18 + Vite 5 + TailwindCSS + shadcn/ui + React Query  │
│  46 pages │ 64 components │ 14 hooks │ 23 services │ PWA     │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTPS (Supabase Edge Functions + Direct API)
┌──────────────────────▼───────────────────────────────────────┐
│                    NGINX Reverse Proxy                         │
│  TLS termination │ SPA routing │ API proxy │ WS proxy         │
│  Security headers │ Gzip │ Static caching                     │
└──────────┬───────────────────────────┬───────────────────────┘
           │                           │
┌──────────▼──────────┐  ┌────────────▼────────────────────────┐
│   BACKEND API       │  │        EDGE GATEWAY                  │
│   Fastify 5.x       │  │        Fastify 5.x                  │
│   45 modules         │  │   Device management (local)         │
│   Drizzle ORM        │  │   Stream proxying                   │
│   JWT + Supabase     │  │   ONVIF discovery                   │
│   OpenTelemetry      │  │   Event ingestion                   │
│   6 workers          │  │   Playback sessions                 │
│   Port 3000          │  │   PTZ control                       │
│                      │  │   Port 3100                         │
└──────┬───┬───┬───────┘  └────────────┬───────────────────────┘
       │   │   │                       │
┌──────▼───┘   │           ┌───────────▼───────────────────────┐
│ PostgreSQL   │           │         MediaMTX                   │
│ 16 + pgvector│           │   RTSP in (8554)                  │
│ Port 5432    │           │   WebRTC out (8889)               │
│ 22 schema    │           │   HLS out (8888)                  │
│ files        │           │   REST API (9997)                 │
│ 15 migrations│           └───────────────────────────────────┘
└──────────────┘
       │
┌──────▼──────┐
│    Redis     │
│ Port 6379    │
│ (optional)   │
│ In-memory    │
│ fallback     │
└──────────────┘
```

---

## CRITICAL: Hybrid Data Flow (Supabase + Fastify)

The frontend is **mid-migration** from Supabase Edge Functions to self-hosted Fastify backend:

```
Frontend React App
    │
    ├──► Supabase Auth (login, signup, session)      ← AuthContext.tsx
    ├──► Supabase DB direct (devices, events lists)  ← use-supabase-data.ts
    ├──► Supabase Edge Functions (email, whatsapp)   ← services/api.ts
    ├──► Fastify Backend (new hooks, operations)     ← lib/api-client.ts
    └──► MediaMTX direct (video streams)             ← WebRTCPlayer.tsx
```

**Two API clients coexist:**
- `src/services/api.ts` → `VITE_SUPABASE_URL/functions/v1` (legacy)
- `src/lib/api-client.ts` → `VITE_API_URL` (new, targets Fastify)

**Migration status:** ~30% of frontend pages use Fastify. The backend has 45+ fully-built modules that the frontend does not yet consume.

---

## 3. Frontend Architecture

### 3.1 Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 18.3.1 |
| Build | Vite + SWC | 5.4.19 |
| Routing | React Router | 6.30.1 |
| Server State | React Query | 5.83.0 |
| Forms | React Hook Form + Zod | 7.61.1 / 3.25.76 |
| UI Primitives | Radix UI (shadcn) | Latest |
| Styling | TailwindCSS | 3.4.17 |
| Charts | Recharts | 2.15.4 |
| Maps | Leaflet | 1.9.4 |
| 3D | Three.js + R3F | 0.183.2 |
| Video | HLS.js | 1.6.15 |
| Auth | Supabase JS | 2.98.0 |
| i18n | Custom Context | ES/EN |
| PWA | vite-plugin-pwa | 1.2.0 |

### 3.2 Pages (46 total)
**Core Operations:** Dashboard, LiveView, Playback, Events, Incidents, Alerts
**Device Management:** Devices, Sites, Reboots, NetworkPage, SystemHealth
**Access & Control:** AccessControl, Intercom, Keys, Visitors, Domotics
**Operations:** Patrols, Shifts, Emergency, Notes, Minuta, Posts, PhonePanel
**Analytics & AI:** Analytics, Reports, ScheduledReports, AIAssistant, PredictiveCriminology, BiogeneticSearch, Immersive3D
**Admin:** Admin, Audit, Compliance, Contracts, Training, SLA, Database, Documents, Settings
**Integration:** Integrations, WhatsApp
**Auth:** Login, ResetPassword

### 3.3 State Management
- **AuthContext**: Supabase auth state, user profile, roles, tenant
- **I18nContext**: Language (es/en), lazy-loaded translations
- **React Query**: Server state caching, optimistic updates, query key factory
- No Redux/Zustand (pure Context + Query approach)

### 3.4 Auth Flow
1. User submits email+password → Supabase Auth
2. Supabase returns session with JWT
3. AuthContext stores session, fetches profile/roles from DB
4. ProtectedRoute guards all pages, ModuleGuard checks role permissions
5. API client auto-injects Bearer token from Supabase session
6. On 401: auto-refresh via Supabase, retry request

### 3.5 RBAC (Frontend)
| Role | Module Access |
|------|--------------|
| super_admin | All 32+ modules |
| tenant_admin | All 32+ modules |
| operator | 26+ modules (excludes admin/audit/system) |
| viewer | 6 modules (dashboard, live_view, playback, events, reports, documents) |
| auditor | 7 modules (viewer + audit) |

---

## 4. Backend Architecture

### 4.1 Monorepo Structure
```
backend/
├── apps/
│   ├── backend-api/         # Main REST API (Fastify 5)
│   └── edge-gateway/        # Edge device manager (Fastify 5)
├── packages/
│   ├── common-utils/        # Crypto, logging, retry, validation
│   ├── device-adapters/     # Hikvision, Dahua, ONVIF adapters
│   └── shared-contracts/    # Domain types, API contracts, errors
├── turbo.json               # Build orchestration
└── pnpm-workspace.yaml      # Workspace config
```

### 4.2 Backend API - Module Inventory (45 modules)

**Core (5):** health, auth, tenants, users, roles
**Devices (5):** devices, sites, streams, events, incidents
**Integration (14):** integrations, ai-bridge, mcp-bridge, cloud-accounts, ewelink, whatsapp, voice, email, push, extensions, relay, device-control, network, zkteco
**Operational (13):** domotics, access-control, intercom, reboots, database-records, alerts, shifts, sla, emergency, patrols, automation, visitors, operations
**Analytics (3):** analytics, biomarkers, lpr
**Admin (5):** reports, scheduled-reports, audit, backup, compliance, contracts, keys, training

### 4.3 Workers (6)
| Worker | Schedule | Function |
|--------|----------|----------|
| automation-engine | Event-driven | Rule evaluation, condition matching, action execution |
| backup-worker | Daily 2AM UTC | DB table export, 30-backup retention |
| health-check-worker | Periodic | Device ping, status transitions, notifications |
| notification-dispatcher | Event-driven | Email, SMS, WhatsApp, push delivery |
| reports-worker | Scheduled | Report generation (PDF/CSV/JSON) |
| retention-worker | Periodic | Data retention policy enforcement |

### 4.4 Middleware Stack (Registration Order)
1. Zod type provider (validation/serialization)
2. Swagger/OpenAPI docs
3. CORS (configurable origins)
4. Helmet (CSP, HSTS, X-Frame-Options)
5. JWT registration (HS256, issuer validation)
6. Error handler (sanitizes 500s in production)
7. Request ID (UUID per request)
8. Rate limiter (100/min per tenant:IP)
9. Prometheus metrics hook
10. Auth plugin (JWT + Supabase fallback)
11. Tenant plugin (DB lookup, isolation)
12. Audit plugin (mutation logging)

### 4.5 Database Schema (22 schema files, 15 migrations)

**Core Tables:** tenants, users/profiles, refresh_tokens, sites, devices, device_groups, sections
**Events:** events, incidents
**Access:** access_people, access_vehicles, access_logs
**Operations:** shifts, shift_assignments, patrol_routes, patrol_checkpoints, patrol_logs, emergency_protocols, emergency_activations, emergency_contacts, operational_notes
**Automation:** automation_rules, automation_executions, alert_rules, escalation_policies, alert_instances, notification_channels, notification_log
**Communication:** intercom_devices, intercom_calls, call_sessions, voip_config, wa_conversations, wa_messages, wa_templates
**Domotics:** domotic_devices, domotic_actions
**Analytics:** kpi_snapshots, biomarkers, push_subscriptions
**Admin:** contracts, invoices, key_inventory, key_logs, compliance_templates, data_retention_policies, training_programs, certifications, reports
**Documents:** documents, minuta_entries, call_log
**Integration:** integrations, mcp_connectors, ai_sessions, database_records
**Audit:** audit_logs

### 4.6 Edge Gateway Services
| Service | Purpose |
|---------|---------|
| DeviceManager | Local device connection pool, state tracking |
| StreamManager | RTSP/WebRTC proxying via MediaMTX |
| DiscoveryService | ONVIF/multicast device discovery |
| EventIngestionService | Event stream ingestion & forwarding to core |
| PlaybackManager | Video playback session management |
| HealthMonitor | Periodic device health checks |
| CredentialVault | Secure local credential storage |

### 4.7 Device Adapters
| Brand | Protocol | Adapter |
|-------|----------|---------|
| Hikvision | ISAPI (HTTP/XML) | HikvisionAdapter |
| Dahua | RPC (JSON-RPC) | DahuaAdapter |
| Axis, Hanwha, Uniview, etc. | ONVIF (WS-Discovery) | GenericOnvifAdapter |

Factory pattern with runtime registration, ONVIF fallback for unknown brands.

---

## 5. Security Architecture

### 5.1 Authentication
- **Primary:** Supabase Auth (email/password)
- **Backend JWT:** HS256, 24h expiry, issuer: "aion-vision-hub"
- **Refresh tokens:** Family-based rotation with reuse detection
- **Token storage:** Supabase client-side session

### 5.2 Authorization
- **RBAC:** 5 roles (super_admin → viewer)
- **Module guards:** Frontend route-level + Backend requireRole() preHandler
- **Tenant isolation:** Plugin-level tenantId injection on every request

### 5.3 Data Protection
- **Credentials:** AES-256-GCM encryption (random IV per encryption)
- **Transport:** HTTPS/TLS + HSTS
- **Headers:** CSP, X-Frame-Options, X-Content-Type-Options
- **Webhooks:** HMAC-SHA256 with timing-safe comparison

### 5.4 Rate Limiting
- Global: 100 req/min per tenant:IP
- Configurable via RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS

### 5.5 Audit Trail
- All POST/PUT/PATCH/DELETE operations logged
- Fields: userId, tenantId, action, entityType, IP, userAgent, timestamp
- Immutable audit_logs table

---

## 6. Media Pipeline

```
IP Camera (RTSP) ──► Edge Gateway ──► MediaMTX ──► WebRTC/HLS ──► Browser
                     │                    │
                     │ Stream Bridge       │ REST API (9997)
                     │ (brand-specific     │
                     │  RTSP URL builder)  │
                     │                    │
                     └── Health checks ───┘
```

**Supported output formats:** RTSP, WebRTC (low latency), HLS (compatibility)
**Token-based access:** JWT per stream with expiration
**Brand-specific RTSP patterns:** Hikvision, Dahua, Axis, Uniview, Hanwha, Generic

---

## 7. Infrastructure

### 7.1 Docker Services (docker-compose.yml)
| Service | Image | Ports | Resources |
|---------|-------|-------|-----------|
| frontend | Dockerfile.frontend (NGINX) | 8080 | - |
| backend | backend/Dockerfile (Node 20) | 3000 | 512MB / 0.5 CPU |
| postgres | postgres:16-alpine | 5432 | 512MB / 1.0 CPU |
| mediamtx | bluenviern/mediamtx | 8554,8888,8889,9997 | 256MB / 0.5 CPU |
| redis | redis:7-alpine | 6379 | 256MB / 0.25 CPU |

### 7.2 CI/CD (GitHub Actions)
- **ci.yml:** PR/push → build + test (frontend + backend) + typecheck
- **deploy-production.yml:** Release tag → preflight → Docker build → GHCR push → SSH deploy → health verify
- **dependabot.yml:** Weekly dependency updates

### 7.3 Observability [EXISTE PARCIAL]
- Prometheus metrics (request duration, count)
- Pino structured logging (JSON)
- X-Request-ID tracking
- Health/readiness/liveness probes
- **Missing:** Grafana dashboards (config exists, no dashboards), distributed tracing (OTel configured but no exporter confirmed), alerting rules

---

## 8. External Dependencies

| Service | Purpose | Required |
|---------|---------|----------|
| Supabase | Auth + Edge Functions | Yes |
| PostgreSQL 16 | Primary database | Yes |
| Redis 7 | Cache/rate limit | Optional (in-memory fallback) |
| MediaMTX | Video streaming | Yes (for live view) |
| OpenAI/Anthropic | AI features | Optional |
| ElevenLabs | TTS/voice | Optional |
| Resend/SendGrid/SMTP | Email | Optional |
| WhatsApp Business API | Messaging | Optional |
| eWeLink | Smart home | Optional |
| Hik-Connect/DMSS | Cloud VMS | Optional |

---

## 9. Test Coverage

| Area | Files | Framework |
|------|-------|-----------|
| Frontend components | 16 | Vitest + Testing Library |
| Backend core | 21 | Vitest |
| Backend modules | 17 | Vitest |
| Backend packages | 7 | Vitest |
| Edge gateway | 6 | Vitest |
| **Total** | **67** | |

Key areas covered: Auth, JWT refresh, encryption, tenant isolation, RBAC, webhooks, E2E flow, backup, health checks, error handling.
