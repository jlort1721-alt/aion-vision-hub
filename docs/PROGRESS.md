# PROGRESS.md - Clave Seguridad Integration

> Track: Implementation progress per phase
> Updated: 2026-03-23

---

## Overall Status

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Repository Audit | COMPLETE | 100% |
| Phase 2: Architecture Map | COMPLETE | 100% |
| Phase 3: Gap Analysis | COMPLETE | 100% |
| Phase 4: Implementation Plan | COMPLETE | 100% |
| Phase 5A: Stability Hardening | COMPLETE | 100% |
| Phase 5B: Security Hardening | IN PROGRESS | 60% |
| Integration A: Architecture Sanitation | COMPLETE | 100% |
| Integration B: UI+API Migration | COMPLETE | 90% |
| Integration C: Responsive Design | COMPLETE | 100% |
| Integration D+E: Real-time & Network | COMPLETE | 100% |
| Integration F: Security Hardening | COMPLETE | 100% |
| Integration G: Observability | COMPLETE | 100% |
| Verification: Build/Test/Lint | COMPLETE | 100% |
| Phase 5C: Core VMS Features | PENDING | 0% |
| Phase 5D: Evidence & Audit | PENDING | 0% |
| Phase 5E: Observability Dashboards | PENDING | 0% |
| Phase 6: Hardening & Testing | IN PROGRESS | 60% |
| Phase 7: Production Checklist | PENDING | 0% |

---

## Phase 1: Repository Audit - COMPLETE

### Deliverables
- [x] Frontend inventory: 46 pages, 64 components, 14 hooks, 23 services
- [x] Backend inventory: 45 modules, 6 workers, 22 schema files, 15 migrations
- [x] Edge gateway inventory: 7 services, 6 route groups
- [x] Shared packages inventory: common-utils (6 modules), device-adapters (3 brands), shared-contracts (6 files)
- [x] Test inventory: 67 test files (16 frontend, 21 backend core, 17 backend modules, 7 packages, 6 edge)
- [x] Infrastructure inventory: Docker (5 services), CI/CD (3 workflows), NGINX config
- [x] Security audit: JWT, RBAC, encryption, rate limiting, audit logging, webhooks
- [x] External dependencies mapped: 14 integrations

### Key Findings
1. **Broad feature coverage** - 45+ backend modules covering VMS, IoT, operations, compliance
2. **Solid security foundation** - JWT with algo pinning, AES-256-GCM encryption, HMAC webhooks, RBAC
3. **Dual auth system** - Supabase + custom JWT with refresh token rotation
4. **Multi-tenant by design** - Tenant plugin isolates all queries
5. **Media pipeline functional** - RTSP → MediaMTX → WebRTC/HLS
6. **22 database schema files** covering full domain model
7. **67 test files** with good security path coverage

### Identified Risks
1. Plan limits not enforced (tenant can exceed quotas)
2. No MFA support
3. No clip export or on-demand snapshot
4. No event correlation engine
5. No SOP management
6. No evidence chain of custody
7. Grafana dashboards not defined
8. Stream quality metrics not collected

---

## Phase 2-4: Architecture & Planning - COMPLETE

### Documents Generated
- [x] `/docs/ARCHITECTURE_CURRENT.md` - Current state architecture
- [x] `/docs/ARCHITECTURE_TARGET.md` - Target 8-layer architecture
- [x] `/docs/GAP_ANALYSIS.md` - 26 gaps identified across 8 layers
- [x] `/docs/IMPLEMENTATION_PLAN.md` - 5 sub-phases with effort estimates
- [x] `/docs/DECISIONS_LOG.md` - 7 architectural decisions recorded
- [x] `/docs/PROGRESS.md` - This file

---

## Phase 5A: Stability Hardening - COMPLETE

| Task | Status | Notes |
|------|--------|-------|
| 5A.1 Plan limit enforcement | DONE | `plugins/plan-limits.ts` — enforces maxDevices/Users/Sites per tenant plan. Wired into devices, users, sites POST routes. |
| 5A.2 Auth rate limiting | DONE | `/auth/login` → 10/min, `/auth/refresh` → 20/min via per-route rateLimit config |
| 5A.3 CORS origin validation | DONE | Zod `.refine()` rejects `*` wildcard in CORS_ORIGINS |
| 5A.4 Request ID in error logs | DONE | `error-handler.ts` includes `requestId` in warn/error log entries and 500 responses |
| 5A.5 Rate limit headers | DONE | `rate-limiter.ts` adds X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After |

---

## Phase 5B: Security Hardening - IN PROGRESS

| Task | Status | Notes |
|------|--------|-------|
| 5B.1 API key management | DONE | Full module: `modules/api-keys/` (schema, service, routes). Auth plugin supports X-API-Key header. Migration 016. |
| 5B.2 MFA (TOTP) | PENDING | Requires Supabase MFA configuration |
| 5B.3 Session management | PENDING | |

---

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| Backend API | 531 | ALL PASSING |
| New: plan-limits | 5 | PASSING |
| New: api-keys | 10 | PASSING |
| New: cors-validation | 6 | PASSING |

---

## Deep Audit (Second Pass) - COMPLETE

