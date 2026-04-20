# Rollback Runbook — AION Vision Hub

## When to Rollback

- API health check returns non-200
- PM2 `aionseg-api` in restart loop (>5 restarts in 5 min)
- HTTP 500 rate > 1% in nginx access log
- Frontend shows blank page or JS errors

## Procedure

### 1. Identify the backup
```bash
ssh aion-vps 'ls -t /var/backups/aion/ | head -5'
```

### 2. Restore DB (if migration caused issue)
```bash
ssh aion-vps '
  DUMP="/var/backups/aion/<TIMESTAMP>/pre-deploy.dump"
  sudo -u postgres pg_restore -d aionseg_prod -c "$DUMP"
  # Or for full cluster restore:
  # gunzip < /var/backups/aion/<TIMESTAMP>/postgres-full.sql.gz | sudo -u postgres psql
'
```

### 3. Restore code (if build caused issue)
```bash
ssh aion-vps '
  # Frontend
  sudo tar -xzf /var/backups/aion/<TIMESTAMP>/var-www-aionseg.tar.gz -C /var/www/
  
  # Backend rebuild
  cd /var/www/aionseg/backend/apps/backend-api
  npx tsc --skipLibCheck
  pm2 restart aionseg-api
  sudo systemctl reload nginx
'
```

### 4. Verify rollback
```bash
curl -fsS https://aionseg.co/api/health
ssh aion-vps 'pm2 list | grep -E "online|errored"'
```

## Feature Flag Rollback (instant, no deploy)

If a specific feature causes issues, disable its flag:
```bash
# Rebuild without the flag
pnpm exec vite build  # (without VITE_FF_* vars)
scp -r dist/* aion-vps:/var/www/aionseg/frontend/
ssh aion-vps 'sudo systemctl reload nginx'
```

## Git Rollback
```bash
git revert HEAD  # or git reset --hard <safe-tag>
# Then redeploy using the deploy runbook
```
