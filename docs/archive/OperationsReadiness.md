# AION Vision Hub — Operations Readiness

## Last Updated: 2026-03-08

---

## Deployment Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend (SPA)    │────▶│  Supabase Cloud   │────▶│  PostgreSQL DB  │
│  Lovable / Vercel   │     │  Edge Functions    │     │  (with RLS)     │
│  Static hosting     │     │  Auth / Realtime   │     │                 │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
         │                                                     │
         │                  ┌──────────────────┐              │
         └────────────────▶│  AION Gateway     │──────────────┘
                           │  (On-premise)     │
                           │  Docker / Node    │
                           └───────┬──────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │Hikvision │  │  Dahua   │  │  ONVIF   │
              │ Cameras  │  │ Cameras  │  │ Generic  │
              └──────────┘  └──────────┘  └──────────┘
```

---

## Component Readiness

| Component | Status | Hosting | Notes |
|-----------|--------|---------|-------|
| Frontend SPA | Ready | Lovable / Vercel / S3+CloudFront | Static build, 1.9MB bundle |
| Supabase Project | Ready | Supabase Cloud | Auth, DB, Realtime, Edge Functions |
| Edge Functions (11) | Ready | Supabase Edge (Deno Deploy) | Auto-scaled, globally distributed |
| AION Gateway | Code Ready | Docker on-premise | Needs deployment + MediaMTX |
| MediaMTX | Architecture Ready | Docker on-premise | RTSP→WebRTC proxy |
| Database | Ready | Supabase (PostgreSQL 15) | 25+ tables, RLS enabled |

---

## Pre-Deployment Checklist

### Infrastructure
- [ ] Provision Supabase production project
- [ ] Configure custom domain for frontend
- [ ] Set up CDN for static assets
- [ ] Deploy gateway Docker container on-premise
- [ ] Configure MediaMTX for RTSP→WebRTC
- [ ] Set up monitoring (uptime, error rates)

### Database
- [x] Schema migrated (25+ tables)
- [x] RLS enabled on all tables
- [x] Security definer functions created
- [ ] Seed production data (tenants, admin users, sections)
- [ ] Configure connection pooling (PgBouncer)
- [ ] Set up database backups (automated daily)
- [ ] Add composite indexes for performance

### Authentication
- [x] Email/password auth configured
- [x] Password reset flow working
- [x] JWT verification on all edge functions
- [ ] Configure MFA for admin roles
- [ ] Set session timeout (recommended: 8h for operators)
- [ ] Configure email templates (invite, reset)

### Edge Functions
- [x] All 11 functions hardened (auth + validation + audit)
- [ ] Configure rate limiting per function
- [ ] Set up error alerting (Supabase logs → webhook)
- [ ] Configure secrets in production dashboard

### Secrets Configuration

Configure in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
LOVABLE_API_KEY=your-lovable-key
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Monitoring & Observability

### Current Capabilities
- **Audit logs**: All mutations logged with user, action, entity, before/after state
- **Health API**: 8-component health check (database, auth, devices, events, incidents, integrations, MCP, AI)
- **Edge Function logs**: Available in Supabase Dashboard
- **Supabase Realtime**: Built-in connection monitoring

### Recommended Additions
1. **Uptime monitoring**: Pingdom/UptimeRobot on `/health` endpoint
2. **Error tracking**: Sentry for frontend errors
3. **APM**: Supabase Observability for query performance
4. **Alerting**: Webhook from health-api degradation → email/Slack/WhatsApp
5. **Log aggregation**: Stream Supabase logs to Datadog/Grafana Cloud

---

## Backup & Recovery

### Database Backups
- **Supabase automatic**: Daily backups (Pro plan), point-in-time recovery
- **Recommended**: Weekly logical dump (`pg_dump`) to separate storage
- **RTO target**: < 1 hour
- **RPO target**: < 24 hours (with daily backups), < 1 hour (with PITR)

### Configuration Backups
- Edge function code: Version controlled in git
- Database migrations: Version controlled in `supabase/migrations/`
- Secrets: Documented in SecretsAndEnv.md (values in secure vault)

### Disaster Recovery
1. Restore database from Supabase backup
2. Redeploy edge functions from git
3. Reconfigure secrets in dashboard
4. Verify with health-api endpoint
5. Seed initial admin user if needed

---

## Operational Procedures

### User Onboarding
1. Super admin creates tenant via Supabase Dashboard
2. Super admin invites tenant_admin via Admin module
3. Tenant admin configures sections, devices, and users
4. Operators receive invite email with activation link

### Incident Response
1. Critical event triggers alert (event-alerts edge function)
2. Operator sees real-time notification in Live View
3. Operator acknowledges and creates incident
4. Incident tracked through resolution with comments
5. Full audit trail in audit_logs

### Maintenance Windows
1. Announce via in-app notification (future)
2. Edge functions: zero-downtime deploy (Supabase handles)
3. Database migrations: run via Supabase CLI (`supabase db push`)
4. Gateway: rolling restart via Docker Compose

---

## SLA Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Uptime | 99.9% | Supabase SLA on Pro plan |
| API response time | < 500ms (p95) | Edge function warm response |
| Frontend load time | < 3s | With code splitting |
| Real-time event delivery | < 2s | Supabase Realtime WebSocket |
| Gateway stream start | < 5s | RTSP→WebRTC via MediaMTX |

---

## Team Requirements

| Role | Count | Responsibility |
|------|-------|---------------|
| DevOps | 1 | Infrastructure, Docker, monitoring |
| Backend Dev | 1 | Edge functions, gateway, integrations |
| Frontend Dev | 1 | UI features, performance optimization |
| DBA | 0.5 | Schema evolution, query optimization |
| QA | 0.5 | Test automation, regression testing |

---

## Overall Readiness: READY (with external dependencies)

**Deployment-ready**: Frontend, database, edge functions, authentication, RBAC, audit logging.

**Requires setup**: Gateway deployment, MediaMTX configuration, production secrets, monitoring infrastructure.

**Post-launch**: MFA, rate limiting, code splitting, accessibility improvements.
