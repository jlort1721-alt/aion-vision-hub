#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════
# AION Vision Hub — Production Deployment Script
# Domain: aiosystem.co | VPS: 3.128.43.140
# ═══════════════════════════════════════════════════════════

VPS_HOST="ubuntu@3.128.43.140"
VPS_KEY="/Users/ADMIN/Downloads/aion-clave.pem"
REMOTE_DIR="/var/www/aion"
DOMAIN="aiosystem.co"

echo "══════════════════════════════════════════"
echo " AION Deploy → $DOMAIN"
echo "══════════════════════════════════════════"

# 1. Build frontend for production
echo "→ Building frontend..."
cd "$(dirname "$0")/.."
npm run build
echo "✓ Frontend built"

# 2. Build backend
echo "→ Building backend..."
cd backend/apps/backend-api
npm run build 2>/dev/null || npx tsc
cd ../../..
echo "✓ Backend built"

# 3. Sync files to VPS
echo "→ Syncing to VPS..."
rsync -avz --delete \
  -e "ssh -i $VPS_KEY -o StrictHostKeyChecking=no" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.local' \
  dist/ $VPS_HOST:$REMOTE_DIR/frontend/

rsync -avz \
  -e "ssh -i $VPS_KEY -o StrictHostKeyChecking=no" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'src' \
  backend/ $VPS_HOST:$REMOTE_DIR/backend/

echo "✓ Files synced"

# 4. Install dependencies and restart on VPS
echo "→ Installing dependencies on VPS..."
ssh -i $VPS_KEY $VPS_HOST << 'REMOTE'
  cd /var/www/aion/backend/apps/backend-api
  npm install --production 2>/dev/null || npm install

  # Restart with PM2
  pm2 restart aion-api 2>/dev/null || pm2 start dist/server.js --name aion-api --max-memory-restart 512M
  pm2 save

  echo "✓ Backend restarted"
REMOTE

echo ""
echo "══════════════════════════════════════════"
echo " ✓ Deployed to https://$DOMAIN"
echo "══════════════════════════════════════════"
