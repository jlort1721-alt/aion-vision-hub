# AION Vision Hub — Deployment Guide

## Architecture Overview

```
┌─────────────┐     ┌──────────────────────────────────────────┐
│  Frontend    │     │  Backend Monorepo (pnpm + Turbo)         │
│  React/Vite  │     │  ┌──────────────┐  ┌──────────────────┐ │
│  (npm)       │     │  │ backend-api  │  │  edge-gateway    │ │
│              │     │  │ Fastify:3000 │  │  Fastify:3100    │ │
│  dist/ → CDN │     │  └──────────────┘  └──────────────────┘ │
└─────────────┘     └──────────────────────────────────────────┘
                     ┌──────────────────┐  ┌──────────────────┐
                     │ gateway (standalone)│  │ MediaMTX (RTSP) │
                     │ Fastify:3100     │  │ :8554/8888/8889  │
                     └──────────────────┘  └──────────────────┘
```

## CI/CD Pipeline

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR + push to `main` | Lint, typecheck, test, build, Docker validate |
| `deploy-staging.yml` | CI passes on `main` | Build images → push to GHCR → deploy staging |
| `deploy-production.yml` | Release published | Build images → push to GHCR → deploy production |
| `release.yml` | Manual dispatch | Validate → test → create tag → GitHub release |

### Pipeline Flow

```
PR opened → CI (lint/typecheck/test/build) → Quality Gate → PR review
    │
    ▼
Merge to main → CI → Deploy Staging → Smoke tests
    │
    ▼
Manual Release (workflow_dispatch) → Tag + GitHub Release
    │
    ▼
Release published → Deploy Production (manual approval) → Health checks
```

## Frontend Deployment

### Build

```bash
npm ci
npm run build
# Output: dist/
```

### Hosting Options

| Provider | Command / Config |
|----------|-----------------|
| **Vercel** | Connect repo, set root directory to `/` |
| **Netlify** | Build command: `npm run build`, publish dir: `dist` |
| **Cloudflare Pages** | Build command: `npm run build`, output dir: `dist` |
| **Lovable** | Click **Publish** in Lovable editor |
| **Self-hosted** | Serve `dist/` with nginx, caddy, or any static server |

### Environment Variables (Build Time)

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...your-anon-key
```

These are **public/publishable** keys — safe to embed in the frontend bundle.

## Backend Deployment

### Docker (Recommended)

```bash
cd backend

# Build all images
docker compose build

# Start all services
docker compose up -d

# Check health
curl http://localhost:3000/health
curl http://localhost:3100/health
```

### Individual Docker Images

```bash
# Backend API
docker build -f apps/backend-api/Dockerfile -t aion/backend-api .
docker run -p 3000:3000 --env-file .env aion/backend-api

# Edge Gateway
docker build -f apps/edge-gateway/Dockerfile -t aion/edge-gateway .
docker run -p 3100:3100 --env-file .env aion/edge-gateway
```

### Node.js (Without Docker)

```bash
cd backend
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @aion/backend-api start
pnpm --filter @aion/edge-gateway start
```

## Gateway Deployment (Standalone)

```bash
cd gateway
npm ci
npm run build
npm start
# or
docker build -t aion-gateway .
docker run -p 3100:3100 --env-file .env aion-gateway
```

## Database

Schema is managed via Drizzle migrations:

```bash
cd backend
pnpm db:generate   # Generate migration from schema changes
pnpm db:migrate    # Apply pending migrations
```

Supabase migrations live in `supabase/migrations/`.

## Environment Strategy

| Environment | Branch/Trigger | URL | Purpose |
|-------------|---------------|-----|---------|
| **Development** | Local | `localhost:*` | Developer workstation |
| **Staging** | `main` branch | Configured in GitHub env | Integration testing, QA |
| **Production** | Release tag | Configured in GitHub env | Live users |

### GitHub Environment Setup

1. Go to **Settings → Environments**
2. Create `staging` and `production` environments
3. For `production`: add **required reviewers** and **deployment branch policy** (tags only)
4. Set environment variables:
   - `STAGING_URL` / `PRODUCTION_URL`
   - `STAGING_API_URL` / `PRODUCTION_API_URL`
   - `STAGING_GATEWAY_URL` / `PRODUCTION_GATEWAY_URL`

## Rollback

### Docker-Based Rollback

```bash
# 1. Identify the previous working tag
docker images ghcr.io/your-org/aion/backend-api --format "{{.Tag}}"

# 2. Roll back to previous version
docker compose down
export IMAGE_TAG=v1.2.3   # Previous working version
docker compose up -d

# 3. Verify health
curl http://localhost:3000/health
```

### GHCR Image Rollback

```bash
# Pull specific version
docker pull ghcr.io/your-org/aion/backend-api:1.2.3
docker pull ghcr.io/your-org/aion/edge-gateway:1.2.3

# Redeploy with pinned version
docker compose up -d
```

### Frontend Rollback

For SPA hosts (Vercel, Netlify), use their built-in rollback:
- **Vercel**: Deployments → select previous → Promote to Production
- **Netlify**: Deploys → select previous → Publish deploy

### Database Rollback

```bash
# Check migration status
cd backend
pnpm drizzle-kit status

# Manually revert specific migration if needed
# (Drizzle doesn't have auto-rollback — prepare DOWN migrations for critical changes)
```

## Monitoring

- Container health checks: built into Docker Compose and Dockerfiles
- Application logs: Pino JSON logs → forward to your log aggregator
- Suggested stack: Grafana + Loki (logs) + Prometheus (metrics)

## PWA Support

The frontend builds as a PWA with:
- Offline-capable shell (Workbox)
- Install prompt on compatible browsers
- Custom icons and splash screens
- Configured in `vite.config.ts` via `vite-plugin-pwa`
