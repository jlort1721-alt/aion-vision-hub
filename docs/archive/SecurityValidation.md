# Security Validation Report -- eWeLink Integration

**Date:** 2026-03-08 (Post-hardening v3.0)
**Scope:** eWeLink/Sonoff integration credential isolation and backend-first architecture

---

## Threat Model

| Threat | Severity | Mitigation |
|---|---|---|
| App Secret exposed in browser | CRITICAL | Moved to backend/.env only; not in any VITE_ var |
| User tokens accessible via DevTools | CRITICAL | Tokens never sent to frontend; backend-only |
| Tokens stored unencrypted in DB | HIGH | AES-256-GCM encryption via CREDENTIAL_ENCRYPTION_KEY |
| Cross-tenant token access | HIGH | Per-tenant isolation in memory + DB queries scoped by tenantId |
| Token theft via log files | MEDIUM | All logs sanitized; tokens never logged; emails masked |
| Replay of eWeLink API requests | MEDIUM | HMAC-SHA256 signing; TLS transport |
| Brute force on login endpoint | MEDIUM | Rate limiting (100 req/60s per tenant+IP); RBAC requires operator+ |

---

## Before vs After

| Aspect | Before | After |
|---|---|---|
| App ID/Secret location | Frontend `.env` (VITE_EWELINK_*) | Backend `.env` only |
| Token storage | In-memory only; lost on restart | Encrypted in DB + memory cache |
| Token encryption | None | AES-256-GCM (CREDENTIAL_ENCRYPTION_KEY) |
| Frontend credential access | Could read tokens via getTokens() | No token methods exist in frontend |
| Log sanitization | Emails logged in plaintext | Emails masked (j***@domain.com) |
| API calls | Some direct from frontend | All proxied through backend |
| Retry logic | None | Exponential backoff with jitter |
| Health check | Basic connectivity | Full pipeline + encryption status |
| Token refresh | Manual | Automatic with encrypted persistence |

---

## Test Evidence

**56 tests passing across 3 test files:**

### routes.test.ts (15 tests)
- Health endpoint returns encryption status
- Test-connection endpoint verifies full pipeline
- Status endpoint returns auth state without tokens
- Login rejects invalid email/password format (Zod validation)
- Login response does not contain accessToken, refreshToken, or APP_SECRET
- Logout clears session
- Device operations return expected shapes
- Batch control validates input constraints

### service.test.ts (17 tests)
- HMAC-SHA256 signing on login and refresh requests
- Email masking in responses (l***@domain.com)
- Tokens never appear in login response payload
- Token refresh uses HMAC signing
- Failed refresh clears session entirely
- Logout clears both memory and DB state
- Device listing filters by itemType (excludes scenes)
- Toggle resolution queries current state first
- Health check reports encryptionEnabled
- Connection failure handled gracefully

### security.test.ts (24 tests)
- Frontend `.env.example` does not define VITE_EWELINK_APP_ID
- Frontend `.env.example` does not define VITE_EWELINK_APP_SECRET
- Frontend `.env.example` does not define VITE_EWELINK_REGION
- Frontend service does not read any VITE_EWELINK_* env vars
- Frontend service does not store or expose tokens
- Frontend service has no restoreTokens/getTokens methods
- Frontend service does not export EWeLinkConfig with credential fields
- Frontend service only calls backend proxy endpoints (no coolkit.cc URLs)
- Frontend hooks do not import EWeLinkTokens
- Frontend hooks do not call restoreTokens/getTokens/ensureValidToken
- Frontend hooks do not persist tokens to Supabase
- Backend service encrypts tokens before DB persistence
- Backend service decrypts tokens when loading from DB
- Backend service masks emails in logs
- Backend service never logs raw tokens
- Backend service uses HMAC-SHA256 for request signing
- Backend service uses retry logic for API calls

---

## OWASP Compliance (eWeLink Integration)

| OWASP Category | Status | Notes |
|---|---|---|
| A01: Broken Access Control | PASS | RBAC enforced on all endpoints; per-tenant isolation |
| A02: Cryptographic Failures | PASS | AES-256-GCM for tokens at rest; HMAC-SHA256 for API signing |
| A03: Injection | PASS | Zod schema validation on all inputs |
| A04: Insecure Design | PASS | Backend-first proxy; no secrets in frontend |
| A05: Security Misconfiguration | PASS | CREDENTIAL_ENCRYPTION_KEY required in production |
| A07: Auth Failures | PASS | Token auto-refresh; session cleanup on failure |
| A09: Logging Failures | PASS | Sanitized logging; audit trail on all mutations |
