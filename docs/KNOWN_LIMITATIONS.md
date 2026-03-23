# KNOWN_LIMITATIONS.md - Clave Seguridad

> Documented limitations, constraints, and accepted risks
> Generated: 2026-03-23

---

## Architectural Limitations

### L-001: Single Database Instance
- **Impact:** No horizontal read scaling, single point of failure
- **Mitigation:** PostgreSQL replication can be added. Docker volume for persistence.
- **Resolution:** Add read replicas when >1000 concurrent users needed

### L-002: Redis Optional (In-Memory Fallback)
- **Impact:** Rate limiting state lost on restart, no distributed caching
- **Mitigation:** Application falls back to in-memory Map. Acceptable for single-instance.
- **Resolution:** Make Redis required in production for state persistence

### L-003: No Kubernetes Support
- **Impact:** Limited horizontal scaling, manual orchestration
- **Mitigation:** Docker Compose handles dev/staging. PM2 for multi-process.
- **Resolution:** Add Helm charts when scaling beyond 3-5 instances needed

### L-004: MediaMTX Single Instance
- **Impact:** Stream capacity limited to single server
- **Mitigation:** One MediaMTX per edge gateway distributes load
- **Resolution:** Add MediaMTX clustering or SFU (Janus/Pion) for 100+ streams

---

## Feature Limitations

### L-005: No Clip/Video Export
- **Impact:** Operators cannot export video segments for evidence
- **Mitigation:** Can use NVR native interface for clip export
- **Resolution:** Phase 5C.1 in implementation plan

### L-006: No On-Demand Snapshots
- **Impact:** Cannot capture live frame from web interface
- **Mitigation:** Screenshots via browser, or NVR snapshot
- **Resolution:** Phase 5C.2 in implementation plan

### L-007: No Event Correlation
- **Impact:** Related events across devices not automatically linked
- **Mitigation:** Manual incident creation linking multiple events
- **Resolution:** Phase 5C.4 in implementation plan

### L-008: No SOP Management
- **Impact:** Operating procedures not formalized in system
- **Mitigation:** SOPs documented externally (manuals, PDFs)
- **Resolution:** Phase 5C.3 in implementation plan

### L-009: No Guard Tour NFC/QR
- **Impact:** Checkpoint verification requires manual logging
- **Mitigation:** Patrol log entries created manually by guards
- **Resolution:** Mobile app with NFC/QR scanning (future)

### L-010: No Edge Recording Management
- **Impact:** Cannot configure or monitor edge-side recording
- **Mitigation:** Recording managed via NVR native interface
- **Resolution:** Add recording management to edge gateway (future)

---

## Security Limitations

### L-011: No MFA
- **Impact:** Account compromise via password alone
- **Mitigation:** Strong password policy via Supabase, audit logging detects anomalies
- **Resolution:** Phase 5B.1 in implementation plan

### L-012: No API Key Authentication
- **Impact:** Service-to-service calls require JWT (user-bound)
- **Mitigation:** Dedicated service accounts with JWT
- **Resolution:** Phase 5B.2 in implementation plan

### L-013: Plan Limits Not Enforced
- **Impact:** Tenants can exceed contracted device/user/site limits
- **Mitigation:** Admin monitoring of usage
- **Resolution:** Phase 5A.1 in implementation plan

### L-014: No Evidence Chain of Custody
- **Impact:** Evidence may not be legally admissible
- **Mitigation:** Audit log tracks user actions, incidents have timestamps
- **Resolution:** Phase 5D in implementation plan

---

## Operational Limitations

### L-015: No Grafana Dashboards
- **Impact:** Metrics collected but not visualized
- **Mitigation:** Prometheus endpoint available for manual querying
- **Resolution:** Phase 5E.1 in implementation plan

### L-016: No Distributed Tracing
- **Impact:** Cannot trace requests across services
- **Mitigation:** X-Request-ID provides basic correlation
- **Resolution:** Phase 5E.2 in implementation plan

### L-017: No Stream Quality Metrics
- **Impact:** Cannot detect degraded streams automatically
- **Mitigation:** Device health checks detect offline devices
- **Resolution:** Phase 5E.3 in implementation plan

---

## Accepted Risks

### AR-001: No CSRF Token
- **Risk:** Cross-site request forgery
- **Acceptance:** Bearer token auth (not cookie-based) is immune to CSRF. CORS blocks cross-origin form submissions.
- **Review:** If cookies are ever used for auth, add CSRF tokens

### AR-002: Supabase Auth Dependency
- **Risk:** Supabase outage blocks authentication
- **Acceptance:** Backend JWT provides fallback auth path. Supabase has 99.9% SLA.
- **Review:** If Supabase SLA is insufficient, add custom auth provider

### AR-003: `unsafe-inline` in style-src CSP
- **Risk:** CSS injection possible
- **Acceptance:** Required for inline styles from UI libraries. XSS via CSS is low-severity.
- **Review:** Migrate to nonce-based CSP when tooling supports it

---

## Post-Migration Status (2026-03-23)

### Remaining Supabase Usage (Allowed)

| File | Usage | Justification |
|------|-------|---------------|
| AuthContext.tsx | signIn, signUp, signOut, resetPassword, onAuthStateChange | Auth delegation per ADR-001 |
| api-client.ts | getSession, refreshSession | Token injection for apiClient |
| use-realtime-events.ts | Supabase Realtime channel (postgres_changes) | Real-time push until WS migration |
| I18nContext.tsx | getSession for language preference | Low-risk read-only |
| integrations/supabase/client.ts | Client initialization | Infrastructure |

### Files Still Importing Supabase (Non-data)
- ReportsPage.tsx, AIAssistantPage.tsx — `supabase.auth.getSession()` for token (same pattern as apiClient)
- BiogeneticSearchPage.tsx — `supabase.auth.getSession()` for token only
- services/integrations/ewelink.ts, voip.ts, elevenlabs.ts — `supabase.auth.getSession()` for token
- services/api.ts — Legacy file, still used by operationsApi/cloudAccountsApi/analyticsApi
- PhonePanelPage.tsx, AdminPage.tsx, LiveViewEventsPanel.tsx — import for session token

**None of these files call `supabase.from()` — they only read the session token.**

### Stub/Fiction Modules (Hidden from Navigation)

| Module | Status | Action Taken |
|--------|--------|-------------|
| PredictiveCriminologyPage | FICTION | Hidden from nav menu (ADR-009) |
| BiogeneticSearchPage | STUB | Hidden from nav menu (ADR-009) |
| Biomarkers backend | STUB | No vector distance computation — backlog item |
| Operations Dashboard | PARTIAL | Routes only, service incomplete — backlog item |

### Guardrails Active
- `src/test/no-supabase-bypass.test.ts` — CI test that fails if `supabase.from()`, `supabase.storage`, or Edge Function URLs appear in non-allowed files
