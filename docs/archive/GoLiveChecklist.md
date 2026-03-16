# AION Vision Hub — Go-Live Checklist

> One-time checklist for the initial production launch.
> Complete all items before opening the system to real users.

---

## Phase 1: Infrastructure (T-14 days)

### Compute & Networking

- [ ] Production server(s) provisioned (VPS, cloud VM, or container platform)
- [ ] Firewall rules configured:
  - Port 443 (HTTPS) — open to internet
  - Port 3000 (API) — internal or load-balanced
  - Port 3100 (Gateway) — internal or site-specific
  - Port 5432 (PostgreSQL) — internal only
  - Ports 8554/8888/8889 (MediaMTX) — internal or site-specific
- [ ] Load balancer / reverse proxy configured (nginx, Caddy, or cloud LB)
- [ ] TLS certificates provisioned and auto-renewal configured
- [ ] DNS records created (A/CNAME for frontend, API, and gateway subdomains)

### Database

- [ ] PostgreSQL 16+ deployed with production configuration
- [ ] Connection pooling configured (PgBouncer or Supabase pooler)
- [ ] Automated backups enabled (daily, 30-day retention minimum)
- [ ] Point-in-time recovery tested
- [ ] Database credentials rotated from any development values
- [ ] All migrations applied and verified

### Container Registry

- [ ] GHCR (GitHub Container Registry) enabled for the repository
- [ ] Or alternative registry configured (Docker Hub, ECR, GCR)
- [ ] Image pull credentials configured on deploy targets

---

## Phase 2: Application Configuration (T-7 days)

### Secrets & Credentials

- [ ] All required secrets set (see [CredentialsChecklist.md](./CredentialsChecklist.md))
- [ ] `JWT_SECRET` — unique, 64+ character random string
- [ ] `CREDENTIAL_ENCRYPTION_KEY` — 32-character hex key (`openssl rand -hex 16`)
- [ ] `DATABASE_URL` — production PostgreSQL connection string
- [ ] Supabase production project configured
- [ ] No development/staging secrets reused in production

### GitHub Environments

- [ ] `staging` environment created in repo settings
- [ ] `production` environment created with:
  - Required reviewers (min 1)
  - Deployment branch policy: tags only
  - Wait timer: 5 minutes (optional, for extra safety)
- [ ] Environment variables configured (URLs, non-secret config)
- [ ] Repository secrets configured (API keys, credentials)

### Application Settings

- [ ] `NODE_ENV=production` in all backend services
- [ ] `CORS_ORIGINS` restricted to production domains only
- [ ] Rate limiting configured appropriately for expected traffic
- [ ] Log level set to `info` (not `debug`)
- [ ] MediaMTX configured with production RTSP settings

---

## Phase 3: Security Review (T-5 days)

- [ ] `npm audit` / `pnpm audit` — no critical vulnerabilities
- [ ] Container images scanned (Trivy, Snyk, or GHCR built-in scanning)
- [ ] RLS (Row Level Security) policies verified in Supabase
- [ ] RBAC roles and permissions tested
- [ ] Authentication flow tested end-to-end
- [ ] API endpoints tested for authorization (no unauth access to protected routes)
- [ ] OWASP Top 10 review completed
- [ ] Secrets are not logged or exposed in error messages

---

## Phase 4: Testing (T-3 days)

### Functional Testing

- [ ] All CI tests passing on main
- [ ] Manual smoke test on staging:
  - [ ] Login / logout / session refresh
  - [ ] Dashboard loads with correct data
  - [ ] Device discovery finds test devices
  - [ ] Live view displays camera feed
  - [ ] Events are created and listed
  - [ ] Incident management workflow works
  - [ ] Map view renders correctly
  - [ ] User settings persist
  - [ ] PWA install prompt works

### Integration Testing

- [ ] Frontend to Backend API communication verified
- [ ] Backend API to Database queries work correctly
- [ ] Gateway to Device communication tested with real hardware
- [ ] WebSocket connections stable under load
- [ ] MediaMTX RTSP/WebRTC relay functional

### Performance Testing

- [ ] API response times acceptable (p95 < 500ms for standard queries)
- [ ] Frontend initial load time < 3s on 4G connection
- [ ] WebSocket reconnection works after network interruption
- [ ] Concurrent user load tested (target: 50+ simultaneous users)

---

## Phase 5: Observability (T-2 days)

- [ ] Log aggregation configured and receiving logs
- [ ] Uptime monitoring configured for:
  - [ ] Frontend URL
  - [ ] Backend API `/health`
  - [ ] Gateway `/health`
- [ ] Alerting configured for:
  - [ ] Service down (health check fails for > 2 min)
  - [ ] High error rate (5xx > 1% of requests)
  - [ ] Database connection failures
  - [ ] Certificate expiration (< 14 days)
- [ ] Dashboard created for key metrics (optional but recommended)

---

## Phase 6: Operations (T-1 day)

- [ ] Rollback procedure tested (deploy previous version, verify health)
- [ ] On-call rotation defined and communicated
- [ ] Incident response runbook available
- [ ] Team has access to:
  - [ ] Production logs
  - [ ] GitHub Actions (deploy/release)
  - [ ] Container runtime (Docker / orchestrator)
  - [ ] Database admin tool
- [ ] Communication channel for production incidents established

---

## Phase 7: Launch (T-0)

