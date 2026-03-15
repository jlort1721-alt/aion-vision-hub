#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AION Vision Hub — Deploy / Update Script
# Run from /opt/aion/app or specify path
# ═══════════════════════════════════════════════════════════

set -euo pipefail

APP_DIR="${1:-/opt/aion/app}"
cd "$APP_DIR"

echo "═══════════════════════════════════════════"
echo " AION Vision Hub — Deploy"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════"

# Stop services gracefully
echo "[1/5] Stopping services..."
cd "$APP_DIR/backend"
docker compose -f docker-compose.prod.yml stop backend-api edge-gateway 2>/dev/null || true

# Install dependencies
echo "[2/5] Installing dependencies..."
pnpm install --frozen-lockfile --prod 2>/dev/null || pnpm install --prod

# Build backend
echo "[3/5] Building backend..."
npx --yes turbo run build

# Restart all services
echo "[4/5] Starting services..."
docker compose -f docker-compose.prod.yml up -d

# Wait for health checks
echo "[5/5] Waiting for services to be healthy..."
sleep 5

PASS=0
FAIL=0
for svc in "localhost:3000/health:API" "localhost:3100/health:Gateway" "localhost:9997/v3/paths:MediaMTX"; do
  URL=$(echo $svc | cut -d: -f1-2)
  NAME=$(echo $svc | cut -d: -f3)
  if curl -sf "http://$URL" >/dev/null 2>&1; then
    echo "  $NAME: OK"
    PASS=$((PASS+1))
  else
    echo "  $NAME: FAILED"
    FAIL=$((FAIL+1))
  fi
done

echo ""
if [ $FAIL -eq 0 ]; then
  echo "Deploy COMPLETE — all services healthy ($PASS/$((PASS+FAIL)))"
else
  echo "Deploy COMPLETE with issues — $FAIL service(s) unhealthy"
  echo "Check logs: docker compose -f docker-compose.prod.yml logs --tail=50"
fi
