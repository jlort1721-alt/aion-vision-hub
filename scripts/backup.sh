#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AION Vision Hub — Database Backup Script
# Cron: 0 3 * * * /opt/aion/scripts/backup.sh
# ═══════════════════════════════════════════════════════════

set -euo pipefail

BACKUP_DIR="/opt/aion/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/aion_db_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting backup..."

# Backup via Docker PostgreSQL container
if docker ps --format '{{.Names}}' | grep -q postgres; then
  docker exec $(docker ps -q --filter name=postgres) \
    pg_dump -U aion -d aion_vision_hub --no-owner --no-acl \
    | gzip > "$BACKUP_FILE"

  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date)] Backup created: $BACKUP_FILE ($SIZE)"
else
  echo "[$(date)] ERROR: PostgreSQL container not running"
  exit 1
fi

# Rotate old backups
echo "[$(date)] Cleaning backups older than ${RETENTION_DAYS} days..."
DELETED=$(find "$BACKUP_DIR" -name "aion_db_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
echo "[$(date)] Deleted $DELETED old backup(s)"

# Show remaining backups
TOTAL=$(ls -1 "$BACKUP_DIR"/aion_db_*.sql.gz 2>/dev/null | wc -l)
echo "[$(date)] Total backups: $TOTAL"
echo "[$(date)] Backup complete"
