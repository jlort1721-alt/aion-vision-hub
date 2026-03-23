# GAP_ANALYSIS.md - Clave Seguridad

> Current state vs Target architecture
> Generated: 2026-03-23

---

## Classification Legend
- **[EXISTE]** - Fully implemented and functional
- **[EXISTE PARCIAL]** - Implementation started but incomplete
- **[NO EXISTE]** - Not implemented
- **[NO VERIFICADO]** - Code exists but runtime behavior unconfirmed

---

## Layer 1: Device Integration

| Capability | Status | Evidence | Gap |
|-----------|--------|----------|-----|
| ONVIF Discovery | [EXISTE PARCIAL] | `edge-gateway/services/discovery.ts`, `backend/services/network-scanner.ts` | Discovery exists but no UI integration for auto-add workflow |
| RTSP Ingestion | [EXISTE] | `services/stream-bridge.ts` with brand-specific URL builders | Complete for supported brands |
| Hikvision Adapter | [EXISTE] | `device-adapters/hikvision/` (ISAPI client, XML parser) | Functional, covers stream pull and system info |
| Dahua Adapter | [EXISTE] | `device-adapters/dahua/` (RPC client) | Functional for basic operations |
| ONVIF Generic | [EXISTE] | `device-adapters/onvif/` | Covers Axis, Hanwha, Uniview, etc. |
| PTZ Control | [EXISTE PARCIAL] | `edge-gateway/routes/ptz.ts`, adapter interfaces defined | Routes exist, UI integration unclear |
| I/O Relay Control | [EXISTE] | `services/relay-controller.ts` (eWeLink, HTTP, GPIO, ZKTeco, Hik, Dahua) | Multi-protocol relay support |
| Health Monitoring | [EXISTE] | `workers/health-check-worker.ts` | Periodic ping, status transitions |
| Credential Vault | [EXISTE] | `common-utils/crypto.ts` (AES-256-GCM), DB `credentials_encrypted` flag | Backend encryption complete |
| Firmware Management | [NO EXISTE] | No code found | No firmware tracking or update orchestration |
| Device Grouping | [EXISTE PARCIAL] | `schema/device_groups` table exists | Schema exists, no UI or API for managing groups |

**Critical Gaps:**
1. No ONVIF discovery → auto-add device workflow in UI
2. No firmware version tracking or update management
3. Device grouping schema exists but no routes or UI

---

## Layer 2: Media Gateway

| Capability | Status | Evidence | Gap |
|-----------|--------|----------|-----|
| RTSP → WebRTC | [EXISTE] | MediaMTX config, `stream-bridge.ts`, `WebRTCPlayer` component | Pipeline functional |
| RTSP → HLS | [EXISTE] | MediaMTX HLS output, HLS.js in frontend | Fallback available |
| Adaptive Bitrate | [EXISTE PARCIAL] | `streaming.ts` StreamPolicyConfig (mosaic=sub, fullscreen=main) | Policy defined, enforcement unclear |
| Multi-viewer Grid | [EXISTE PARCIAL] | `LiveViewPage.tsx` exists | Grid layout exists but advanced layouts (save/load, drag-drop) unclear |
| Playback | [EXISTE PARCIAL] | `PlaybackPage.tsx`, `edge-gateway/routes/playback.ts` | Routes exist, full timeline UI unverified |
| Snapshots | [EXISTE PARCIAL] | `events` table has `snapshotUrl` | Events reference snapshots, no on-demand capture API confirmed |
| Clips | [NO EXISTE] | No clip export endpoint found | No time-range video export |
| Edge Recording | [NO EXISTE] | No recording configuration | No edge-side recording management |
| Stream Tokens | [EXISTE] | `streams/routes.ts` POST /streams/token, `stream-token.test.ts` | JWT-based stream access |
| Tour/Sequence | [EXISTE PARCIAL] | `liveview/TourEngine` component | UI component exists |

**Critical Gaps:**
1. No clip/video export functionality
2. No edge recording management
3. No on-demand snapshot API
4. Playback timeline UI completeness unverified

---

## Layer 3: Event & Rules Engine

