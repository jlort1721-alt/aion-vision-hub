# OPEN_GAPS.md - Clave Seguridad

> Verified gaps and prerequisites as of 2026-03-23
> Classification: [FALTANTE] = requires implementation, [PRERREQUISITO] = requires external resource

---

## Infrastructure Prerequisites (External)

| # | Item | Type | Required For | Status |
|---|------|------|-------------|--------|
| 1 | TLS Certificate (Let's Encrypt or provider) | PRERREQUISITO | HTTPS in production | NGINX template ready, cert needed |
| 2 | Domain + DNS | PRERREQUISITO | TLS, public access | External |
| 3 | VPS/server with Docker | PRERREQUISITO | Deployment | External |
| 4 | GitHub Secrets configured | PRERREQUISITO | CI/CD deploy pipeline | External |
| 5 | VPN server (WireGuard/OpenVPN) | PRERREQUISITO | Secure remote access to devices | External |
| 6 | VAPID keys | PRERREQUISITO | Web Push notifications (service worker) | Can generate locally |

## Credential Prerequisites

| # | Item | How to Generate |
|---|------|----------------|
| 1 | JWT_SECRET | `openssl rand -base64 48` |
| 2 | CREDENTIAL_ENCRYPTION_KEY | `openssl rand -hex 16` |
| 3 | DB_PASSWORD | Strong random password |
| 4 | Supabase URL + anon key | From Supabase dashboard |
| 5 | SMTP/Resend credentials | From email provider |
| 6 | WhatsApp Business API | From Meta Business Platform |

## Feature Gaps

### P0 — Critical for Production

| # | Gap | Impact | Path Forward |
|---|-----|--------|-------------|
| 1 | MFA (TOTP/2FA) | Account security | Implement via Supabase MFA API, add TOTP setup UI |
| 2 | Session management | Cannot revoke compromised sessions | Add session tracking table, list/revoke UI in settings |
| 3 | TLS config active | Data in transit unencrypted | Enable TLS block in nginx.conf, provide certs |
| 3b | WebSocket backend auth update | Frontend sends auth as first message, backend still reads from query param | Update `backend/apps/backend-api/src/plugins/websocket.ts` to read token from first `{type:'auth'}` message |

### P1 — Important for Operations

| # | Gap | Impact | Path Forward |
|---|-----|--------|-------------|
| 4 | Frontend uses Supabase for integrations, MCP, AI sessions | Bypasses backend RBAC/audit | Create Fastify endpoints for these 3 resources |
| 5 | Web Push via service worker | Notifications lost when tab closed | Implement VAPID + PushManager subscription |
| 6 | Offline mutation queue | Actions lost during disconnection | Implement IndexedDB queue with sync on reconnect |
| 7 | Grafana dashboards | Metrics collected but not visualized | Create dashboard JSONs for Prometheus data |
| 8 | Distributed tracing | Cannot trace cross-service requests | Configure OTel exporter to Jaeger/Tempo |

### P2 — Enhancement

| # | Gap | Impact | Path Forward |
|---|-----|--------|-------------|
| 9 | Clip/video export | Operators can't export evidence | Add MediaMTX recording API + download endpoint |
| 10 | Event correlation engine | Related events not linked | Build correlation service with time/space clustering |
| 11 | Guard tour NFC/QR | Manual checkpoint logging | Mobile PWA + device camera for QR scanning |
| 12 | Evidence chain of custody | Legal admissibility | SHA-256 hash on evidence creation + access log |
| 13 | Device firmware tracking | No version management | Add firmware_version column tracking + dashboard |
| 14 | Tenant self-service onboarding | Admin-only signup | Public signup flow with plan selection |
| 15 | Payment integration | No billing automation | Stripe/MercadoPago integration |

### P3 — Scale/Future

| # | Gap | Impact | Path Forward |
|---|-----|--------|-------------|
| 16 | Kubernetes support | Limited horizontal scaling | Helm charts + HPA |
| 17 | Edge recording management | No local storage config | Edge gateway recording API |
| 18 | White-labeling | No tenant branding | CSS variables per tenant + logo upload |
| 19 | Native mobile apps (store) | PWA only, no app store | Capacitor wrapper for Android/iOS |
| 20 | Native desktop apps | PWA only | Tauri/Electron wrapper (optional) |

---

## Stub/Fictional Modules (Do Not Ship as Real)

| Module | Status | Action |
|--------|--------|--------|
| PredictiveCriminologyPage | FICTION — no real backend | Mark as "demo/experimental" or remove |
| BiogeneticSearchPage | PARTIAL — vector search stub | Mark as "experimental" |
| use-predictive.ts | STUB — calls non-existent endpoints | Wire to analytics/predictive or remove |

---

## Technical Debt

| # | Issue | Severity | File(s) |
|---|-------|----------|---------|
| 1 | Migrations lack DOWN/rollback | MEDIUM | migrations 013-016 |
| 2 | camelCase/snake_case mixing | MEDIUM | Zod schemas vs DB |
| 3 | No per-page error boundaries | LOW | All 46 pages |
| 4 | React Router v7 future flags | LOW | Test warnings |
| 5 | Large chunks (HLS 522KB, 3D 891KB) | LOW | Already lazy-loaded |
