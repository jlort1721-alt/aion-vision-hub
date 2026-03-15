#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AION Vision Hub — Package Deploy Tarball
# Creates a production-ready tarball for VPS deployment
# ═══════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATE=$(date '+%Y%m%d-%H%M%S')
TARBALL="aion-deploy-${DATE}.tar.gz"

cd "$PROJECT_DIR"

echo "═══════════════════════════════════════════"
echo " AION Vision Hub — Package Deploy"
echo "═══════════════════════════════════════════"

# Verify builds exist
echo "[1/3] Verifying builds..."
[ -d "dist" ] || { echo "ERROR: Frontend dist/ not found. Run 'npm run build' first."; exit 1; }
[ -f "dist/index.html" ] || { echo "ERROR: dist/index.html not found."; exit 1; }
[ -d "backend/apps/backend-api/dist" ] || { echo "ERROR: Backend build not found. Run 'pnpm build' in backend/."; exit 1; }
[ -d "backend/apps/edge-gateway/dist" ] || { echo "ERROR: Gateway build not found."; exit 1; }

echo "  Frontend: $(du -sh dist/ | cut -f1)"
echo "  Backend API: $(du -sh backend/apps/backend-api/dist/ | cut -f1)"
echo "  Edge Gateway: $(du -sh backend/apps/edge-gateway/dist/ | cut -f1)"

# Create tarball
echo "[2/3] Creating tarball: $TARBALL"
tar czf "$TARBALL" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.turbo' \
  --exclude='src' \
  --exclude='__tests__' \
  --exclude='*.test.*' \
  --exclude='*.spec.*' \
  --exclude='.env.example' \
  dist/ \
  backend/package.json \
  backend/pnpm-lock.yaml \
  backend/pnpm-workspace.yaml \
  backend/turbo.json \
  backend/apps/backend-api/package.json \
  backend/apps/backend-api/dist/ \
  backend/apps/edge-gateway/package.json \
  backend/apps/edge-gateway/dist/ \
  backend/packages/common-utils/package.json \
  backend/packages/common-utils/dist/ \
  backend/packages/device-adapters/package.json \
  backend/packages/device-adapters/dist/ \
  backend/packages/shared-contracts/package.json \
  backend/packages/shared-contracts/dist/ \
  backend/docker-compose.prod.yml \
  backend/.env \
  .env \
  scripts/ \
  2>/dev/null

echo "[3/3] Package complete!"
echo "  File: $TARBALL"
echo "  Size: $(du -sh "$TARBALL" | cut -f1)"
echo ""
echo "Deploy with:"
echo "  scp $TARBALL root@VPS_IP:/opt/aion/"
echo "  ssh root@VPS_IP 'cd /opt/aion && tar xzf $TARBALL -C app/ && cd app/backend && pnpm install --prod'"
