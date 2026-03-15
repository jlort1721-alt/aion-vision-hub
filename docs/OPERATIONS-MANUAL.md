# AION Vision Hub — Operations Manual

## Daily Operations

### Check System Health
```bash
# From VPS
pm2 status
curl -s http://localhost:3000/health | jq
curl -s http://localhost:3100/health | jq
docker ps
```

### View Logs
```bash
# Backend API logs
pm2 logs backend-api --lines 50

# Edge Gateway logs
pm2 logs edge-gateway --lines 50

# Nginx logs
tail -f /opt/aion/logs/nginx-access.log

# All PM2 logs
pm2 logs --lines 100
```

### Restart Services
```bash
# Restart single service
pm2 restart backend-api
pm2 restart edge-gateway

# Restart all
pm2 restart all

# Restart MediaMTX
docker restart mediamtx

# Restart Nginx
systemctl reload nginx
```

## Deployment Updates

### Deploy New Version
```bash
# On local machine: build
cd /path/to/open-view-hub-main
npm run build                    # Frontend
cd backend && npx turbo build    # Backend
bash scripts/package-deploy.sh   # Create tarball

# Upload and deploy
scp aion-deploy-*.tar.gz root@204.168.153.166:/opt/aion/
ssh root@204.168.153.166

# On VPS
cd /opt/aion
tar xzf aion-deploy-*.tar.gz -C app/
cd app/backend && pnpm install --prod
pm2 restart all
```

## Backup & Restore

### Manual Backup
```bash
bash /opt/aion/app/scripts/backup.sh
ls -la /opt/aion/backups/
```

### Restore Database
```bash
bash /opt/aion/app/scripts/restore-db.sh /opt/aion/backups/FILENAME.sql.gz
```

## Monitoring

### Disk Usage
```bash
df -h /
du -sh /opt/aion/backups/
du -sh /opt/aion/logs/
```

### Memory Usage
```bash
free -h
pm2 monit  # Interactive memory/CPU monitor
```

### Network Connections
```bash
ss -tlnp  # Listening ports
ss -s     # Connection summary
```

## Troubleshooting

### Backend API Won't Start
```bash
pm2 logs backend-api --lines 50 --nostream
# Check for: Zod validation errors (missing env vars)
# Check for: Database connection errors
# Fix: Update /opt/aion/app/backend/.env
```

### Edge Gateway Crashing
```bash
pm2 logs edge-gateway --lines 50 --nostream
# Common: Logger config issues, missing JWT_SECRET
# Fix: Ensure .env has all required variables
```

### MediaMTX No Streams
```bash
curl http://localhost:9997/v3/paths/list
docker logs mediamtx --tail 50
# Check: Camera IPs are reachable from VPS
# Check: RTSP credentials are correct
```

### Nginx 502 Bad Gateway
```bash
# Check if backend is running
pm2 status
curl http://localhost:3000/health

# If not running, restart
pm2 restart backend-api
```

### High Memory Usage
```bash
pm2 monit
# If a process uses > 1GB, it will auto-restart (max_memory_restart)
# For MediaMTX: docker stats mediamtx
```

### SSL Certificate Expired
```bash
certbot renew
systemctl reload nginx
```

## Useful Commands

```bash
# PM2
pm2 status          # Process list
pm2 monit           # Interactive monitor
pm2 logs            # All logs
pm2 flush           # Clear logs
pm2 save            # Save process list

# Docker
docker ps           # Running containers
docker stats        # Resource usage
docker logs mediamtx --tail 100

# System
htop                # Interactive process monitor
ufw status          # Firewall rules
fail2ban-client status sshd  # Banned IPs
```