- [ ] Final staging validation pass
- [ ] Release created via GitHub Actions `release.yml` workflow
- [ ] Production deploy approved and executed via `deploy-production.yml`
- [ ] Post-deploy health checks pass
- [ ] Frontend accessible at production URL
- [ ] First login successful
- [ ] Real device connected and streaming
- [ ] Monitoring confirms all services healthy
- [ ] Launch announcement sent to stakeholders

---

## Post-Launch (T+1 to T+7)

- [ ] Monitor error rates and performance daily
- [ ] Review application logs for unexpected errors
- [ ] Collect user feedback
- [ ] Address any P0/P1 issues immediately via hotfix process
- [ ] Schedule retrospective for the launch process
- [ ] Update documentation with any learnings

---

---

## Phase 8: VoIP / Intercom / PBX Hardening (T-3 days)

### Credentials & Defaults

- [ ] All Fanvil devices: factory password `admin/admin` changed to strong unique value
- [ ] `FANVIL_ADMIN_USER` / `FANVIL_ADMIN_PASSWORD` set in backend `.env` (no defaults in code)
- [ ] `SIP_ARI_USERNAME` is not `admin` or `asterisk`
- [ ] `SIP_ARI_PASSWORD` is strong (min 16 chars, not a dictionary word)
- [ ] `SIP_ARI_URL` does NOT contain embedded credentials (use `SIP_ARI_USERNAME`/`SIP_ARI_PASSWORD` instead)
- [ ] Per-device `adminUser`/`adminPassword` in device config JSONB are set (not relying on env fallback)

### Network Segmentation

- [ ] Intercom devices on dedicated VLAN (e.g., VLAN 10)
- [ ] PBX (Asterisk) on management VLAN or same VLAN as intercoms
- [ ] Backend API can reach PBX on ARI port (default 8088) — no public exposure
- [ ] Backend API can reach intercom devices on HTTP port (80)
- [ ] Firewall blocks intercom VLAN from internet access
- [ ] Firewall blocks intercom VLAN from other internal VLANs
- [ ] SIP ports (5060-5061) open only between PBX and intercom VLAN
- [ ] RTP port range (10000-20000) open only between PBX and intercom VLAN
- [ ] PBX web UI restricted to admin VLAN
- [ ] Fanvil device web UIs restricted to admin VLAN

### PBX (Asterisk) Hardening

- [ ] ARI enabled with dedicated non-default user
- [ ] ARI bound to internal interface only (not `0.0.0.0`)
- [ ] AMI disabled or bound to localhost
- [ ] `allowguest=no` in pjsip.conf
- [ ] Dialplan restricts external dialing (no toll fraud)
- [ ] Fail2ban configured for SIP brute-force protection
- [ ] PBX logs do not contain SIP passwords

### Fanvil Device Hardening (Per Device)

- [ ] Factory default password changed
- [ ] Auto-provisioning disabled after initial setup
- [ ] DHCP Option 66 removed or pointed to trusted server only
- [ ] SIP TLS enabled (if PBX supports it)
- [ ] SRTP enabled (if PBX supports it)
- [ ] Relay hold time configured (`P3292`, typically 3-5s)
- [ ] Firmware updated to latest stable
- [ ] Unused SIP lines disabled
- [ ] SNMP/Telnet/SSH disabled

### Application Verification

- [ ] `GET /intercom/voip/config` does NOT return `ariPassword` or `fanvilAdminPassword`
- [ ] `GET /intercom/voip/health` does NOT expose PBX internal IP
- [ ] Backend logs contain no passwords (grep for `password`, `secret`, `admin`)
- [ ] Rate limits active on `POST /door/open` (10/tenant/min, 5/device/min)
- [ ] Rate limits active on `POST /devices/provision` (5/tenant/min)
- [ ] Structured audit log entries emitted for door open, provision, config update

---

## Sign-Off

| Role | Name | Date | Go / No-Go |
|------|------|------|------------|
| Tech Lead | | | |
| DevOps Engineer | | | |
| QA Lead | | | |
| Security | | | |
| Product Owner | | | |

---

## Final Closure Audit Notes (2026-03-08)

### Additional Pre-Launch Verification Items

Based on the final independent audit, add these items to the security review (Phase 3):

- [ ] Verify `POST /auth/refresh` endpoint is either disabled or has refresh token validation implemented
- [ ] Verify no `VITE_ELEVENLABS_API_KEY` or `VITE_WHATSAPP_ACCESS_TOKEN` values are set in production frontend env
- [ ] Verify `dist/` JS bundles contain no API keys (run: `grep -r "sk-\|re_\|SG\." dist/assets/*.js`)
- [ ] Verify `WHATSAPP_APP_SECRET` is set and min 32 chars in production backend env
- [ ] Verify `CREDENTIAL_ENCRYPTION_KEY` is set and min 32 chars in production backend env
- [ ] Verify `FANVIL_ADMIN_USER`/`FANVIL_ADMIN_PASSWORD` are NOT `admin/admin`

### Cross-Reference Documents

- Detailed module-by-module assessment: [FinalClosureReport.md](./FinalClosureReport.md)
- Residual risk register: [ResidualRiskRegister.md](./ResidualRiskRegister.md)
- Complete gap analysis: [FinalGapClosureReport.md](./FinalGapClosureReport.md)
- Release readiness: [ReleaseReadiness.md](./ReleaseReadiness.md)
