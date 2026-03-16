# Staging Environment Readiness — AION Vision Hub

> **Updated:** 2026-03-08 (CI/CD pipeline integration)

---

## CI/CD Pipeline Integration

Staging deploys are automated via `.github/workflows/deploy-staging.yml`:

```text
Merge to main → CI passes → Docker images pushed to GHCR → Deploy to staging → Smoke tests
```

### Automated Gates (enforced by CI)

All of these must pass before code reaches staging:

- [ ] **Frontend**: lint → typecheck → test → build
- [ ] **Backend**: lint → typecheck → test → build (via Turbo)
- [ ] **Gateway**: lint → typecheck → test → build
- [ ] **Docker images**: backend-api, edge-gateway, gateway build successfully
- [ ] **Quality Gate**: all jobs green

---

## Infrastructure Requirements

| Component | Setup |
|---|---|
| Supabase | Dedicated staging project |
| MediaMTX | Staging instance (VM/container) |
| Gateway | Docker container or VM |
| Frontend | Vercel/Netlify preview or CDN |
| Container Registry | GHCR (auto-configured via GitHub Actions) |

## GitHub Environment Setup

1. Create environment `staging` in **Settings → Environments**
2. Set environment variables:
   - `STAGING_URL` — staging frontend URL
   - `STAGING_API_URL` — staging backend API URL
   - `STAGING_GATEWAY_URL` — staging gateway URL
3. Set repository secrets:
   - `STAGING_SUPABASE_URL` — Supabase project URL
   - `STAGING_SUPABASE_ANON_KEY` — Supabase anon/publishable key
4. Configure deploy target in `deploy-staging.yml` (SSH, Vercel, Cloud Run, etc.)

## Deployment Checklist

### Database
- [ ] Supabase staging project created
- [ ] All migrations applied
- [ ] RLS policies verified on all tenant-scoped tables
- [ ] Test data seeded (tenant, users, devices, events)

### Edge Functions
- [ ] All edge functions deployed
- [ ] Staging secrets configured via `supabase secrets set`

### Frontend
- [ ] Build succeeds with staging env vars (`npm run build`)
- [ ] PWA manifest serves correctly
- [ ] Service worker registers in production build
- [ ] All tests pass (`npm test`)

### Backend
- [ ] Backend API builds and passes all tests (`pnpm build && pnpm test`)
- [ ] Docker image builds successfully
- [ ] `/health` returns 200 on staging

### Gateway
- [ ] Gateway builds (`npm run build`)
- [ ] Gateway starts without errors
- [ ] `/health` returns 200
- [ ] `/health/ready` returns 200

### Integration
- [ ] JWT auth flow works end-to-end
- [ ] CORS configured for staging domain
- [ ] `testConnection()` passes for configured services
- [ ] WebSocket connections establish successfully

## Post-Deploy Validation

After every staging deploy:

- [ ] Health check endpoints return 200
- [ ] Frontend loads without console errors
- [ ] Authentication flow works (login → dashboard)
- [ ] API response times < 500ms for standard queries
- [ ] No new errors in application logs

## Not Required for Staging

- Real camera hardware (use mock devices)
- Production SSL certificates (platform-provided)
- Production domain names (use preview URLs)
- Full external credentials (test individually)

## Promotion to Production

Code is ready for production release when:
1. All automated CI gates pass
2. Staging deploy is healthy for at least 24 hours
3. No P0/P1 bugs found during staging validation
4. Product owner approves the feature set
5. Release created via `release.yml` workflow
