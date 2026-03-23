# DEPLOYMENT.md - Clave Seguridad

> Production deployment guide
> Updated: 2026-03-23

---

## 1. Architecture Overview

```
Internet
    │
    ▼
[NGINX + TLS]  ─── Port 443 (HTTPS)
    │
    ├──► [Frontend SPA]     ─── Static files served by NGINX
    ├──► [Backend API]      ─── Port 3000 (proxied via /api/)
    ├──► [WebSocket]        ─── Port 3000 (proxied via /ws/)
    └──► [Edge Gateway]     ─── Port 3100 (proxied via /edge/)
              │
              ▼
         [MediaMTX]
         ├── RTSP  (8554)
         ├── WebRTC (8889)
         └── HLS   (8888)

[PostgreSQL 16]  ─── Port 5432 (internal)
[Redis 7]        ─── Port 6379 (internal)
```

---

## 2. Prerequisites

### Hardware (Minimum)
| Component | Spec |
|-----------|------|
| CPU | 4 cores |
| RAM | 8 GB |
| Storage | 100 GB SSD |
| Network | 100 Mbps symmetric |
| OS | Ubuntu 22.04 LTS / Debian 12 |

### Hardware (Recommended for 50+ cameras)
| Component | Spec |
|-----------|------|
| CPU | 8 cores |
| RAM | 16 GB |
| Storage | 500 GB SSD |
| Network | 1 Gbps symmetric |

### Software
- Docker >= 24.0
- Docker Compose >= 2.20
- Git
- certbot (for TLS certificates)

---

## 3. Deployment Steps

### Step 1: Clone Repository
```bash
git clone <repo-url> /opt/clave-seguridad
cd /opt/clave-seguridad
```

### Step 2: Configure Environment
```bash
cp .env.docker.example .env.docker
```

Edit `.env.docker`:
```env
# Required
DB_USER=clave_user
DB_PASSWORD=<strong-password>
DB_NAME=clave_db
DB_PORT=5432
JWT_SECRET=<min-32-char-secret>
CORS_ORIGINS=https://your-domain.com
CREDENTIAL_ENCRYPTION_KEY=<min-32-char-key>

# Backend
BACKEND_PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Frontend
FRONTEND_PORT=8080
VITE_API_URL=https://your-domain.com/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>

# Optional integrations
# OPENAI_API_KEY=sk-...
# RESEND_API_KEY=re_...
# WHATSAPP_ACCESS_TOKEN=...
```

### Step 3: SSL/TLS Setup
```bash
# Install certbot
apt install certbot

# Get certificate
certbot certonly --standalone -d your-domain.com

# Update nginx.conf to use certificates
# Add to server block:
#   listen 443 ssl;
#   ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
#   ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
```

### Step 4: Build & Start
```bash
# Build all images
docker-compose build

# Start services
docker-compose up -d

# Verify all services are healthy
docker-compose ps
```

### Step 5: Run Migrations
```bash
docker-compose exec backend pnpm db:migrate
```

### Step 6: Verify Health
```bash
# Backend health
curl -s https://your-domain.com/api/health | jq .

# Frontend
curl -s -o /dev/null -w "%{http_code}" https://your-domain.com

# Streams
curl -s http://localhost:9997/v3/config/global | jq .status
```

### Step 7: Create First Admin User
```bash
# Via Supabase dashboard or API
# Then set role in database:
docker-compose exec postgres psql -U $DB_USER $DB_NAME -c "
  UPDATE profiles SET role = 'super_admin' WHERE email = 'admin@example.com';"
```

---

## 4. Docker Compose Services

| Service | Image | Ports (internal) | Volume |
|---------|-------|--------|--------|
| frontend | Dockerfile.frontend | 80 → 8080 | - |
| backend | backend/Dockerfile | 3000 | - |
| postgres | postgres:16-alpine | 5432 | clave_pgdata |
| redis | redis:7-alpine | 6379 | clave_redis_data |
| mediamtx | bluenviern/mediamtx | 8554,8888,8889,9997 | clave_media_storage |

---

## 5. NGINX Configuration

Key settings in `nginx.conf`:
- SPA routing (fallback to index.html)
- API reverse proxy to backend:3000
- WebSocket upgrade support
- Static asset caching (30 days, immutable)
- Security headers (CSP, X-Frame-Options, HSTS)
- Gzip compression

---

## 6. Backup Strategy

| Type | Schedule | Retention | Method |
|------|----------|-----------|--------|
| Database | Daily 2 AM UTC | 30 backups | backup-worker (automatic) |
| PostgreSQL | Weekly | 4 weeks | pg_dump to external storage |
| Configuration | On change | Git history | Committed to repository |
| Media storage | N/A | Per retention policy | retention-worker |

---

## 7. Monitoring Setup

### Health Check URLs
- Backend: `http://backend:3000/health/ready`
- PostgreSQL: `pg_isready -h postgres -p 5432`
- Redis: `redis-cli -h redis ping`
- MediaMTX: `http://mediamtx:9997/v3/config/global`

### Log Aggregation
```bash
# View all logs
docker-compose logs -f --tail=100

# JSON parse backend logs
docker-compose logs backend 2>&1 | jq -R 'fromjson? // .'
```

### Prometheus Scrape Config
```yaml
scrape_configs:
  - job_name: 'clave-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/health/metrics'
```

---

## 8. Scaling Considerations

### Vertical Scaling
- Increase Docker resource limits in docker-compose.yml
- PostgreSQL: Tune `shared_buffers`, `work_mem`, `max_connections`
- Redis: Increase `maxmemory`

### Horizontal Scaling
- Backend API: Run multiple instances behind load balancer (Redis required for state)
- Edge Gateway: One per physical site
- MediaMTX: One per ~50 concurrent streams
- PostgreSQL: Read replicas for reporting queries

### Resource Limits (docker-compose.yml)
```yaml
deploy:
  resources:
    limits:
      memory: 512M    # Backend API
      cpus: '0.5'
    limits:
      memory: 512M    # PostgreSQL
      cpus: '1.0'
    limits:
      memory: 256M    # Redis
      cpus: '0.25'
    limits:
      memory: 256M    # MediaMTX (increase for more streams)
      cpus: '0.5'
```

---

## 9. CI/CD Pipeline

### Automated Deploy (GitHub Actions)
1. Create GitHub release with tag `v*` (e.g., `v1.0.0`)
2. Pipeline: tests → Docker build → push to GHCR → SSH deploy → health verify
3. Production deploy requires manual approval via GitHub Environment
4. Rollback: re-deploy previous tag

### Manual Deploy
```bash
ssh user@server
cd /opt/clave-seguridad
git pull origin main
docker-compose build
docker-compose up -d
docker-compose exec backend pnpm db:migrate
curl http://localhost:3000/health/ready
```
