# SECURITY_HARDENING.md - Clave Seguridad

> Security posture assessment and hardening plan
> Generated: 2026-03-23

---

## Current Security Posture

### Strengths (What's Working Well)

| Control | Implementation | Evidence |
|---------|---------------|----------|
| JWT Algorithm Pinning | HS256 explicit, prevents 'alg:none' | `app.ts` line 124-128 |
| Issuer Validation | `aion-vision-hub` issuer checked | `app.ts` JWT config |
| Refresh Token Rotation | Family-based with reuse detection | `token-refresh.test.ts` |
| Credential Encryption | AES-256-GCM with random IV | `common-utils/crypto.ts` |
| Webhook HMAC | SHA256 with timing-safe comparison | `whatsapp/webhook.test.ts` |
| Tenant Isolation | Plugin-level tenantId injection | `plugins/tenant.ts` |
| Audit Logging | All mutations logged with IP/UA | `plugins/audit.ts` |
| Error Sanitization | No stack traces in production | `middleware/error-handler.ts` |
| CSP Headers | Strict Content-Security-Policy | Helmet config + index.html |
| HSTS | 1 year, includeSubDomains | Helmet config |
| Rate Limiting | 100/min per tenant:IP | `middleware/rate-limiter.ts` |
| Input Validation | Zod schemas on all endpoints | Schema files per module |
| Request IDs | UUID per request | `middleware/request-id.ts` |
| RBAC | 5 roles, frontend + backend | `permissions.ts` + `requireRole()` |

### Weaknesses (What Needs Fixing)

| Risk | Severity | Current State | Recommended Fix |
|------|----------|---------------|-----------------|
| No MFA | HIGH | Single-factor auth only | Add TOTP via Supabase MFA |
| No API keys | MEDIUM | Only JWT auth supported | Add API key management |
| No per-endpoint rate limiting | MEDIUM | Global 100/min for all routes | Stricter limits on auth endpoints |
| No plan limit enforcement | MEDIUM | Tenants can exceed quotas | Add middleware checks |
| No rate limit headers | LOW | Missing X-RateLimit-* | Add headers for client feedback |
| No CORS wildcard validation | LOW | No check for `*` in config | Add Zod refinement |
| Request ID not in error logs | LOW | UUID generated but not logged on errors | Add to error handler |
| No concurrent session limits | LOW | Unlimited sessions per user | Add session tracking |
| No CSRF protection | INFO | Acceptable with Bearer tokens | Document as accepted risk |
| No password policy enforcement | INFO | Handled by Supabase | Document delegation |

---

## Hardening Checklist

### Authentication
- [x] JWT algorithm explicitly set (HS256)
- [x] JWT issuer validated
- [x] Token expiration enforced (24h access, 30d refresh)
- [x] Refresh token rotation with reuse detection
- [ ] MFA (TOTP) support
- [ ] API key authentication
- [ ] Session tracking and revocation
- [ ] Concurrent session limits
- [x] Demo login removed (DELIVERY_LOG.md confirms)

### Authorization
- [x] Role-based access control (5 roles)
- [x] Frontend ModuleGuard on routes
- [x] Backend requireRole() preHandler
- [x] Tenant isolation on all queries
- [ ] Plan limit enforcement
- [ ] Attribute-based access control (future)

### Transport Security
- [x] HTTPS/TLS via NGINX
- [x] HSTS header (1 year)
- [x] Strict CSP (no unsafe-eval)
- [x] X-Frame-Options: DENY
- [x] X-Content-Type-Options: nosniff
- [ ] Certificate pinning (future, mobile)

### Data Protection
- [x] Credential encryption (AES-256-GCM)
- [x] Environment variable validation (Zod)
- [x] No secrets in codebase
- [x] JWT_SECRET min 32 chars enforced
- [x] CREDENTIAL_ENCRYPTION_KEY required in production
- [ ] Database encryption at rest (PostgreSQL TDE)
- [ ] Evidence cryptographic sealing

### Input Validation
- [x] Zod schemas on all API endpoints
- [x] Type-safe query building (Drizzle ORM)
- [x] File upload size limit (15MB)
- [ ] File type validation on uploads
- [ ] Content scanning for uploads

### Rate Limiting
- [x] Global rate limiting (100/min per tenant:IP)
- [ ] Auth endpoint rate limiting (10/min)
- [ ] Webhook endpoint rate limiting
- [ ] Rate limit response headers

### Monitoring & Audit
- [x] Audit logging on all mutations
- [x] IP and User-Agent tracking
- [x] Prometheus metrics
- [x] Health/readiness probes
- [ ] Security event alerting
- [ ] Failed login attempt tracking
- [ ] Brute force detection

### Webhook Security
- [x] HMAC-SHA256 signature verification
- [x] Timing-safe comparison
- [x] Payload structure validation
- [ ] Replay protection (timestamp-based)
- [ ] IP allowlist for webhook sources

### Dependency Management
- [x] Dependabot configured (weekly)
- [x] Lock files committed (pnpm-lock.yaml)
- [ ] npm audit in CI pipeline
- [ ] License compliance check
- [ ] SBOM generation

---

## OWASP Top 10 Assessment

| # | Risk | Status | Notes |
|---|------|--------|-------|
| A01 | Broken Access Control | MITIGATED | RBAC + tenant isolation + audit |
| A02 | Cryptographic Failures | MITIGATED | AES-256-GCM, TLS, HSTS |
| A03 | Injection | MITIGATED | Drizzle ORM parameterized queries, Zod validation |
| A04 | Insecure Design | PARTIAL | No threat model document, but defense-in-depth |
| A05 | Security Misconfiguration | PARTIAL | Helmet defaults good, no security scan in CI |
| A06 | Vulnerable Components | MITIGATED | Dependabot, npm audit recommended |
| A07 | Auth Failures | PARTIAL | No MFA, no brute force detection |
| A08 | Data Integrity Failures | PARTIAL | No evidence sealing, no SBOM |
| A09 | Logging & Monitoring | PARTIAL | Audit logs exist, no security alerting |
| A10 | SSRF | LOW RISK | Backend validates URLs through adapters, no arbitrary URL fetch |

---

## Priority Actions

1. **Add auth rate limiting** (10/min on `/auth/login`) - Quick win, high impact
2. **Add plan limit enforcement** - Prevents resource abuse
3. **Add MFA support** - Enterprise requirement
4. **Add npm audit to CI** - Automated vulnerability detection
5. **Add failed login tracking** - Brute force detection foundation
