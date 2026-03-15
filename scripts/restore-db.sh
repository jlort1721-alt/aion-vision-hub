#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AION Vision Hub — Database Restore Script
# Usage: bash restore-db.sh [backup_file.sql.gz]
# ═══════════════════════════════════════════════════════════

set -euo pipefail

BACKUP_DIR="/opt/aion/backups"

if [ -n "${1:-}" ]; then
  BACKUP_FILE="$1"
else
  # Use most recent backup
  BACKUP_FILE=$(ls -t "$BACKUP_DIR"/aion_db_*.sql.gz 2>/dev/null | head -1)
  if [ -z "$BACKUP_FILE" ]; then
    echo "ERROR: No backup files found in $BACKUP_DIR"
    exit 1
  fi
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "═══════════════════════════════════════════"
echo " Database Restore"
echo " File: $(basename "$BACKUP_FILE") ($SIZE)"
echo "═══════════════════════════════════════════"
echo ""
echo "WARNING: This will REPLACE all data in the database!"
read -p "Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "[1/3] Stopping backend services..."
cd /opt/aion/app/backend
docker compose -f docker-compose.prod.yml stop backend-api edge-gateway 2>/dev/null || true

echo "[2/3] Restoring database..."
gunzip -c "$BACKUP_FILE" | docker exec -i $(docker ps -q --filter name=postgres) \
  psql -U aion -d aion_vision_hub --quiet

echo "[3/3] Restarting services..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "Restore COMPLETE from: $(basename "$BACKUP_FILE")"
echo "Verify: curl http://localhost:3000/health"