### Critical Discovery: Frontend-Backend Disconnect
- Frontend is in **hybrid state**: ~30% uses Fastify, ~70% uses Supabase directly
- Two competing API clients: `api-client.ts` (Fastify) vs `api.ts` (Supabase Edge Functions)
- Auth is 100% Supabase — Fastify `/auth/login` endpoint exists but frontend never calls it
- Security controls (plan limits, audit, rate limiting) are **bypassed** by Supabase direct path
- **Decision:** Migrate all frontend to Fastify (ADR-008)

### Fixes Applied
- [x] CI/CD: Removed dead `gateway/` directory reference from deploy-production.yml
- [x] CI/CD: Fixed `docker-compose.prod.yml` → `docker-compose.yml --env-file .env.docker`
- [x] TypeScript: Fixed `MinutaPage.tsx:489` — `created_by_name` → `author_name`
- [x] TypeScript: Removed unused imports in `plan-limits.ts`, `api-keys/service.ts`, `plan-limits.test.ts`
- [x] Environment: Added `CREDENTIAL_ENCRYPTION_KEY` as required in `.env.docker.example`
- [x] Bootstrap: Created `scripts/bootstrap.sh` for reproducible local setup

### Module Classification
| Module | Status |
|--------|--------|
| LPR | REAL — Full plate recognition + fuzzy matching |
| Network Scanner | REAL — TCP/ONVIF/ARP scanning |
| ZKTeco | REAL — Complete HTTP API integration |
| Device Control | REAL — Universal multi-brand |
| Relay | REAL — eWeLink/HTTP/GPIO/ZKTeco |
| Cloud Accounts | REAL — Risk analysis, mapping |
| Extensions (Voice) | REAL — ElevenLabs TTS |
| Immersive3D | REAL — Three.js + hand gestures |
| Biomarkers | STUB — No vector distance computation |
| PredictiveCriminology | FICTION — No backend endpoints |
| Operations Dashboard | PARTIAL — Routes only |

---

## Changelog

| Date | Action | Details |
|------|--------|---------|
| 2026-03-23 | Phase 1-4 Complete | Full audit, architecture mapping, gap analysis, implementation plan |
| 2026-03-23 | Phase 5A Complete | Plan limits, auth rate limiting, CORS validation, request ID in errors, rate limit headers |
| 2026-03-23 | Phase 5B.1 Complete | API key module (CRUD, auth plugin integration, migration 016, 10 tests) |
| 2026-03-23 | Deep Audit Complete | Frontend-backend disconnect found, CI/CD fixes, TS fixes, bootstrap script, 6 module classifications |
| 2026-03-23 | Phase A: Architecture Sanitation | NGINX Permissions-Policy fix (camera/mic), TLS template, WebSocket JWT moved to protocol-level auth, network status indicator in AppLayout |
| 2026-03-23 | Phase B: UI+API Integration | Migrated 6/9 data hooks from Supabase direct → apiClient/Fastify (devices, sites, events, incidents, audit_logs). ~70% → ~90% backend coverage |
| 2026-03-23 | MIGRATION COMPLETE | supabase.from() reduced from 57→1 (test only). 14 files migrated. use-supabase-data.ts 100% Fastify. use-module-data.ts 100% Fastify (34 ops). Pages: Sites, Posts, Minuta, Notes, Settings, Playback, Devices dialogs, EWeLink, push-notifications all migrated. Guardrail test added (no-supabase-bypass.test.ts). Edge Functions removed from ReportsPage + AIAssistantPage. 749 tests passing (218 FE + 531 BE). |
| 2026-03-23 | Phase C: Responsive Design | DevicesPage, EventsPage, IncidentsPage responsive tables + mobile overlays + back buttons. Adaptive filter widths |
| 2026-03-23 | Phase D+E: Real-time & Network | Verified WebSocket reconnection (exponential backoff), push notifications, PWA service worker. Network indicator added |
| 2026-03-23 | Phase F: Security | CSP fix (wss:// + media https:), JWT query param elimination, security headers audit |
| 2026-03-23 | Phase G: Observability | Backend Prometheus/Pino/Health confirmed. Frontend ErrorBoundary logging confirmed |
| 2026-03-23 | Phase 4: Verification | TypeScript 0 errors, Build PASS (7.33s), Tests 22/22 files 215/215 PASS |
| 2026-03-23 | Phase 5: Documentation | OPEN_GAPS.md created, PROGRESS.md updated, delivery report generated |
| 2026-03-23 | OLA 2A: Storage proxy | DocumentsPage.tsx migrated from supabase.storage to apiClient/database-records. 0 supabase.storage in prod code. |
| 2026-03-23 | OLA 2B: Services unification | 14 services/*-api.ts migrated from manual fetch+supabase.auth.getSession to apiClient. Eliminated ~500 lines of duplicated transport code. |
| 2026-03-23 | OLA 2C: Product hygiene | PredictiveCriminologyPage + BiogeneticSearchPage hidden from nav (ADR-009). Icons cleaned. Backlog documented in KNOWN_LIMITATIONS.md. |
| 2026-03-23 | GO SÓLIDO | 749 tests passing (218 FE + 531 BE). 0 supabase.from() in prod code. 0 supabase.storage in prod code. 0 Edge Functions in pages. Guardrails active. All backend controls enforced on migrated routes. |
