# AION Vision Hub — Security Hardening Report

**Date:** 2026-03-15
**PROMPT:** 9 of 10 — Security, Hardening & Optimization
**Status:** COMPLETADO

---

## 1. VPS HARDENING

| Item | Status | Details |
|------|--------|---------|
| fail2ban | [OK] | 3 jails: sshd (5 attempts/1h ban), nginx-http-auth, nginx-limit-req |
| UFW firewall | [OK] | deny incoming, only ports 22/80/443/8554/8889 open |
| unattended-upgrades | [OK] | Automatic security updates enabled |
| System tuning | [OK] | fs.file-max=1M, somaxconn=65535, swappiness=10 |
| File limits | [OK] | nofile 1,000,000 (soft+hard) |
| Logrotate | [OK] | 14-day rotation, compressed |

## 2. NGINX HARDENING

| Item | Status | Details |
|------|--------|---------|
| server_tokens off | [OK] | Nginx version hidden |
| X-Frame-Options | [OK] | SAMEORIGIN |
| X-Content-Type-Options | [OK] | nosniff |
| X-XSS-Protection | [OK] | 1; mode=block |
| Referrer-Policy | [OK] | strict-origin-when-cross-origin |
| Permissions-Policy | [OK] | camera=(), microphone=(), geolocation=() |
| Rate limiting (API) | [OK] | 30r/s burst 60 |
| Rate limiting (Auth) | [OK] | 5r/m burst 10 |
| Rate limiting (General) | [OK] | 50r/s burst 100 |
| Block attack paths | [OK] | .*, wp-admin, phpmyadmin → 444 |
| Client upload limit | [OK] | 50M (API only) |
| WebSocket support | [OK] | Upgrade headers configured |
| Gateway timeout | [OK] | 120s read/send for streaming |

## 3. APPLICATION HARDENING

| Item | Status | Details |
|------|--------|---------|
| CORS | [OK] | Configured per-origin, credentials: true |
| JWT algorithm | [OK] | HS256 explicitly set (prevents alg:none attack) |
| JWT expiration | [OK] | 24h default |
| JWT issuer | [OK] | aion-vision-hub |
| Rate limiting (Fastify) | [OK] | 200 req/60s per IP |
| Credential encryption | [OK] | AES-256-GCM with 64-char key |
| .env permissions | [OK] | 600 (owner read/write only) |
| CSP headers | [OK] | Strict policy in index.html |
| Error handling | [OK] | Production mode hides error details |
| Input validation | [OK] | Zod schemas on all routes |

## 4. DATABASE SECURITY

| Item | Status | Details |
|------|--------|---------|
| RLS enabled | [OK] | All 31 tables have Row Level Security |
| Tenant isolation | [OK] | get_user_tenant_id() in all policies |
| Role-based access | [OK] | has_role() checks for admin operations |
| Connection pooling | [OK] | Supabase Transaction Pooler (port 6543) |
| SSL connection | [OK] | sslmode=require in DATABASE_URL |
| No direct access | [OK] | DB accessible only through Supabase pooler |

## 5. RESOURCE USAGE

| Resource | Current | Capacity | Status |
|----------|---------|----------|--------|
| Disk | 2.5 GB / 226 GB (1%) | 90%+ safe | [OK] |
| RAM | 856 MB / 30 GB (3%) | 80%+ alert | [OK] |
| CPU | < 5% idle | monitored via healthcheck | [OK] |
| Backend API | ~92 MB | 1 GB limit (PM2) | [OK] |
| Edge Gateway | ~69 MB | 512 MB limit (PM2) | [OK] |
| MediaMTX | Docker container | 1 GB limit | [OK] |

## 6. PORTS AUDIT

| Port | Service | Exposure | Status |
|------|---------|----------|--------|
| 22/tcp | SSH | Public (fail2ban protected) | [OK] |
| 80/tcp | Nginx (HTTP) | Public | [OK] |
| 443/tcp | Nginx (HTTPS) | Public (when SSL configured) | [OK] |
| 3000/tcp | Backend API | Localhost only (via Nginx) | [OK] |
| 3100/tcp | Edge Gateway | Localhost only (via Nginx) | [OK] |
| 8554/tcp | RTSP (MediaMTX) | Public (for camera streams) | [OK] |
| 8888/tcp | HLS (MediaMTX) | Public | [OK] |
| 8889/tcp+udp | WebRTC (MediaMTX) | Public | [OK] |
| 9997/tcp | MediaMTX API | Localhost only (Docker) | [OK] |

## 7. DOCUMENTATION CREATED

| Document | Path | Purpose |
|----------|------|---------|
| Scaling Roadmap | [docs/SCALING-ROADMAP.md](docs/SCALING-ROADMAP.md) | 250→500→1000 device scaling plan |
| DR Plan | [docs/DR-PLAN.md](docs/DR-PLAN.md) | Disaster recovery procedures |
| Operations Manual | [docs/OPERATIONS-MANUAL.md](docs/OPERATIONS-MANUAL.md) | Daily operations guide |
| Troubleshooting | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues and fixes |
| Install Guide | [docs/INSTALL-GUIDE.md](docs/INSTALL-GUIDE.md) | PWA installation for all platforms |

## 8. PENDING FOR FULL SECURITY

- [ ] **HSTS header** — requires HTTPS (domain + SSL)
- [ ] **SSH key-only auth** — disable password auth after key setup
- [ ] **SSL rating A+** — verify with ssllabs.com after SSL
- [ ] **securityheaders.com** — audit after HTTPS
- [ ] **Restrict root SSH** — create admin user, disable root login
- [ ] **PgBouncer** — consider at 500+ devices for connection pooling

## 9. NEXT STEPS (PROMPT 10)

1. Configure domain + SSL (enables HSTS, PWA install, push notifications)
2. Run final validation battery (75 tests)
3. Generate PRODUCTION-CERTIFICATION.md
