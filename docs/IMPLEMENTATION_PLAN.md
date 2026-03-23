# IMPLEMENTATION_PLAN.md - Clave Seguridad

> Phased integration plan based on gap analysis
> Generated: 2026-03-23
> Priority: Stability → Security → Traceability → Observability → Features

---

## Phase 5A: Stability & Integrity Hardening

**Goal:** Ensure the existing system is rock-solid before adding features

### 5A.1 Plan Limit Enforcement
- **Status:** [NO EXISTE] - Tenant plan has limits in schema but no enforcement
- **Action:** Add middleware that checks tenant plan limits before device/user/site creation
- **Files:** New `plugins/plan-limits.ts`, modify `devices/routes.ts`, `users/routes.ts`, `sites/routes.ts`
- **Test:** Attempt to exceed limits returns 403 with PLAN_LIMIT_EXCEEDED
- **Effort:** Medium

### 5A.2 Auth Rate Limiting
- **Status:** [EXISTE PARCIAL] - Global rate limit only
- **Action:** Add stricter rate limits on `/auth/login` (10/min) and `/auth/token` (20/min)
- **Files:** Modify `auth/routes.ts` with per-route rate limit config
- **Test:** 11th login attempt in 1 min returns 429
- **Effort:** Small

### 5A.3 CORS Origin Validation
- **Status:** [EXISTE PARCIAL] - No wildcard check
- **Action:** Add Zod refinement in `config/env.ts` to reject `*` in CORS_ORIGINS
- **Test:** Server fails to start with `CORS_ORIGINS=*`
- **Effort:** Small

### 5A.4 Stream Reconnection
- **Status:** [NO VERIFICADO] - MediaMTX may handle this, but no explicit reconnection logic
- **Action:** Add stream health check in edge-gateway, auto-re-register on failure
- **Files:** Modify `edge-gateway/services/stream-manager.ts`
- **Test:** Simulate stream drop, verify reconnection within 10s
- **Effort:** Medium

### 5A.5 Migration Runner Verification
- **Status:** [NO VERIFICADO] - Migrations exist, runner not confirmed
- **Action:** Ensure `db:migrate` runs in docker-compose startup and deploy pipeline
- **Files:** Verify `docker-compose.yml` backend command, `deploy-production.yml`
- **Test:** Fresh docker-compose up applies all 15 migrations
- **Effort:** Small

---

## Phase 5B: Security Hardening

### 5B.1 MFA Support (TOTP)
- **Status:** [NO EXISTE]
- **Action:** Add TOTP-based MFA using Supabase Auth MFA or custom implementation
- **Files:** New `modules/mfa/`, modify `auth/routes.ts`, frontend `LoginPage.tsx`
- **Scope:** TOTP setup, QR code generation, verification on login, recovery codes
- **Test:** Login with valid password but no TOTP code returns 401 with MFA_REQUIRED
- **Effort:** Large

### 5B.2 API Key Management
- **Status:** [NO EXISTE]
- **Action:** Add API key CRUD for service-to-service auth
- **Files:** New `modules/api-keys/`, new schema `api_keys` table, modify `plugins/auth.ts`
- **Scope:** Generate, revoke, scope-limited API keys with hash storage
- **Test:** Request with valid API key in X-API-Key header passes auth
- **Effort:** Medium

### 5B.3 Session Management
- **Status:** [NO EXISTE] - No concurrent session tracking
- **Action:** Track active sessions, allow tenant admins to view/revoke
- **Files:** Modify `auth/routes.ts`, add session tracking in refresh token flow
- **Test:** List active sessions, revoke specific session invalidates its tokens
- **Effort:** Medium

### 5B.4 Request ID in Error Logs
- **Status:** [EXISTE PARCIAL] - Request ID generated but not in error logs
- **Action:** Include `requestId` in error handler log output
- **Files:** Modify `middleware/error-handler.ts`
- **Test:** Error log entry contains `requestId` field
- **Effort:** Small

### 5B.5 Rate Limit Headers
- **Status:** [NO EXISTE]
- **Action:** Add X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After headers
- **Files:** Modify `middleware/rate-limiter.ts`
- **Test:** Response headers include rate limit info
- **Effort:** Small

---

## Phase 5C: Core VMS Features

### 5C.1 Clip Export
- **Status:** [NO EXISTE]
- **Action:** Add clip export endpoint that requests time-range from device/NVR via adapter
- **Files:** New endpoint in `streams/routes.ts`, adapter method in `IPlaybackAdapter`
- **Scope:** Start/end time, device selection, async generation, download URL
- **Test:** Request clip → get job ID → poll → download MP4
- **Effort:** Large

### 5C.2 On-Demand Snapshots
- **Status:** [NO EXISTE]
- **Action:** Add snapshot capture via RTSP frame grab or ISAPI/ONVIF snapshot
- **Files:** New endpoint `GET /devices/:id/snapshot`, adapter method
- **Scope:** Returns JPEG from live stream
- **Test:** Snapshot request returns 200 with image/jpeg content-type
- **Effort:** Medium

### 5C.3 SOP Management
- **Status:** [NO EXISTE]
- **Action:** Add SOP template CRUD, assignment to event types, execution tracking
- **Files:** New `modules/sops/`, new schema tables, frontend `SOPsPage.tsx`
- **Scope:** Template editor, step-by-step checklists, auto-trigger on event type
- **Test:** Event of type X triggers SOP assignment to operator
- **Effort:** Large

