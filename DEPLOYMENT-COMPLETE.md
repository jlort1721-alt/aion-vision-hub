# AION Vision Hub — Deployment Report

**Date:** 2026-03-15
**PROMPT:** 4 of 10 — Build & Deploy
**Status:** COMPLETADO

---

## 1. FRONTEND BUILD

| Item | Value |
|------|-------|
| Command | `npm run build` |
| Bundle size | 2.5 MB (total dist/) |
| Modules | 3,477 transformed |
| PWA | sw.js + workbox generated (136 precache entries) |
| manifest.webmanifest | Present |
| Icons | 10 PWA icons generated (72px → 512px) |
| Build time | 5.47s |

### Largest Chunks
| Chunk | Size | Gzip |
|-------|------|------|
| PieChart (recharts) | 400 KB | 108 KB |
| xlsx | 284 KB | 95 KB |
| SitesPage (leaflet) | 197 KB | 56 KB |
| vendor-supabase | 172 KB | 46 KB |
| vendor-react | 161 KB | 52 KB |
| vendor-ui (radix) | 151 KB | 48 KB |

## 2. BACKEND BUILD

| Package | Status |
|---------|--------|
| @aion/shared-contracts | [OK] Built |
| @aion/common-utils | [OK] Built |
| @aion/device-adapters | [OK] Built |
| @aion/backend-api | [OK] Built |
| @aion/edge-gateway | [OK] Built |

### Fixes Applied
- **Fastify 5 logger compatibility**: `createLoggerConfig()` added to pass pino config object instead of Logger instance (Fastify 5.8.2 breaking change)
- **WHATSAPP_APP_SECRET**: Changed from required in production to optional (not all deployments use WhatsApp)

## 3. DEPLOYMENT ARCHITECTURE

```
                    ┌─────────────────────────────┐
                    │     Nginx (port 80/443)      │
                    │   http://204.168.153.166     │
                    └──────┬──────┬──────┬─────────┘
                           │      │      │
                    /      │ /api/ │ /gw/ │
                    │      │      │      │
               ┌────┘  ┌───┘  ┌───┘
               ▼       ▼      ▼
          ┌────────┐ ┌──────┐ ┌──────────┐
          │Frontend│ │API   │ │Gateway   │
          │dist/   │ │:3000 │ │:3100     │
          │(static)│ │(PM2) │ │(PM2)     │
          └────────┘ └──┬───┘ └────┬─────┘
                        │          │
                   ┌────┘     ┌────┘
                   ▼          ▼
              ┌────────┐  ┌──────────┐
              │Supabase│  │MediaMTX  │
              │(Cloud) │  │(Docker)  │
              │:6543   │  │:8554/8889│
              └────────┘  └──────────┘
```

## 4. SERVICES RUNNING

| Service | Process | Port | Status | Memory |
|---------|---------|------|--------|--------|
| Backend API | PM2 (fork) | 3000 | online | ~92 MB |
| Edge Gateway | PM2 (fork) | 3100 | online | ~69 MB |
| MediaMTX | Docker | 8554/8889/9997 | Up | container |
| Nginx | systemd | 80 | active | system |
| PM2 | daemon | — | saved + startup | system |

### PM2 Auto-restart
- `pm2 save` — process list saved
- `pm2 startup systemd` — auto-start on reboot

## 5. ENVIRONMENT

| File | Location on VPS | Permissions |
|------|-----------------|-------------|
| Frontend .env | Built into dist/ (VITE_* vars) | — |
| Backend .env | /opt/aion/app/backend/.env | 600 |
| PM2 ecosystem | /opt/aion/app/backend/ecosystem.config.cjs | 644 |

### Production ENV Settings
- `NODE_ENV=production`
- `DATABASE_URL` → Supabase Transaction Pooler (Oregon)
- `CORS_ORIGINS` includes `http://204.168.153.166`
- `GATEWAY_ID=gw-prod-01`
- `CREDENTIAL_ENCRYPTION_KEY` → 64-char hex (AES-256-GCM)
- `JWT_SECRET` → 64-char hex (shared backend + gateway)

## 6. HEALTH ENDPOINTS VERIFIED

| Endpoint | Response | Status |
|----------|----------|--------|
| `http://204.168.153.166/` | HTML (AION Vision Hub app) | [OK] |
| `http://204.168.153.166/api/health` | `{"status":"healthy","version":"1.0.0"}` | [OK] |
| `http://204.168.153.166/gw/health` | `{"status":"healthy","gatewayId":"gw-prod-01"}` | [OK] |
| `http://localhost:9997` (MediaMTX API) | Running (internal only) | [OK] |

## 7. CRON JOBS

| Schedule | Script | Purpose |
|----------|--------|---------|
| Daily 3:00 AM | backup.sh | PostgreSQL backup |
| Every 5 min | healthcheck.sh | Service health monitoring |
| Weekly Sunday 4:00 AM | Log cleanup | Remove logs > 30 days |

## 8. PENDING

- [ ] **Domain name** — needed to configure subdomain-based Nginx + SSL
- [ ] **DNS A records** — point domain, api.domain, gw.domain → 204.168.153.166
- [ ] **SSL certificates** — run `ssl-setup.sh DOMAIN EMAIL` once DNS propagates
- [ ] **Update CORS_ORIGINS** — add `https://DOMAIN` when domain is ready
- [ ] **Update VITE_API_URL** — rebuild frontend with `https://api.DOMAIN`

## 9. NEXT STEPS

### Immediate (PROMPT 5 — Tenant Configuration)
1. Register first admin user at `http://204.168.153.166/`
2. Promote user to super_admin via SQL
3. Configure tenant, sites, sections

### When Domain Available
1. Configure DNS A records
2. Run SSL setup: `bash /opt/aion/app/scripts/ssl-setup.sh DOMAIN EMAIL`
3. Update Nginx to subdomain-based config
4. Rebuild frontend with `VITE_API_URL=https://api.DOMAIN`
5. Redeploy and verify