| Capability | Status | Evidence | Gap |
|-----------|--------|----------|-----|
| Event Ingestion | [EXISTE] | `events/service.ts`, `events/routes.ts` | CRUD + stats |
| Event Normalization | [EXISTE PARCIAL] | `event-normalization.test.ts` exists | Test exists, normalization logic location unclear |
| Event Correlation | [NO EXISTE] | No correlation engine found | No cross-device/cross-site pattern detection |
| Alert Rules | [EXISTE] | `alerts/` module with rules, instances, channels | Rule CRUD + evaluation |
| Escalation Policies | [EXISTE] | `alerts/schema` has escalation_policies table | Schema + basic logic |
| SOPs | [NO EXISTE] | AI can "generate_sop" but no SOP management module | No SOP templates, assignment, or execution tracking |
| Automation Actions | [EXISTE] | `automation/` module + `workers/automation-engine.ts` | Rule-based triggers with actions |
| Incident Lifecycle | [EXISTE] | `incidents/` module with status, evidence, comments | Create → status management |
| Event Timeline | [EXISTE PARCIAL] | Events page exists, incident has evidence array | No unified cross-event timeline visualization |

**Critical Gaps:**
1. No event correlation engine (cross-device pattern detection)
2. No SOP management system (templates, assignment, execution)
3. No unified timeline visualization across events/incidents

---

## Layer 4: Operations Console

| Capability | Status | Evidence | Gap |
|-----------|--------|----------|-----|
| Dashboard | [EXISTE] | `DashboardPage.tsx` with charts/stats | Functional |
| Live View | [EXISTE] | `LiveViewPage.tsx` + `WebRTCPlayer` + ops/events panels | Functional with WebRTC |
| Event Wall | [EXISTE] | `EventsPage.tsx` + real-time WebSocket | Real-time feed |
| Incident Board | [EXISTE PARCIAL] | `IncidentsPage.tsx` | Page exists, kanban view unverified |
| Patrol Management | [EXISTE] | `PatrolsPage.tsx` + backend routes/checkpoints/logs | Routes, checkpoints, logging |
| Shift Management | [EXISTE] | `ShiftsPage.tsx` + backend shifts/assignments | Scheduling + assignments |
| Intercom | [EXISTE] | `IntercomPage.tsx` + SIP/Fanvil backend | SIP integration |
| Guard Tour (NFC/QR) | [NO EXISTE] | Patrol checkpoints exist but no NFC/QR verification | No mobile checkpoint scanning |
| Command Palette | [EXISTE] | `CommandPalette` component | Ctrl+K navigation |
| Minuta/Logbook | [EXISTE] | `MinutaPage.tsx` + DB minuta_entries | Shift logbook |
| Emergency Protocols | [EXISTE] | `EmergencyPage.tsx` + protocols/activations | Protocol management + activation |

**Critical Gaps:**
1. No NFC/QR guard tour checkpoint verification
2. Incident kanban view completeness unverified

---

## Layer 5: Tenant & Service Layer

| Capability | Status | Evidence | Gap |
|-----------|--------|----------|-----|
| Tenant Management | [EXISTE] | `tenants/` module, tenant schema with plan/settings | CRUD |
| Site Onboarding | [EXISTE] | `sites/` module + `SitesPage.tsx` with maps | Full site management |
| Plan Management | [EXISTE PARCIAL] | Tenant has `plan` (starter/professional/enterprise) + settings | Schema has limits but no enforcement logic found |
| User Management | [EXISTE] | `users/` module + roles | CRUD + role assignment |
| RBAC | [EXISTE] | 5 roles, frontend ModuleGuard + backend requireRole() | Functional |
| API Keys | [NO EXISTE] | No API key management found | No service-to-service auth tokens |
| Billing/Invoicing | [EXISTE PARCIAL] | `contracts/` module with invoices table | Schema exists, payment integration absent |
| White-labeling | [NO EXISTE] | Hardcoded "Clave Seguridad" branding | No tenant-specific branding |
| Tenant Self-service | [NO EXISTE] | Admin-only tenant creation | No self-service signup flow |

**Critical Gaps:**
1. No plan limit enforcement (max devices, users, sites)
2. No API key management for service-to-service
3. No payment gateway integration
4. No tenant self-service onboarding

---

## Layer 6: Security & Compliance