### 5C.4 Event Correlation Engine
- **Status:** [NO EXISTE]
- **Action:** Add correlation rules that detect patterns across multiple events
- **Files:** New `workers/correlation-engine.ts`, correlation rule schema
- **Scope:** Time-window correlation, cross-device grouping, auto-incident creation
- **Test:** 3 motion events across 3 cameras in 30s creates correlated incident
- **Effort:** Large

### 5C.5 ONVIF Discovery → Auto-Add UI
- **Status:** [EXISTE PARCIAL] - Backend discovery exists, no UI flow
- **Action:** Add discovery results page with one-click device registration
- **Files:** Frontend discovery workflow in `DevicesPage.tsx` or new `DiscoveryPage.tsx`
- **Scope:** Scan network → show found devices → select → configure → add
- **Test:** Discovery scan finds device → click add → device appears in inventory
- **Effort:** Medium

---

## Phase 5D: Evidence & Audit

### 5D.1 Evidence Service
- **Status:** [NO EXISTE] - Evidence is inline array in incidents
- **Action:** Create dedicated evidence management with proper lifecycle
- **Files:** New `modules/evidence/`, new `evidence` table, link to incidents
- **Scope:** Upload, classify, tag, search, download with metadata
- **Test:** Upload evidence → link to incident → download with metadata
- **Effort:** Medium

### 5D.2 Evidence Chain of Custody
- **Status:** [NO EXISTE]
- **Action:** Track every access to evidence items with audit log
- **Files:** Modify evidence service, add `evidence_access_log` table
- **Scope:** Log view, download, export, share actions
- **Test:** Download evidence → access log entry created
- **Effort:** Medium

### 5D.3 Evidence Export with Hashing
- **Status:** [NO EXISTE]
- **Action:** Package evidence with SHA-256 hashes, timestamps, chain of custody
- **Files:** New export endpoint, hash generation utility
- **Scope:** ZIP package with manifest, hashes, original files
- **Test:** Export package → verify hashes match → verify manifest complete
- **Effort:** Medium

---

## Phase 5E: Observability

### 5E.1 Grafana Dashboards
- **Status:** [NO EXISTE] - monitoring/ dir exists but empty
- **Action:** Create dashboard JSONs for API, devices, streams, system health
- **Files:** `backend/monitoring/dashboards/*.json`, Grafana provisioning config
- **Scope:** 4 dashboards: API Performance, Device Health, Stream Status, System Overview
- **Test:** Docker-compose up includes Grafana with pre-loaded dashboards
- **Effort:** Medium

### 5E.2 Distributed Tracing
- **Status:** [EXISTE PARCIAL] - OTel deps exist, exporter not confirmed
- **Action:** Verify and configure OTLP exporter to Jaeger/Tempo
- **Files:** Verify `app.ts` OTel init, add docker-compose Jaeger service
- **Test:** Request appears as trace in Jaeger UI with spans
- **Effort:** Medium

### 5E.3 Stream Quality Metrics
- **Status:** [NO EXISTE]
- **Action:** Collect FPS, bitrate, packet loss from MediaMTX API
- **Files:** New `workers/stream-metrics-worker.ts`, Prometheus gauges
- **Scope:** Poll MediaMTX `/v3/paths/` for active stream stats
- **Test:** Grafana shows stream quality metrics per device
- **Effort:** Medium

### 5E.4 System Alerting
- **Status:** [NO EXISTE]
- **Action:** Add Alertmanager rules for DB down, Redis down, high error rate, disk full
- **Files:** `backend/monitoring/alertmanager.yml`, rules config
- **Test:** Simulated DB down triggers alert notification
- **Effort:** Medium

---

## Phase 6: Hardening, Testing & Documentation

### 6.1 Integration Tests
- Add E2E tests for critical flows: login → view device → see stream → create event → create incident
- Test plan limit enforcement
- Test MFA flow (if implemented)
- Test clip export lifecycle

### 6.2 Load Testing
- k6 scripts for API endpoints
- Concurrent stream stress test
- WebSocket connection scaling

### 6.3 Security Review
- Dependency audit (npm audit)
- OWASP top 10 checklist
- CSP policy review
- Credential rotation procedure

### 6.4 Documentation
- Update ARCHITECTURE_CURRENT.md after changes
- API reference (auto-generated from Swagger)
- Operator manual updates
- Deployment runbook

---

## Phase 7: Production Checklist

### Pre-launch
- [ ] All P0 gaps closed
- [ ] All P1 gaps closed
- [ ] Database migrations tested on production-like data
- [ ] Backup/restore tested
- [ ] Health probes verified with monitoring
- [ ] SSL certificates configured
- [ ] DNS configured
- [ ] Environment variables documented and set
- [ ] Rate limiting verified
- [ ] Error monitoring active
- [ ] Log aggregation active

### Launch
- [ ] Docker images built and pushed
- [ ] Database migrated
- [ ] Services healthy
- [ ] Smoke tests pass
- [ ] First tenant created
- [ ] First device connected
- [ ] First stream verified

### Post-launch
- [ ] Monitoring dashboards reviewed
- [ ] Alert rules verified
- [ ] Backup schedule confirmed
- [ ] Performance baseline established
- [ ] Security scan completed

---

## Execution Order

```
Phase 5A (Stability)     ████████░░  ~1 week
Phase 5B (Security)      ████████████░░  ~2 weeks
Phase 5C (VMS Features)  ████████████████░░  ~3 weeks
Phase 5D (Evidence)      ████████░░  ~1 week
Phase 5E (Observability) ████████░░  ~1 week
Phase 6 (Hardening)      ████████████░░  ~2 weeks
Phase 7 (Production)     ████░░  ~3 days
```

**Total estimated scope:** ~10 weeks for full implementation
**Recommended start:** Phase 5A immediately (highest ROI, lowest risk)
