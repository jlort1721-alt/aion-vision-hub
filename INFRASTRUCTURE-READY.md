# AION Vision Hub — Infrastructure Configuration Report

**Date:** 2026-03-14
**PROMPT:** 3 of 10 — VPS Infrastructure Setup
**Status:** COMPLETADO

---

## 1. VPS SERVER

| Item | Value |
|------|-------|
| Provider | Hetzner |
| OS | Ubuntu 24.04.4 LTS |
| IPv4 | `204.168.153.166` |
| IPv6 | `2a01:4f9:c014:38f5::/64` |
| SSH User | root |
| App User | aion (docker group) |
| Docker | 29.3.0 |
| Node.js | v20.20.1 |
| pnpm | 9.15.9 |
| Nginx | 1.24.0 |

## 2. SCRIPTS GENERATED

| Script | Path | Purpose |
|--------|------|---------|
| server-setup.sh | `/scripts/server-setup.sh` | Full VPS provisioning (Docker, Node, Nginx, UFW, fail2ban, tuning) |
| nginx-aion.conf | `/scripts/nginx-aion.conf` | Multi-domain Nginx config with rate limiting, WebSocket, security headers |
| ssl-setup.sh | `/scripts/ssl-setup.sh` | Let's Encrypt SSL for 3 subdomains + auto-renewal |
| deploy.sh | `/scripts/deploy.sh` | Zero-downtime deploy with health checks |
| backup.sh | `/scripts/backup.sh` | PostgreSQL backup with 30-day rotation |
| healthcheck.sh | `/scripts/healthcheck.sh` | Service health + disk/memory monitoring |
| restore-db.sh | `/scripts/restore-db.sh` | Database restore from backup |
| logs.sh | `/scripts/logs.sh` | Centralized log viewer per service |

## 3. DOCKER COMPOSE (PRODUCTION)

File: `/backend/docker-compose.prod.yml`

| Service | Image/Build | Port | Resources |
|---------|-------------|------|-----------|
| PostgreSQL 16 | postgres:16-alpine | 127.0.0.1:5432 | 2GB RAM, 2 CPUs |
| Backend API | Custom (Fastify 5) | 127.0.0.1:3000 | 1GB RAM, 2 CPUs |
| Edge Gateway | Custom (Fastify 5) | 127.0.0.1:3100 | 512MB RAM, 1 CPU |
| MediaMTX | bluenviron/mediamtx | 8554, 8888, 8889, 9997 | 1GB RAM, 2 CPUs |

### PostgreSQL Tuning (250-1000 devices)
- shared_buffers = 1GB
- effective_cache_size = 3GB
- work_mem = 16MB
- maintenance_work_mem = 256MB
- max_connections = 200
- wal_buffers = 64MB
- max_wal_size = 2GB

### MediaMTX Configuration
- RTSP TCP on port 8554
- WebRTC on port 8889
- HLS on port 8888
- API on port 9997 (internal only)
- Read buffer: 2048
- Metrics enabled

## 4. FIREWALL (UFW)

| Port | Protocol | Service |
|------|----------|---------|
| 22 | TCP | SSH |
| 80 | TCP | HTTP |
| 443 | TCP | HTTPS |
| 8554 | TCP | RTSP (MediaMTX) |
| 8889 | TCP/UDP | WebRTC (MediaMTX) |

## 5. SECURITY

| Item | Status |
|------|--------|
| fail2ban | [OK] Active — SSH (5 attempts/ban 1h), Nginx (rate limit) |
| UFW firewall | [OK] Active — deny incoming, allow outgoing |
| Nginx server_tokens | [OK] off — version hidden |
| Security headers | [OK] X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy |
| Rate limiting (Nginx) | [OK] API: 30r/s, Login: 5r/m, General: 50r/s |
| Log rotation | [OK] logrotate configured — 14 days, compressed |

## 6. SYSTEM TUNING

| Parameter | Value |
|-----------|-------|
| fs.file-max | 1,000,000 |
| fs.inotify.max_user_watches | 524,288 |
| net.core.somaxconn | 65,535 |
| net.core.netdev_max_backlog | 65,536 |
| net.ipv4.tcp_max_syn_backlog | 65,536 |
| net.ipv4.ip_local_port_range | 1024–65535 |
| net.ipv4.tcp_tw_reuse | 1 |
| vm.swappiness | 10 |
| nofile limit | 1,000,000 (soft + hard) |

## 7. DIRECTORY STRUCTURE

```
/opt/aion/
├── app/          # Application code
│   ├── dist/     # Frontend build
│   ├── backend/  # Backend + Gateway
│   └── scripts/  # Operation scripts
├── backups/      # PostgreSQL backups
├── logs/         # Centralized logs
├── ssl/          # SSL certificates
└── media/        # Snapshots & clips
```

## 8. CRON JOBS CONFIGURED

| Schedule | Script | Purpose |
|----------|--------|---------|
| Daily 3:00 AM | backup.sh | PostgreSQL backup |
| Every 5 min | healthcheck.sh | Service health monitoring |
| Weekly Sunday 4:00 AM | Log cleanup | Remove logs > 30 days |

## 9. NGINX CONFIGURATION

### Current: IP-based routing (no domain yet)
- `http://204.168.153.166/` → Frontend placeholder (verified working)
- `http://204.168.153.166/api/` → Backend API (proxy to :3000)
- `http://204.168.153.166/gw/` → Edge Gateway (proxy to :3100)

### Ready: Multi-domain template (`nginx-aion.conf`)
- `DOMAIN` → Frontend (SPA with PWA support)
- `api.DOMAIN` → Backend API (WebSocket, 50M upload)
- `gw.DOMAIN` → Edge Gateway (WebSocket, 120s timeout)

## 10. EXECUTION ORDER ON VPS

```bash
# Step 1: Provisioning (DONE)
bash /opt/aion/app/scripts/server-setup.sh

# Step 2: Deploy app (PROMPT 4)
bash /opt/aion/app/scripts/deploy.sh

# Step 3: Configure domain + SSL (when domain available)
# Update nginx-aion.conf replacing DOMAIN
# bash /opt/aion/app/scripts/ssl-setup.sh DOMAIN EMAIL
```

## 11. HARDWARE REQUIREMENTS

| Scale | CPU | RAM | Disk | Bandwidth |
|-------|-----|-----|------|-----------|
| 250 devices | 4 cores | 8 GB | 80 GB SSD | 100 Mbps |
| 500 devices | 6 cores | 16 GB | 160 GB SSD | 200 Mbps |
| 1000 devices | 8 cores | 32 GB | 320 GB SSD | 500 Mbps |

## 12. PENDING FOR SSL

- [ ] Domain name (e.g., `aion.empresa.com`)
- [ ] DNS A records pointing to `204.168.153.166`:
  - `aion.empresa.com` → 204.168.153.166
  - `api.aion.empresa.com` → 204.168.153.166
  - `gw.aion.empresa.com` → 204.168.153.166
- [ ] Email for Let's Encrypt certificate

## 13. NEXT STEPS (PROMPT 4)

1. Build frontend (`npm run build`)
2. Build backend (`pnpm build`)
3. Package and upload to VPS via SCP
4. Start Docker containers
5. Configure domain DNS + SSL (when ready)
6. Verify all services healthy
7. Configure monitoring crons
