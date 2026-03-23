# RUNBOOK.md - Clave Seguridad Operations

> Operational procedures for deployment, monitoring, and incident response
> Generated: 2026-03-23

---

## 1. Quick Start (Development)

### Prerequisites
- Node.js >= 20
- pnpm >= 9.15.0
- Docker + Docker Compose
- Git

### Frontend
```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# → http://localhost:5173
```

### Backend
```bash
cd backend

# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, MediaMTX)
docker-compose up -d postgres redis mediamtx

# Run migrations
pnpm db:migrate

# Start all services
pnpm dev
# backend-api → http://localhost:3000
# edge-gateway → http://localhost:3100
```

### Full Stack (Docker)
```bash
# Copy environment template
cp .env.docker.example .env.docker

# Edit .env.docker with your values (JWT_SECRET, DB credentials, etc.)

# Start all services
docker-compose up -d

# Verify health
curl http://localhost:3000/health
curl http://localhost:8080  # Frontend
```

---

## 2. Environment Variables

### Required
| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/clave` |
| JWT_SECRET | JWT signing key (min 32 chars) | `your-32-char-minimum-secret-key-here` |
| CORS_ORIGINS | Allowed frontend origins (CSV) | `http://localhost:5173,https://app.example.com` |

### Required in Production
| Variable | Description |
|----------|-------------|
| CREDENTIAL_ENCRYPTION_KEY | AES-256 key (min 32 chars) for device credentials |
| NODE_ENV | Must be `production` |

### Optional
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Backend API port |
| HOST | 0.0.0.0 | Listen address |
| REDIS_URL | (in-memory) | Redis connection string |
| LOG_LEVEL | info | Logging level |
| RATE_LIMIT_MAX | 100 | Requests per window |
| RATE_LIMIT_WINDOW_MS | 60000 | Rate limit window (ms) |

See `/docs/ENVIRONMENT_VARIABLES.md` for the complete list (40+ variables).

---

## 3. Health Checks

### Endpoints
| Endpoint | Purpose | Expected |
|----------|---------|----------|
| `GET /health` | Basic health | 200 + `{status: "ok", uptime}` |
| `GET /health/liveness` | Process alive | 200 (event loop responsive) |
| `GET /health/ready` | Dependencies ready | 200 if DB+Redis OK, 503 otherwise |
| `GET /health/metrics` | Prometheus metrics | 200 + text/plain metrics |

### Verification Commands
```bash
# Basic health
curl -s http://localhost:3000/health | jq .

# Readiness (DB + Redis)
curl -s http://localhost:3000/health/ready | jq .

# Prometheus metrics
curl -s http://localhost:3000/health/metrics
```

---

## 4. Database Operations

### Run Migrations
```bash
cd backend
pnpm db:migrate
```

### Generate Schema (after modifying schema files)
```bash
cd backend
pnpm db:generate
```

### Backup (Manual)
```bash
# Via API (requires auth)
curl -X POST http://localhost:3000/backup/now \
  -H "Authorization: Bearer $TOKEN"

# Via pg_dump
docker exec clave-postgres pg_dump -U $DB_USER $DB_NAME > backup.sql
```

### Restore
```bash
# Via pg_dump restore
docker exec -i clave-postgres psql -U $DB_USER $DB_NAME < backup.sql
```

---

## 5. Deployment

### Docker Production Deploy
```bash
# 1. Build images
docker-compose -f docker-compose.yml build

# 2. Pull latest images (if using registry)
docker-compose pull

# 3. Run migrations
docker-compose exec backend node dist/db/migrate.js

# 4. Restart services
docker-compose up -d

# 5. Verify health
curl http://localhost:3000/health/ready
```

### GitHub Actions Deploy (Automated)
1. Create a release with tag `v*` (e.g., `v1.0.0`)
2. CI pipeline runs: tests → build → push to GHCR → SSH deploy → health verify
3. Deploy requires GitHub environment approval gate

### Rollback
```bash
# Roll back to previous image
docker-compose down
docker tag ghcr.io/org/backend-api:previous ghcr.io/org/backend-api:latest
docker-compose up -d
```

---

## 6. Monitoring

### Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Backend structured logs (JSON)
docker-compose logs backend 2>&1 | jq .
```

### Metrics
- **Prometheus:** Scrape `http://localhost:3000/health/metrics`
- **Key metrics:**
  - `http_request_duration_seconds` - API latency histogram
  - `http_requests_total` - Request count by method/route/status
  - `nodejs_heap_used_bytes` - Memory usage
  - `process_cpu_seconds_total` - CPU usage

### Stream Status
```bash
# MediaMTX active streams
curl -s http://localhost:9997/v3/paths/list | jq .

# Stream health
curl -s http://localhost:3100/api/v1/streams/health
```

---

## 7. Troubleshooting

### Backend Won't Start
```bash
# Check environment variables
cd backend && node -e "require('./apps/backend-api/dist/config/env.js')"

# Common causes:
# - DATABASE_URL not set or DB not reachable
# - JWT_SECRET less than 32 characters
# - Port 3000 already in use
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
docker exec clave-postgres pg_isready

# Check logs
docker-compose logs postgres
```

### Streams Not Working
```bash
# Check MediaMTX is running
curl http://localhost:9997/v3/config/global

# Check edge gateway
curl http://localhost:3100/health

# Verify RTSP source is reachable
# (from inside Docker network)
docker exec clave-mediamtx ffprobe rtsp://device-ip:554/stream
```

### Authentication Issues
```bash
# Verify JWT secret matches between services
echo $JWT_SECRET | wc -c  # Must be >= 32

# Test login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"supabaseToken": "YOUR_TOKEN"}'

# Check Supabase connectivity
curl https://YOUR_PROJECT.supabase.co/auth/v1/health
```

### High Memory Usage
```bash
# Check process metrics
curl -s http://localhost:3000/health/metrics | grep heap

# Check container resources
docker stats

# Common causes:
# - Too many concurrent streams (increase MediaMTX memory)
# - Large query results without pagination
# - Memory leak in WebSocket connections
```

---

## 8. Maintenance

### Certificate Renewal
```bash
# If using Let's Encrypt via certbot
certbot renew
nginx -s reload
```

### Dependency Updates
- Dependabot creates weekly PRs
- Review and merge after CI passes
- Run `npm audit` / `pnpm audit` manually for urgent patches

### Database Maintenance
```bash
# Vacuum analyze (PostgreSQL)
docker exec clave-postgres psql -U $DB_USER -c "VACUUM ANALYZE;"

# Check table sizes
docker exec clave-postgres psql -U $DB_USER -c "
  SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::text))
  FROM pg_tables WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(tablename::text) DESC;"
```

### Backup Verification
```bash
# Check backup status
curl -s http://localhost:3000/backup/status \
  -H "Authorization: Bearer $TOKEN" | jq .

# List backups
curl -s http://localhost:3000/backup/list \
  -H "Authorization: Bearer $TOKEN" | jq .
```
