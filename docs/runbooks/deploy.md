# Deploy Runbook — AION Vision Hub

## Prerequisites

- SSH access: `ssh aion-vps` (alias for ubuntu@18.230.40.6 with clave-demo-aion.pem)
- Node 20+ and pnpm 9+ locally
- All tests passing: `pnpm --filter @aion/backend-api test`

## Automated Deploy (via GitHub Actions)

1. Create and push a release tag:
   ```bash
   git tag -a "release/aion-vYYYY.MM.DD" -m "Release description"
   git push origin --tags
   ```
2. The `deploy-production.yml` workflow triggers automatically.
3. It: builds → tests → deploys frontend + backend → applies migrations → health checks.
4. If health check fails, the `rollback` job runs automatically.

## Manual Deploy (SCP method — current)

### 1. Backup
```bash
ssh aion-vps '
  TS=$(date +%Y%m%d-%H%M%S)
  sudo mkdir -p /var/backups/aion/$TS
  sudo chown ubuntu:ubuntu /var/backups/aion/$TS
  sudo -u postgres pg_dump aionseg_prod -Fc > /var/backups/aion/$TS/pre-deploy.dump
  echo "Backup: /var/backups/aion/$TS"
'
```

### 2. Build frontend
```bash
VITE_FF_LIVE_VIEW_AI_OVERLAY=true \
VITE_FF_LIVE_VIEW_PTZ_INLINE=true \
VITE_FF_LIVE_VIEW_FLOOR_PLAN=true \
VITE_FF_LIVE_VIEW_SCENE_COMPOSER=true \
VITE_FF_LIVE_VIEW_AI_COPILOT=true \
VITE_FF_LIVE_VIEW_RECORDING=true \
pnpm exec vite build
```

### 3. Deploy frontend
```bash
scp -r -i ~/.ssh/clave-demo-aion.pem dist/* ubuntu@18.230.40.6:/var/www/aionseg/frontend/
ssh aion-vps 'sudo systemctl reload nginx'
```

### 4. Deploy backend
```bash
scp -r -i ~/.ssh/clave-demo-aion.pem backend/apps/backend-api/src/ ubuntu@18.230.40.6:/var/www/aionseg/backend/apps/backend-api/src/
ssh aion-vps 'cd /var/www/aionseg/backend/apps/backend-api && npx tsc --skipLibCheck && pm2 restart aionseg-api'
```

### 5. Apply migrations
```bash
ssh aion-vps '
  for f in /var/www/aionseg/backend/apps/backend-api/src/db/migrations/*.sql; do
    VER=$(basename "$f" | cut -d_ -f1)
    EXISTS=$(sudo -u postgres psql aionseg_prod -t -c "SELECT 1 FROM schema_migrations WHERE version='"'"'$VER'"'"';" | tr -d " ")
    [ "$EXISTS" != "1" ] && sudo -u postgres psql aionseg_prod -f "$f"
  done
'
```

### 6. Health check
```bash
curl -fsS https://aionseg.co/api/health
ssh aion-vps 'pm2 list | grep -c online'
```

## Verify
- Frontend: `curl https://aionseg.co/ | grep 'index-'` — new hash
- API: `curl https://aionseg.co/api/health` — healthy
- PM2: 28+ online, 0 errored
- Logs: `ssh aion-vps 'pm2 logs aionseg-api --lines 20 --nostream'` — no errors
