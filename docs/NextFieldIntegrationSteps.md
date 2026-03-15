# AION Vision Hub -- Next Field Integration Steps

**Date:** 2026-03-08
**Version:** 2.0 (Post-Hardening)

---

## 1. Overview

This document outlines the concrete steps required to take AION Vision Hub from its current state (fully architected, partially implemented) to a field-deployable surveillance platform. Steps are ordered by dependency and priority.

---

## 2. Phase 1: Security Hardening (Week 1-2)

### 2.1 Edge Function Rate Limiting

**Priority:** P0 -- Must complete before any public exposure.

1. Create `supabase/functions/_shared/rate-limiter.ts` with per-tenant, per-IP throttling.
2. Use Supabase table `rate_limit_counters` for distributed state.
3. Apply to all 11 edge functions via shared middleware pattern.
4. Defaults: 100 req/min per tenant, 30 req/min per IP.

### 2.2 2FA Enforcement

**Priority:** P0

1. Enable Supabase Auth MFA (TOTP).
2. Add `requires_2fa` column to `user_roles` table.
3. Enforce for `super_admin` and `tenant_admin` roles.
4. Add MFA enrollment UI to Settings page.

### 2.3 CSP Headers

**Priority:** P0

1. Add meta CSP tag to `index.html` via Vite plugin.
2. Configure Fastify `@fastify/helmet` for backend responses.
3. Add `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS.

### 2.4 Credential Vault Persistence

**Priority:** P0

1. Create `device_credentials` table (encrypted blob, device_id FK, tenant_id).
2. Migrate `CredentialVault` from `Map` to DB-backed with in-memory cache.
3. Separate `CREDENTIAL_ENCRYPTION_KEY` from `JWT_SECRET` (mandatory env var).

---

## 3. Phase 2: Video Pipeline (Week 3-6)

### 3.1 WebRTC Player Component

**Priority:** P1 -- Core value proposition.

1. Install `hls.js` or use native WebRTC API.
2. Create `<VideoPlayer>` component consuming MediaMTX WebRTC/HLS endpoints.
3. Integrate into Live View grid cells, replacing placeholder content.
4. Handle player states: loading, playing, error, offline.
5. Add fullscreen, snapshot (canvas capture), audio toggle.

### 3.2 Stream Registration

**Priority:** P1

1. Implement `IStreamAdapter.startStream()` in ONVIF/ISAPI/Dahua adapters.
2. Register RTSP sources with MediaMTX via its REST API (port 9997).
3. Map `device_id` → MediaMTX path for frontend consumption.
4. Implement stream health monitoring (periodic heartbeat checks).

### 3.3 Playback Engine

**Priority:** P1

1. Implement `IPlaybackAdapter.searchRecordings()` for NVR SDK queries.
2. Build playback API endpoint in backend-api: `GET /streams/:deviceId/recordings`.
3. Connect PlaybackPage timeline to real recording segments.
4. Implement clip export: `POST /streams/:deviceId/export` → file download.

---

## 4. Phase 3: Device Adapters (Week 5-8)

### 4.1 ONVIF Adapter

1. Install `onvif` npm package in edge-gateway.
2. Implement WS-Discovery for network scanning.
3. Implement device info, capabilities, and profile retrieval.
4. Implement stream URI extraction for MediaMTX registration.
5. Implement event subscription (ONVIF PullPoint or Basic).

### 4.2 Hikvision ISAPI Adapter

1. Implement HTTP Digest authentication.
2. ISAPI endpoints: `/System/deviceInfo`, `/Streaming/channels`, `/ContentMgmt/search`.
3. Parse ISAPI XML responses into TypeScript types.
4. Event stream via `/Event/notification/alertStream`.

### 4.3 Dahua HTTP-API Adapter

1. Implement Dahua CGI authentication.
2. Endpoints: `/cgi-bin/magicBox.cgi`, `/cgi-bin/mediaFileFind.cgi`.
3. Parse multipart/mixed responses.
4. Event stream via `/cgi-bin/eventManager.cgi?action=attach`.

---

## 5. Phase 4: Testing Infrastructure (Week 4-6)

### 5.1 Unit Tests

1. Install Vitest in backend-api and frontend.
2. Test all service classes (tenant scoping, CRUD operations).
3. Test React hooks (useModuleData, useAuth, useI18n).
4. Test permission logic (hasModuleAccess, requireRole).
5. Target: 70% coverage on service layer.

### 5.2 Integration Tests

1. Configure test database with seed data.
2. Test Fastify route handlers end-to-end (request → response).
3. Test RLS policies (verify tenant isolation at DB level).
4. Test auth flow (login → JWT → protected route).

### 5.3 E2E Tests

1. Install Playwright.
2. Test critical flows: login, device CRUD, event lifecycle, incident resolution.
3. Test RBAC (verify viewer cannot access admin pages).
4. Configure to run in CI.

---

## 6. Phase 5: DevOps (Week 6-8)

### 6.1 CI/CD Pipeline

1. GitHub Actions workflow: lint → typecheck → test → build.
2. Staging deployment on PR merge to `develop`.
3. Production deployment on PR merge to `main` (with approval gate).
4. Edge function deployment via `supabase functions deploy`.

### 6.2 Monitoring

1. Add Prometheus metrics endpoint to backend-api (`/metrics`).
2. Track: request latency, error rates, active streams, DB connection pool.
3. Deploy Grafana with pre-built dashboards.
4. Configure alerting for error rate > 5%, latency > 2s.

### 6.3 Log Aggregation

1. Deploy Loki + Promtail for centralized logging.
2. Structured JSON logging from backend-api and edge-gateway.
3. Log correlation via request ID headers.

---

## 7. Phase 6: External Integrations (Week 8-12)

### 7.1 Email Notifications

1. Integrate Resend or SendGrid in `event-alerts` edge function.
2. Add SMTP configuration to Settings page.
3. Template system for alert emails with event details and snapshots.

### 7.2 WhatsApp Business API

1. Register with Meta Business API.
2. Create `whatsapp-api` edge function for message sending.
3. Implement webhook receiver for inbound messages.
4. Connect to Intercom module's WhatsApp tab.

### 7.3 ElevenLabs Voice AI

1. Create `elevenlabs-tts` edge function.
2. Text-to-speech for intercom welcome messages.
3. Speech-to-text for voice commands (future).
4. Add API key configuration to Settings.

### 7.4 SIP/VoIP

1. Deploy SIP server (Asterisk/FreeSWITCH).
2. Implement SIP registration for intercom devices.
3. Call routing logic for human/AI/mixed attend modes.
4. WebRTC-to-SIP gateway for browser-based calling.

---

## 8. Phase 7: Production Readiness (Week 10-12)

### 8.1 Performance

1. Implement React.lazy() code splitting for all 20 routes.
2. Add virtualization for device/event lists (react-window).
3. Database query optimization (EXPLAIN ANALYZE on hot paths).
4. Connection pooling tuning for PostgreSQL.

### 8.2 Data Management

1. Configure Supabase PITR for continuous backups.
2. Implement data retention policies (configurable per tenant).
3. Add automated purge for old audit logs, events (> 90 days default).

### 8.3 Documentation

1. API documentation with OpenAPI/Swagger spec.
2. User manual for operators (multi-language).
3. Deployment runbook with troubleshooting guide.
4. SLA definitions and escalation procedures.

---

## 9. Timeline Summary

| Phase | Duration | Dependencies | Key Deliverable |
|---|---|---|---|
| 1. Security Hardening | Week 1-2 | None | Rate limiting, 2FA, CSP, vault persistence |
| 2. Video Pipeline | Week 3-6 | Phase 1 | Live video, playback, stream management |
| 3. Device Adapters | Week 5-8 | Phase 2 | ONVIF, ISAPI, Dahua real communication |
| 4. Testing | Week 4-6 | Phase 1 | Unit, integration, E2E test suites |
| 5. DevOps | Week 6-8 | Phase 4 | CI/CD, monitoring, logging |
| 6. Integrations | Week 8-12 | Phase 2 | Email, WhatsApp, VoIP, ElevenLabs |
| 7. Production | Week 10-12 | All | Performance, backups, documentation |

**Estimated team:** 2 full-stack developers + 1 QA engineer + 1 DevOps engineer.

---

*End of Next Field Integration Steps*
