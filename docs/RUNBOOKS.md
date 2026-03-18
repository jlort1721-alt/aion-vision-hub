# AION Vision Hub — Operational Runbooks

Last updated: 2026-03-18

This document contains step-by-step procedures for diagnosing and resolving production incidents. Each runbook follows the format: **Symptoms**, **Diagnosis**, **Resolution**, **Prevention**.

> **Audience**: On-call engineers and system administrators with SSH access to the VPS.
> **VPS access**: `ssh root@<VPS_IP>` (see `.env` or team password manager for IP).
> **Application root**: `/opt/aion/app`

---

## Table of Contents

1. [Service Recovery](#1-service-recovery)
2. [Database Recovery](#2-database-recovery)
3. [SSL Certificate Renewal](#3-ssl-certificate-renewal)
4. [Disk Space Emergency](#4-disk-space-emergency)
5. [High Memory Usage](#5-high-memory-usage)
6. [Device Offline Storm](#6-device-offline-storm)
7. [WhatsApp Integration Down](#7-whatsapp-integration-down)
8. [Database Connection Exhaustion](#8-database-connection-exhaustion)
9. [Horizontal Scaling](#9-horizontal-scaling)
10. [Version Rollback](#10-version-rollback)

---

## 1. Service Recovery

When a backend service crashes repeatedly and PM2 cannot auto-restart it.

### Symptoms

- PM2 shows a service in `errored` or `stopped` status with high restart count.
- Health endpoint (`/health`) returns 502 or times out.
- Frontend shows "Connection error" or fails to load data.
- PM2 logs show rapid restart loops (restarts > 15 in status output).

### Diagnosis

```bash
# 1. Check PM2 process status
pm2 status

# 2. Read the last 100 lines of the failing service log
pm2 logs backend-api --lines 100 --nostream
pm2 logs edge-gateway --lines 100 --nostream

# 3. Look for common root causes in the logs:
#    - "ECONNREFUSED" → database or Redis is down
#    - "ZodError" → missing or invalid environment variable
#    - "ENOMEM" → out of memory (see Runbook 5)
#    - "EADDRINUSE" → port conflict with another process
#    - "MODULE_NOT_FOUND" → corrupted node_modules

# 4. Check if the port is already in use
ss -tlnp | grep ':3000\|:3100'

# 5. Check system resources
free -h
df -h /
```

### Resolution

```bash
# Step 1: Stop the service cleanly
pm2 stop backend-api

# Step 2: If port conflict, kill the orphan process
kill -9 $(lsof -ti:3000)  # Only if another process holds the port

# Step 3: If node_modules corrupted, reinstall
cd /opt/aion/app/backend
pnpm install --frozen-lockfile

# Step 4: Verify environment variables are present
cat /opt/aion/app/backend/.env | grep -c '='
# Should match expected count (check config/env.ts for required vars)

# Step 5: Restart the service
pm2 restart backend-api

# Step 6: Wait 10 seconds and verify
sleep 10
curl -s http://localhost:3000/health | jq

# Step 7: If still failing, check dependencies
pm2 restart all  # Restart everything in correct order
docker restart mediamtx  # If streaming is affected

# Step 8: Save the PM2 process list so it survives reboot
pm2 save
```

### Prevention

- Set `max_memory_restart: '512M'` in `ecosystem.config.cjs` to prevent OOM loops.
- Configure PM2 `max_restarts: 10` and `min_uptime: '10s'` to detect crash loops early.
- Set up an external health check (e.g., UptimeRobot) that alerts when `/health` is down for > 2 minutes.
- Ensure `.env` changes are validated locally before deploying.

---

## 2. Database Recovery

Restoring the PostgreSQL database from a backup after data corruption or accidental deletion.

### Symptoms

- Application returns 500 errors with database-related messages.
- Missing data reported by users after a failed migration or accidental `DELETE`.
- Supabase dashboard shows unexpected table states.

### Diagnosis

```bash
# 1. Check if the database is reachable
psql "$DATABASE_URL" -c "SELECT 1;"

# 2. Check the latest backup file
ls -lhrt /opt/aion/backups/ | tail -5

# 3. Verify backup file integrity (should decompress without errors)
gunzip -t /opt/aion/backups/aion-backup-YYYYMMDD.sql.gz

# 4. If using Supabase Cloud, check the dashboard:
#    Project Settings > Database > Backups > Point-in-time recovery
```

### Resolution

```bash
# Option A: Restore from local backup file
# ──────────────────────────────────────────

# Step 1: Stop the backend to prevent writes during restore
pm2 stop backend-api edge-gateway

# Step 2: Run the restore script
bash /opt/aion/app/scripts/restore-db.sh /opt/aion/backups/aion-backup-YYYYMMDD.sql.gz

# Step 3: Re-apply any migrations that were added after the backup
for f in /opt/aion/app/backend/apps/backend-api/src/db/migrations/*.sql; do
  echo "Applying: $(basename "$f")"
  psql "$DATABASE_URL" -f "$f" 2>/dev/null || echo "  (skipped or already applied)"
done

# Step 4: Re-run the production seed to ensure reference data is intact
psql "$DATABASE_URL" -f /opt/aion/app/scripts/seed-production.sql

# Step 5: Restart services
pm2 restart all

# Step 6: Verify data integrity
curl -s http://localhost:3000/health | jq
psql "$DATABASE_URL" -c "SELECT count(*) FROM tenants;"
psql "$DATABASE_URL" -c "SELECT count(*) FROM sites;"


# Option B: Supabase point-in-time recovery (Cloud)
# ──────────────────────────────────────────────────
# 1. Go to Supabase Dashboard > Project Settings > Database > Backups
# 2. Select "Point-in-time recovery"
# 3. Choose a timestamp BEFORE the data loss event
# 4. Confirm the restore (this replaces the current database)
# 5. After restore completes, restart backend services
```

### Prevention

- Automated daily backups via cron (`/opt/aion/app/scripts/backup.sh` at 3:00 AM).
- Keep 30-day rolling retention of backups.
- Test restore procedure monthly on a disposable database.
- Before running destructive migrations, always create a manual backup first.
- Enable Supabase Pro for automatic point-in-time recovery.

---

## 3. SSL Certificate Renewal

Manual renewal when Let's Encrypt auto-renewal fails.

### Symptoms

- Browser shows "Your connection is not private" or `ERR_CERT_DATE_INVALID`.
- `curl -v https://yourdomain.com` shows certificate expiry date in the past.
- Cron log shows `certbot renew` failures.

### Diagnosis

```bash
# 1. Check current certificate expiry
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# 2. Check certbot renewal status
certbot certificates

# 3. Check the renewal log for errors
cat /var/log/letsencrypt/letsencrypt.log | tail -50

# 4. Verify Nginx is running (certbot needs port 80 for HTTP-01 challenge)
systemctl status nginx
ss -tlnp | grep ':80'

# 5. Verify DNS resolves to this server
dig +short yourdomain.com
curl -I http://yourdomain.com/.well-known/acme-challenge/test 2>/dev/null
```

### Resolution

```bash
# Step 1: Ensure Nginx is running and port 80 is accessible
systemctl start nginx

# Step 2: Attempt automatic renewal
certbot renew --force-renewal

# Step 3: If auto-renewal fails due to DNS or config issues, use manual mode
certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com

# Step 4: Reload Nginx to pick up new certificate
nginx -t && systemctl reload nginx

# Step 5: Verify the new certificate
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# Step 6: Test from external source
curl -I https://yourdomain.com
```

### Prevention

- Certbot installs a systemd timer (`certbot.timer`) that runs twice daily. Verify it is active:
  ```bash
  systemctl status certbot.timer
  ```
- If the timer is missing, add a cron entry:
  ```bash
  echo "0 3,15 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'" | crontab -
  ```
- Set a calendar reminder 2 weeks before certificate expiry as a safety net.
- Monitor certificate expiry with an external tool (e.g., UptimeRobot SSL check).

---

## 4. Disk Space Emergency

Steps to free disk space when the VPS disk is critically full (> 90%).

### Symptoms

- Services fail to write logs: `ENOSPC: no space left on device`.
- Database backups fail silently.
- Docker containers fail to start.
- `df -h /` shows usage above 90%.

### Diagnosis

```bash
# 1. Check overall disk usage
df -h /

# 2. Find the largest directories
du -sh /opt/aion/backups/ /opt/aion/logs/ /var/log/ /tmp/ /var/lib/docker/ 2>/dev/null | sort -rh

# 3. Find large files (>100MB)
find / -xdev -type f -size +100M -exec ls -lh {} \; 2>/dev/null | sort -k5 -rh | head -20

# 4. Check Docker disk usage
docker system df

# 5. Check PM2 log sizes
du -sh ~/.pm2/logs/
```

### Resolution

```bash
# Step 1: Clear PM2 logs (immediate space recovery)
pm2 flush

# Step 2: Rotate and compress old log files
find /opt/aion/logs/ -name "*.log" -mtime +7 -exec gzip {} \;
find /opt/aion/logs/ -name "*.gz" -mtime +30 -delete

# Step 3: Clean old backups (keep last 7 days)
find /opt/aion/backups/ -name "*.sql.gz" -mtime +7 -delete

# Step 4: Docker cleanup — remove unused images, containers, and build cache
docker system prune -af --volumes
# WARNING: --volumes removes unused named volumes. Only run if you are sure
# no stopped containers need their data.

# Step 5: Clean system logs
journalctl --vacuum-size=100M

# Step 6: Clean apt cache (Debian/Ubuntu)
apt-get clean
apt-get autoremove -y

# Step 7: If /tmp is large, clean old temp files
find /tmp -type f -atime +3 -delete 2>/dev/null

# Step 8: Verify space recovered
df -h /
```

### Prevention

- Configure log rotation in `/etc/logrotate.d/aion`:
  ```
  /opt/aion/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
  }
  ```
- Set Docker log limits in `daemon.json`:
  ```json
  { "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
  ```
- Backup retention: 30 days max. Clean old backups in the backup script.
- Set a monitoring alert when disk usage exceeds 80%.

---

## 5. High Memory Usage

Diagnosing and resolving memory pressure that causes OOM kills or sluggish performance.

### Symptoms

- PM2 monit shows a process using > 512MB.
- `dmesg | grep -i oom` shows OOM killer activity.
- System is slow; `free -h` shows < 100MB available.
- Services restart frequently (PM2 `max_memory_restart` triggered).

### Diagnosis

```bash
# 1. Check system memory
free -h

# 2. Check per-process memory usage
pm2 monit
# or
pm2 jlist | python3 -c "
import json,sys
for p in json.load(sys.stdin):
  print(f\"{p['name']:20s} {p['monit']['memory']//1024//1024:>6d} MB  restarts={p['pm2_env']['restart_time']}\")
"

# 3. Check Docker container memory
docker stats --no-stream

# 4. Check for OOM kills in system log
dmesg | grep -i "out of memory\|oom" | tail -10
journalctl -k --since "1 hour ago" | grep -i oom

# 5. Check Node.js heap usage (if API is responsive)
curl -s http://localhost:3000/health/ready | jq '.memory'
```

### Resolution

```bash
# Step 1: Identify the leaking process from diagnosis above

# Step 2: Restart the offending service
pm2 restart backend-api   # or edge-gateway, etc.

# Step 3: If MediaMTX is the culprit (many active streams)
docker restart mediamtx

# Step 4: If Redis is using too much memory
redis-cli INFO memory | grep used_memory_human
redis-cli FLUSHDB  # Only if cache data is expendable

# Step 5: If system-wide memory is low, increase swap as temporary measure
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Step 6: For persistent leaks, increase memory limits in ecosystem.config.cjs
# max_memory_restart: '768M'  (currently '512M')
```

### Prevention

- Set `max_memory_restart` in PM2 ecosystem config for all Node.js services.
- Configure Docker memory limits in `docker-compose.yml` (`deploy.resources.limits.memory`).
- Monitor memory trends with `pm2 monit` or Prometheus + Grafana.
- Upgrade VPS RAM if consistently above 80% utilization.
- Review code for common Node.js leaks: unclosed database connections, growing event listener lists, large in-memory caches without TTL.

---

## 6. Device Offline Storm

When a large number of devices go offline simultaneously, distinguishing between a network-level issue and individual device failures.

### Symptoms

- Dashboard shows many devices switching from "online" to "offline" within minutes.
- Event feed floods with `device_offline` events.
- Alert system triggers multiple simultaneous notifications.
- Operators report cameras are inaccessible.

### Diagnosis

```bash
# 1. Check how many devices are offline per site
psql "$DATABASE_URL" -c "
  SELECT s.name AS site, s.wan_ip,
    count(*) FILTER (WHERE d.status = 'offline') AS offline,
    count(*) FILTER (WHERE d.status = 'online') AS online,
    count(*) AS total
  FROM devices d
  JOIN sites s ON d.site_id = s.id
  GROUP BY s.id, s.name, s.wan_ip
  ORDER BY offline DESC;
"

# 2. If all devices at one site are offline, test the site's WAN IP
ping -c 4 <SITE_WAN_IP>
traceroute <SITE_WAN_IP>

# 3. If WAN IP is unreachable, the issue is network-level (ISP, router, power)
# Contact the site's ISP or on-site personnel.

# 4. If WAN IP is reachable but devices are offline, test individual ports
for port in 8001 8002 8003; do
  nc -zv <SITE_WAN_IP> $port -w 3 2>&1
done

# 5. Check if the health check worker is running
pm2 status | grep health-check

# 6. Check if there was a recent router reboot (port mappings may have reset)
```

### Resolution

```bash
# Scenario A: Network/ISP outage at a specific site
# ──────────────────────────────────────────────────
# 1. Confirm with on-site personnel that power and internet are down
# 2. Suppress alerting for the affected site to avoid notification fatigue:
psql "$DATABASE_URL" -c "
  UPDATE alert_rules
  SET is_active = false
  WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
    AND conditions->>'siteId' = '<SITE_ID>';
"
# 3. When connectivity is restored, re-enable alerts and run a health check:
curl -X POST http://localhost:3000/api/devices/site/<SITE_ID>/health-check \
  -H "Authorization: Bearer $TOKEN"

# Scenario B: Router reboot reset port forwarding
# ────────────────────────────────────────────────
# 1. SSH or access the site router's web interface
# 2. Re-apply port forwarding rules from the site's documentation
# 3. Run site health check after port forwarding is restored

# Scenario C: Multiple individual device failures (power supply, firmware crash)
# ──────────────────────────────────────────────────────────────────────────────
# 1. Group affected devices by type/brand — firmware bug may be the cause
# 2. Schedule on-site visit to power-cycle or replace affected devices
# 3. Create an incident in the system to track the resolution
```

### Prevention

- Implement a "site-level health check" that pings the WAN IP before checking individual devices. If WAN is unreachable, mark the entire site offline with a single event instead of per-device events.
- Configure alert rules with "minimum threshold" — only alert if > 3 devices at a site go offline simultaneously (likely network issue, not individual failure).
- Maintain a UPS (uninterruptible power supply) at each site for the network equipment.
- Document port forwarding rules for each site's router.

---

## 7. WhatsApp Integration Down

When WhatsApp Business API notifications stop being delivered.

### Symptoms

- Notification log shows `status: 'failed'` for WhatsApp entries.
- Error messages contain `401 Unauthorized` or `token expired`.
- Users report not receiving WhatsApp alert notifications.
- WhatsApp webhook events stop arriving.

### Diagnosis

```bash
# 1. Check notification log for recent WhatsApp failures
psql "$DATABASE_URL" -c "
  SELECT status, error, count(*)
  FROM notification_log
  WHERE type = 'whatsapp' AND created_at > now() - interval '24 hours'
  GROUP BY status, error
  ORDER BY count DESC;
"

# 2. Test the Meta Graph API directly
curl -s "https://graph.facebook.com/v21.0/$WHATSAPP_PHONE_NUMBER_ID" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN" | jq

# Expected: 200 with phone number details
# If 401: token is expired or invalid
# If 400: phone number ID is wrong

# 3. Check if the webhook is registered and verified
curl -s "https://graph.facebook.com/v21.0/$WHATSAPP_BUSINESS_ACCOUNT_ID/subscribed_apps" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN" | jq

# 4. Check backend logs for WhatsApp-related errors
pm2 logs backend-api --lines 200 --nostream | grep -i whatsapp

# 5. Verify the webhook endpoint is accessible from the internet
curl -s https://yourdomain.com/api/whatsapp/webhook
```

### Resolution

```bash
# Step 1: Refresh the WhatsApp access token
# Go to: https://developers.facebook.com/apps/<APP_ID>/whatsapp-business/api-setup/
# Generate a new System User token (valid for 60 days) or use a permanent token.

# Step 2: Update the token in the backend .env
nano /opt/aion/app/backend/.env
# Update: WHATSAPP_ACCESS_TOKEN=<new-token>

# Step 3: Restart the backend to pick up the new token
pm2 restart backend-api

# Step 4: Re-register the webhook (if webhook subscription was lost)
curl -X POST "https://graph.facebook.com/v21.0/$WHATSAPP_BUSINESS_ACCOUNT_ID/subscribed_apps" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN" \
  -d "override_callback_uri=https://yourdomain.com/api/whatsapp/webhook" \
  -d "verify_token=$WHATSAPP_VERIFY_TOKEN"

# Step 5: Verify with a test message
curl -X POST "https://graph.facebook.com/v21.0/$WHATSAPP_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "<TEST_PHONE_NUMBER>",
    "type": "text",
    "text": {"body": "AION WhatsApp test - integration restored"}
  }'

# Step 6: Check Meta Platform Status for outages
# https://metastatus.com/
```

### Prevention

- Use a System User permanent token instead of the 60-day temporary token.
- Set up a monitoring check that sends a test WhatsApp message weekly.
- Subscribe to Meta Platform Status alerts.
- Log all WhatsApp API responses for debugging.
- Implement token expiry tracking: alert 7 days before expiry.

---

## 8. Database Connection Exhaustion

When the application runs out of available database connections.

### Symptoms

- API requests timeout or return 500 errors.
- Logs show: `remaining connection slots are reserved for superuser` or `too many clients already`.
- `pg_stat_activity` shows many connections in `idle` or `idle in transaction` state.
- Application health check fails with database connectivity error.

### Diagnosis

```bash
# 1. Check current connection count vs limit
psql "$DATABASE_URL" -c "
  SELECT count(*) AS current_connections,
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_connections
  FROM pg_stat_activity;
"

# 2. See connections grouped by state and application
psql "$DATABASE_URL" -c "
  SELECT state, application_name, count(*)
  FROM pg_stat_activity
  GROUP BY state, application_name
  ORDER BY count DESC;
"

# 3. Find long-running idle-in-transaction connections
psql "$DATABASE_URL" -c "
  SELECT pid, state, query_start, now() - query_start AS duration, query
  FROM pg_stat_activity
  WHERE state = 'idle in transaction'
  ORDER BY duration DESC
  LIMIT 10;
"

# 4. Check if PgBouncer is in use and its status
# (If using Docker Compose, PgBouncer may run as a sidecar)
pgbouncer -R  # or check its admin console

# 5. Check how many instances of backend-api are running
pm2 jlist | python3 -c "
import json,sys
for p in json.load(sys.stdin):
  if 'backend' in p['name']:
    print(f\"{p['name']} instances={p['pm2_env'].get('instances',1)}\")
"
```

### Resolution

```bash
# Step 1: Terminate idle-in-transaction connections that are stuck
psql "$DATABASE_URL" -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle in transaction'
    AND now() - query_start > interval '10 minutes';
"

# Step 2: Restart backend services to reset connection pools
pm2 restart backend-api
pm2 restart edge-gateway

# Step 3: If using PgBouncer, restart it
# Docker:
docker restart pgbouncer
# Systemd:
systemctl restart pgbouncer

# Step 4: If the issue recurs, increase max_connections temporarily
# (Supabase Cloud: adjust in Dashboard > Database > Settings)
# (Self-hosted: edit postgresql.conf)
# ALTER SYSTEM SET max_connections = 200;
# SELECT pg_reload_conf();

# Step 5: For Supabase Cloud, add PgBouncer connection string
# Format: postgres://user:pass@host:6543/postgres?pgbouncer=true
# Update DATABASE_URL in .env to use the pooler port (6543)
```

### Prevention

- Use connection pooling (PgBouncer or Supabase connection pooler on port 6543).
- Set `idle_in_transaction_session_timeout` in PostgreSQL:
  ```sql
  ALTER SYSTEM SET idle_in_transaction_session_timeout = '60s';
  SELECT pg_reload_conf();
  ```
- Limit pool size in Drizzle/pg config to match available connections divided by number of service instances.
- Monitor connection count with a periodic health check query.

---

## 9. Horizontal Scaling

Adding a second backend-api instance with Redis-backed session sharing.

### Symptoms / Trigger

- Average API response time exceeds 500ms under normal load.
- PM2 monit shows sustained CPU above 80% on the backend-api process.
- Growing request queue / connection timeouts during peak hours.

### Prerequisites

- Redis is running and accessible (already included in `docker-compose.yml`).
- `REDIS_URL` is configured in the backend `.env`.
- Nginx is the reverse proxy in front of backend services.

### Steps

```bash
# Step 1: Verify Redis is operational
redis-cli -u "$REDIS_URL" ping
# Expected: PONG

# Step 2: Scale backend-api to 2 instances via PM2 cluster mode
# Edit ecosystem.config.cjs:
#   { name: 'backend-api', instances: 2, exec_mode: 'cluster', ... }
# Or scale dynamically:
pm2 scale backend-api 2

# Step 3: Verify both instances are running
pm2 status
# Should show backend-api with 2 instances (id 0 and 1)

# Step 4: Configure Nginx upstream for load balancing
# Edit /etc/nginx/sites-available/aion:
#
#   upstream backend_pool {
#     least_conn;
#     server 127.0.0.1:3000;
#     server 127.0.0.1:3001;
#   }
#
#   location /api/ {
#     proxy_pass http://backend_pool;
#     proxy_http_version 1.1;
#     proxy_set_header Upgrade $http_upgrade;
#     proxy_set_header Connection 'upgrade';
#     proxy_set_header Host $host;
#     proxy_set_header X-Real-IP $remote_addr;
#     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#     proxy_set_header X-Forwarded-Proto $scheme;
#   }

# Step 5: Test Nginx configuration and reload
nginx -t && systemctl reload nginx

# Step 6: Verify load balancing is working
for i in $(seq 1 10); do
  curl -s http://localhost/api/health | jq '.pid // .instance'
done
# Should see responses from different PIDs

# Step 7: Save PM2 state
pm2 save
```

### Prevention / Notes

- JWT authentication is stateless and works across instances without session sharing.
- Redis is used for rate limiting, cache, and WebSocket state sharing.
- WebSocket connections are sticky to the instance that accepted them. If using PM2 cluster mode, configure Nginx `ip_hash` or use Redis adapter for Socket.io.
- Monitor per-instance metrics to ensure even load distribution.

---

## 10. Version Rollback

Rolling back to a previous Docker image version when a new deployment introduces breaking issues.

### Symptoms

- Health checks fail immediately after a new deployment.
- Users report new bugs or broken functionality after deploy.
- Error rates spike in logs.

### Diagnosis

```bash
# 1. Check when the last deployment happened
cat /opt/aion/app/deploy.log | tail -5

# 2. Check currently running image tags
docker compose -f /opt/aion/app/backend/docker-compose.prod.yml ps
docker inspect backend-api --format='{{.Config.Image}}'

# 3. List available local images (previous versions)
docker images "ghcr.io/*/aion/backend-api" --format "table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}"

# 4. List available remote images in GHCR
# (requires gh CLI authenticated)
gh api /user/packages/container/aion%2Fbackend-api/versions --jq '.[].metadata.container.tags[]' | head -20
```

### Resolution

```bash
# Step 1: Identify the last known good version
# From deploy.log or GHCR tag list, find the previous version (e.g., v1.2.3)
PREVIOUS_TAG="v1.2.3"

# Step 2: Stop current services gracefully
cd /opt/aion/app/backend
docker compose -f docker-compose.prod.yml stop backend-api edge-gateway

# Step 3: Pull the previous version
docker pull ghcr.io/<ORG>/aion/backend-api:$PREVIOUS_TAG
docker pull ghcr.io/<ORG>/aion/edge-gateway:$PREVIOUS_TAG

# Step 4: Update docker-compose.prod.yml to pin the version
# Or set via environment variable:
export IMAGE_TAG=$PREVIOUS_TAG
docker compose -f docker-compose.prod.yml up -d

# Step 5: Verify health
sleep 10
curl -s http://localhost:3000/health | jq
curl -s http://localhost:3100/health | jq

# Step 6: If the rollback involved a database migration,
# check if the migration needs to be reverted manually:
psql "$DATABASE_URL" -c "SELECT * FROM drizzle_migrations ORDER BY created_at DESC LIMIT 5;"
# WARNING: Drizzle does not have auto-rollback. Prepare DOWN migrations
# for critical schema changes.

# Step 7: Log the rollback
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') ROLLBACK to=$PREVIOUS_TAG reason='post-deploy failure'" >> /opt/aion/app/deploy.log

# Step 8: Notify the team about the rollback
```

### Prevention

- Always deploy to staging first and run smoke tests before production.
- Tag every release with semver. Never use `latest` in production compose files.
- Write reversible database migrations. For destructive migrations (drop column, change type), keep the old column for one release cycle.
- Maintain a `deploy.log` on the server to track deployment history.
- Use the GitHub Actions production workflow which includes a manual approval gate.

---

## Quick Reference

| Runbook | First Command to Run |
|---------|---------------------|
| Service Recovery | `pm2 status && pm2 logs <service> --lines 50 --nostream` |
| Database Recovery | `ls -lhrt /opt/aion/backups/ \| tail -5` |
| SSL Renewal | `certbot certificates` |
| Disk Space | `df -h / && du -sh /opt/aion/backups/ /opt/aion/logs/ ~/.pm2/logs/` |
| High Memory | `free -h && pm2 monit` |
| Device Offline Storm | `psql ... -c "SELECT site, count(*) FROM devices WHERE status='offline' GROUP BY site"` |
| WhatsApp Down | `pm2 logs backend-api --lines 200 --nostream \| grep -i whatsapp` |
| Connection Exhaustion | `psql ... -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state"` |
| Horizontal Scaling | `pm2 scale backend-api 2` |
| Version Rollback | `docker images "ghcr.io/*/aion/backend-api" --format "table {{.Tag}}"` |