| Capability | Status | Evidence | Gap |
|-----------|--------|----------|-----|
| JWT Auth | [EXISTE] | HS256 with issuer validation, 24h expiry | Solid |
| Supabase Auth | [EXISTE] | Email/password, session management | Functional |
| MFA | [NO EXISTE] | No MFA implementation found | No TOTP/SMS second factor |
| RBAC | [EXISTE] | 5 roles + module-level guards | Frontend + backend |
| Audit Trail | [EXISTE] | `audit/` plugin + module, IP/user-agent tracking | All mutations logged |
| Encryption at Rest | [EXISTE PARCIAL] | Credentials AES-256-GCM, general DB not encrypted | Only device credentials encrypted |
| TLS | [EXISTE] | NGINX config with proxy, HSTS header | Transport encryption |
| Data Retention | [EXISTE] | `retention-worker` + `data_retention_policies` table | Policy-based retention |
| Compliance Templates | [EXISTE PARCIAL] | `compliance/` module with templates | Schema exists, Ley 1581 templates unverified |
| Evidence Chain | [NO EXISTE] | No hash-based evidence verification | No cryptographic evidence sealing |
| Pen Testing | [NO EXISTE] | No evidence of security assessments | Not tracked |
| CSP Headers | [EXISTE] | Helmet + index.html meta tag | Strict CSP |
| Rate Limiting | [EXISTE] | Per tenant:IP, 100/min | Global rate limiting |
| Webhook Verification | [EXISTE] | HMAC-SHA256 for WhatsApp | Timing-safe comparison |

**Critical Gaps:**
1. No MFA support
2. No cryptographic evidence chain/sealing
3. No per-endpoint rate limiting (auth endpoints should be stricter)
4. Plan limit enforcement missing

---

## Layer 7: Observability

| Capability | Status | Evidence | Gap |
|-----------|--------|----------|-----|
| Prometheus Metrics | [EXISTE] | `/health/metrics` endpoint, prom-client | Request duration + count |
| Structured Logging | [EXISTE] | Pino with JSON output | LOG_LEVEL configurable |
| Request Tracing | [EXISTE PARCIAL] | X-Request-ID per request | UUID tracking, no distributed trace propagation |
| Health Probes | [EXISTE] | `/health`, `/health/liveness`, `/health/ready` | K8s-compatible |
| Grafana Dashboards | [NO EXISTE] | `monitoring/` dir exists but no dashboard JSONs found | Config scaffolding only |
| OpenTelemetry Tracing | [EXISTE PARCIAL] | OTel packages in dependencies, env var for OTLP endpoint | Dependencies exist, exporter not confirmed active |
| System Alerts | [NO EXISTE] | No system-level alerting (Alertmanager/PagerDuty) | Only security alerts, no infra alerts |
| SLA Monitoring | [EXISTE PARCIAL] | `sla/` module with definitions/tracking tables | Schema exists, real-time SLA tracking UI unclear |
| Device Health Dashboard | [EXISTE PARCIAL] | `SystemHealthPage.tsx` + health-check-worker | Worker pings devices, UI completeness unverified |
| Stream Health Metrics | [NO EXISTE] | No FPS/bitrate/packet-loss tracking | No stream quality metrics |

**Critical Gaps:**
1. No Grafana dashboards defined
2. No distributed tracing end-to-end
3. No stream quality metrics
4. No system-level alerting (infra down, disk full, etc.)

---

## Layer 8: Evidence & Audit

| Capability | Status | Evidence | Gap |
|-----------|--------|----------|-----|
| Evidence Collection | [EXISTE PARCIAL] | Incidents have evidence[] with type (snapshot/clip/log/note) | Array field, no dedicated evidence service |
| Chain of Custody | [NO EXISTE] | No access tracking per evidence item | No who-viewed-when log |
| Evidence Export | [NO EXISTE] | No export endpoint | No packaged evidence download |
| Evidence Sealing | [NO EXISTE] | No cryptographic hashing | No tamper detection |
| Watermarking | [NO EXISTE] | No video watermark | No metadata overlay |
| Retention | [EXISTE PARCIAL] | retention-worker exists | Policy enforcement, evidence-specific retention unclear |

**Critical Gaps:**
1. No dedicated evidence management service
2. No chain of custody tracking
3. No evidence export with metadata
4. No cryptographic sealing for legal admissibility

---

---

## CRITICAL FINDING: Frontend-Backend Disconnect

**Discovered during deep audit (2026-03-23, second pass)**

The frontend is in a **hybrid state** between two backends:

| Component | Data Source | Evidence |
|-----------|------------|----------|
| Auth (login, signup) | Supabase only | `AuthContext.tsx` calls `supabase.auth.signInWithPassword()` |
| Device list (DevicesPage) | Supabase only | `use-supabase-data.ts` queries `supabase.from('devices')` |
| Device list (LiveViewPage) | Fastify backend | `use-devices.ts` calls `apiClient.get('/devices')` |
| Device operations (test/register) | Fastify backend | Direct `fetch()` to `VITE_API_URL` |
| Events (legacy) | Supabase only | `use-supabase-data.ts` queries events table |
| Events (new hook) | Fastify backend | `use-events.ts` calls `apiClient.get('/events')` |
| Live View streaming | MediaMTX directly | `WebRTCPlayer.tsx` connects to `VITE_WEBRTC_URL` |
| Email/WhatsApp/Reports | Supabase Edge Functions | `services/api.ts` calls `VITE_SUPABASE_URL/functions/v1` |
| WebSocket real-time | Fastify (if configured) | `use-websocket.ts` connects to `VITE_API_URL/ws` |

