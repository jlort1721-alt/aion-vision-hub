# AION Vision Hub — Disaster Recovery Plan

## 1. Critical Data Inventory

| Data | Location | Backup Method |
|------|----------|---------------|
| PostgreSQL (all tables) | Supabase Cloud | Auto + manual pg_dump |
| Backend .env | /opt/aion/app/backend/.env | Manual copy |
| SSL certificates | /etc/letsencrypt/ | Auto-generated (certbot) |
| PM2 process list | /root/.pm2/dump.pm2 | pm2 save |
| Nginx config | /etc/nginx/sites-available/aion | In git repo |
| MediaMTX config | Docker env vars | In ecosystem config |

## 2. Backup Strategy

### Automated Backups (Cron)
- **PostgreSQL**: Daily at 3:00 AM via `/opt/aion/app/scripts/backup.sh`
- **Retention**: 30 days rolling
- **Location**: `/opt/aion/backups/`

### Manual Full Backup
```bash
# Run on VPS
bash /opt/aion/app/scripts/backup.sh

# Download to local
scp root@204.168.153.166:/opt/aion/backups/latest.sql.gz ./

# Also backup config
scp root@204.168.153.166:/opt/aion/app/backend/.env ./backup-env
scp -r root@204.168.153.166:/etc/letsencrypt/ ./backup-certs/
```

## 3. Recovery Procedures

### Scenario A: Service Crash (auto-recovers)
- PM2 auto-restarts crashed Node.js processes
- Docker restart policy: `unless-stopped` for MediaMTX
- **RTO**: < 30 seconds (automatic)

### Scenario B: VPS Reboot
- PM2 startup script auto-starts on boot
- Docker containers restart automatically
- Nginx starts via systemd
- **RTO**: < 2 minutes (automatic)

### Scenario C: Full VPS Failure — Rebuild
**Estimated time: 30-45 minutes**

1. **Provision new VPS** (Hetzner, same specs)
   ```bash
   # On new server
   bash server-setup.sh
   ```

2. **Deploy application**
   ```bash
   # From local machine
   scp aion-deploy-LATEST.tar.gz root@NEW_IP:/opt/aion/
   ssh root@NEW_IP 'cd /opt/aion && tar xzf aion-deploy-*.tar.gz -C app/'
   ```

3. **Restore configuration**
   ```bash
   scp backup-env root@NEW_IP:/opt/aion/app/backend/.env
   chmod 600 /opt/aion/app/backend/.env
   ```

4. **Install dependencies and start**
   ```bash
   cd /opt/aion/app/backend
   pnpm install --prod
   pm2 start ecosystem.config.cjs
   pm2 save && pm2 startup systemd
   ```

5. **Start MediaMTX**
   ```bash
   docker run -d --name mediamtx --restart unless-stopped \
     -p 8554:8554 -p 8888:8888 -p 8889:8889 \
     -p 127.0.0.1:9997:9997 \
     -e MTX_PROTOCOLS=tcp -e MTX_API=yes \
     bluenviron/mediamtx:latest
   ```

6. **Configure Nginx**
   ```bash
   cp /opt/aion/app/scripts/nginx-vps-ip.conf /etc/nginx/sites-available/aion
   ln -sf /etc/nginx/sites-available/aion /etc/nginx/sites-enabled/aion
   rm -f /etc/nginx/sites-enabled/default
   nginx -t && systemctl reload nginx
   ```

7. **Update DNS** (if IP changed)
8. **Re-run SSL setup** (if domain configured)
   ```bash
   bash /opt/aion/app/scripts/ssl-setup.sh DOMAIN EMAIL
   ```

9. **Verify**
   ```bash
   curl http://localhost/api/health
   curl http://localhost/gw/health
   ```

### Scenario D: Database Corruption
```bash
# Restore from backup
bash /opt/aion/app/scripts/restore-db.sh /opt/aion/backups/aion-backup-YYYYMMDD.sql.gz

# Or restore from Supabase dashboard (point-in-time recovery)
# Supabase Pro plans include automatic daily backups
```

## 4. Contact Information

| Role | Action |
|------|--------|
| Hetzner Support | Server provisioning issues |
| Supabase Support | Database issues, Auth issues |
| Let's Encrypt | SSL certificate issues (auto-resolves) |

## 5. Testing Schedule

| Test | Frequency | Procedure |
|------|-----------|-----------|
| Backup verification | Weekly | Check /opt/aion/backups/ has recent file |
| Restore test | Monthly | Restore backup to test DB |
| Failover drill | Quarterly | Practice full rebuild on fresh VPS |
| Health check | Every 5 min | Automated via cron |