**Two competing API clients:**
- `src/lib/api-client.ts` → Fastify backend (`VITE_API_URL`)
- `src/services/api.ts` → Supabase Edge Functions (`VITE_SUPABASE_URL/functions/v1`)

**Impact:** The Fastify backend has 45+ modules with comprehensive business logic, but the frontend is NOT fully utilizing it. Most pages still read from Supabase directly.

**Required action:** Migrate all frontend data fetching to use `apiClient` → Fastify backend. This is the **single most impactful integration task**.

---

## Orphaned/Stub Modules

| Module | Status | Evidence |
|--------|--------|----------|
| PredictiveCriminologyPage | **FICTION** | UI exists, no backend endpoints for `/analytics/predictive/forecast` |
| BiogeneticSearchPage | **PARTIAL** | UI works, backend `biomarkers/service.ts` has no real vector distance |
| Biomarkers service | **STUB** | Stores vectors but `searchBiomarkersBySimilarity` doesn't compute distances |
| use-predictive.ts | **STUB** | Hook calls non-existent endpoints |
| Operations module | **PARTIAL** | Routes exist, service implementation unclear |

**Real modules confirmed functional:**
- LPR: Full plate recognition with fuzzy matching and relay integration
- Network scanner: Real TCP/ONVIF/ARP scanning
- ZKTeco: Complete HTTP API integration
- Device Control: Universal multi-brand control
- Relay: Multi-backend (eWeLink, HTTP, GPIO, ZKTeco)
- Cloud Accounts: Risk analysis, account mapping
- Extensions: ElevenLabs TTS integration
- Immersive3D: Real Three.js + hand gesture + device data

---

## Technical Debt Findings

| Issue | Severity | Evidence |
|-------|----------|----------|
| Duplicate API clients | MEDIUM | `api-client.ts` + `api.ts` serve overlapping purposes |
| JWT in WebSocket URL query param | MEDIUM | `use-websocket.ts:62`, `use-digital-twin.ts:98` — token visible in logs |
| Migrations lack rollback logic | MEDIUM | Migrations 013-015 have no DOWN statements |
| camelCase/snake_case mixing | HIGH | Zod schemas use camelCase, DB uses snake_case, requires mapping |
| No error boundaries on 35+ pages | MEDIUM | Only global error boundary, pages crash silently |
| CI/CD referenced non-existent gateway/ dir | CRITICAL (FIXED) | `deploy-production.yml` — removed dead reference |
| Missing docker-compose.prod.yml | CRITICAL (FIXED) | Deploy script referenced it — now uses docker-compose.yml |

---

## Priority Gap Summary

### P0 - Stability & Integrity (Must fix)
1. **Plan limit enforcement** - Tenants can exceed device/user/site limits
2. **Per-endpoint rate limiting** - Auth/login needs stricter limits
3. **Error recovery in streams** - Stream reconnection on failure
4. **Database migration runner** - No automated migration on deploy confirmed

### P1 - Security (Critical)
5. **MFA support** - Required for enterprise security platform
6. **API key management** - Service-to-service auth needed
7. **CORS validation** - Validate origins aren't wildcards
8. **Session management** - No concurrent session limits

### P2 - Core VMS Features (Competitive)
9. **Clip export** - Essential VMS feature, not implemented
10. **On-demand snapshots** - API for live snapshot capture
11. **Event correlation** - Cross-device pattern detection
12. **SOP management** - Operational procedure templates
13. **Evidence chain** - Legal admissibility requirements

### P3 - Observability (Production readiness)
14. **Grafana dashboards** - Visualization of existing metrics
15. **Distributed tracing** - End-to-end request tracing
16. **Stream quality metrics** - FPS, bitrate, packet loss
17. **System alerting** - Infrastructure health alerts

### P4 - Operational (UX/Completeness)
18. **ONVIF auto-add workflow** - Discovery → one-click add
19. **Guard tour NFC/QR** - Mobile checkpoint verification
20. **Incident kanban** - Visual incident board
21. **Device firmware tracking** - Version management
22. **Tenant self-service** - Onboarding flow

### P5 - Scale & Future
23. **Payment integration** - Billing automation
24. **White-labeling** - Tenant branding
25. **Kubernetes** - Container orchestration
26. **Edge recording** - Local storage management
