#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# AION Vision Hub — Offsite S3 Backup Script
# Cron: 0 4 * * * /opt/aion/scripts/backup-s3.sh
# Dumps PostgreSQL, Redis, configs, and uploads to S3
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
WORK_DIR="/tmp/aion-backup-${TIMESTAMP}"
LOG_DIR="/var/log/aionseg"
LOG_FILE="${LOG_DIR}/backup.log"
S3_BUCKET="${S3_BACKUP_BUCKET:-s3://aion-backups}"
S3_PREFIX="${S3_BACKUP_PREFIX:-daily}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Paths
APP_DIR="${AION_APP_DIR:-/opt/aion}"
REDIS_RDB_PATH="${REDIS_RDB_PATH:-/var/lib/redis/dump.rdb}"
NGINX_CONF_DIR="/etc/nginx"
GO2RTC_CONFIG="${GO2RTC_CONFIG:-/opt/aion/go2rtc.yaml}"
ASTERISK_CONF_DIR="/etc/asterisk"
MOSQUITTO_CONF_DIR="/etc/mosquitto"
UPLOADS_DIR="${UPLOADS_DIR:-/opt/aion/uploads}"

# ── Helpers ──────────────────────────────────────────────────────
mkdir -p "${LOG_DIR}"

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" | tee -a "${LOG_FILE}"
}

cleanup() {
  log "Cleaning up temp directory ${WORK_DIR}..."
  rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

fail() {
  log "ERROR: $1"
  exit 1
}

# ── Pre-flight checks ───────────────────────────────────────────
log "═══ Starting offsite S3 backup ═══"
log "Timestamp: ${TIMESTAMP}"

command -v pg_dump  >/dev/null 2>&1 || fail "pg_dump not found in PATH"
command -v aws      >/dev/null 2>&1 || fail "aws cli not found in PATH"

# Verify required env vars for PostgreSQL
: "${SUPABASE_DB_HOST:?SUPABASE_DB_HOST is not set}"
: "${SUPABASE_DB_PASSWORD:?SUPABASE_DB_PASSWORD is not set}"

SUPABASE_DB_PORT="${SUPABASE_DB_PORT:-5432}"
SUPABASE_DB_NAME="${SUPABASE_DB_NAME:-postgres}"
SUPABASE_DB_USER="${SUPABASE_DB_USER:-postgres}"

mkdir -p "${WORK_DIR}"

# ── 1. PostgreSQL dump ───────────────────────────────────────────
log "1/5 Dumping PostgreSQL (${SUPABASE_DB_HOST}:${SUPABASE_DB_PORT}/${SUPABASE_DB_NAME})..."

export PGPASSWORD="${SUPABASE_DB_PASSWORD}"
pg_dump \
  -h "${SUPABASE_DB_HOST}" \
  -p "${SUPABASE_DB_PORT}" \
  -U "${SUPABASE_DB_USER}" \
  -d "${SUPABASE_DB_NAME}" \
  --no-owner --no-acl \
  --format=custom \
  --compress=6 \
  -f "${WORK_DIR}/postgres.dump" \
  || fail "pg_dump failed"
unset PGPASSWORD

PG_SIZE=$(du -h "${WORK_DIR}/postgres.dump" | cut -f1)
log "  PostgreSQL dump: ${PG_SIZE}"

# ── 2. Redis RDB snapshot ───────────────────────────────────────
log "2/5 Backing up Redis RDB..."

if command -v redis-cli >/dev/null 2>&1; then
  # Trigger a BGSAVE and wait for it to complete
  redis-cli BGSAVE >/dev/null 2>&1 || true
  sleep 2

  if [ -f "${REDIS_RDB_PATH}" ]; then
    cp "${REDIS_RDB_PATH}" "${WORK_DIR}/redis-dump.rdb"
    REDIS_SIZE=$(du -h "${WORK_DIR}/redis-dump.rdb" | cut -f1)
    log "  Redis RDB: ${REDIS_SIZE}"
  else
    log "  WARNING: Redis RDB not found at ${REDIS_RDB_PATH} — skipping"
  fi
else
  log "  WARNING: redis-cli not found — skipping Redis backup"
fi

# ── 3. Configuration files ──────────────────────────────────────
log "3/5 Backing up configuration files..."

CONFIG_DIR="${WORK_DIR}/configs"
mkdir -p "${CONFIG_DIR}"

# .env files
for envfile in "${APP_DIR}/.env" "${APP_DIR}/.env.production" "${APP_DIR}/backend/.env"; do
  if [ -f "${envfile}" ]; then
    cp "${envfile}" "${CONFIG_DIR}/$(basename "${envfile}").$(echo "${envfile}" | md5sum | cut -c1-8)"
    log "  Backed up: ${envfile}"
  fi
done

# nginx
if [ -d "${NGINX_CONF_DIR}" ]; then
  tar czf "${CONFIG_DIR}/nginx.tar.gz" -C "$(dirname "${NGINX_CONF_DIR}")" "$(basename "${NGINX_CONF_DIR}")" 2>/dev/null || true
  log "  Backed up: nginx configs"
fi

# go2rtc
if [ -f "${GO2RTC_CONFIG}" ]; then
  cp "${GO2RTC_CONFIG}" "${CONFIG_DIR}/go2rtc.yaml"
  log "  Backed up: go2rtc.yaml"
fi

# asterisk
if [ -d "${ASTERISK_CONF_DIR}" ]; then
  tar czf "${CONFIG_DIR}/asterisk.tar.gz" -C "$(dirname "${ASTERISK_CONF_DIR}")" "$(basename "${ASTERISK_CONF_DIR}")" 2>/dev/null || true
  log "  Backed up: asterisk configs"
fi

# mosquitto
if [ -d "${MOSQUITTO_CONF_DIR}" ]; then
  tar czf "${CONFIG_DIR}/mosquitto.tar.gz" -C "$(dirname "${MOSQUITTO_CONF_DIR}")" "$(basename "${MOSQUITTO_CONF_DIR}")" 2>/dev/null || true
  log "  Backed up: mosquitto configs"
fi

# PM2 ecosystem
for pm2file in "${APP_DIR}/ecosystem.config.js" "${APP_DIR}/ecosystem.config.cjs"; do
  if [ -f "${pm2file}" ]; then
    cp "${pm2file}" "${CONFIG_DIR}/"
    log "  Backed up: $(basename "${pm2file}")"
  fi
done

# ── 4. Uploads (floor-plans, faces) ─────────────────────────────
log "4/5 Backing up uploads directory..."

if [ -d "${UPLOADS_DIR}" ]; then
  tar czf "${WORK_DIR}/uploads.tar.gz" -C "$(dirname "${UPLOADS_DIR}")" "$(basename "${UPLOADS_DIR}")" 2>/dev/null || true
  UPLOADS_SIZE=$(du -h "${WORK_DIR}/uploads.tar.gz" | cut -f1)
  log "  Uploads archive: ${UPLOADS_SIZE}"
else
  log "  WARNING: Uploads directory not found at ${UPLOADS_DIR} — skipping"
fi

# ── 5. Upload to S3 ─────────────────────────────────────────────
log "5/5 Uploading to ${S3_BUCKET}/${S3_PREFIX}/${TIMESTAMP}/..."

aws s3 cp "${WORK_DIR}/" "${S3_BUCKET}/${S3_PREFIX}/${TIMESTAMP}/" \
  --recursive \
  --storage-class STANDARD_IA \
  --only-show-errors \
  || fail "S3 upload failed"

# Calculate total size
TOTAL_SIZE=$(du -sh "${WORK_DIR}" | cut -f1)
log "  Total uploaded: ${TOTAL_SIZE}"

# ── 6. Clean up old S3 backups ───────────────────────────────────
log "Cleaning S3 backups older than ${RETENTION_DAYS} days..."

CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y%m%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y%m%d)

aws s3 ls "${S3_BUCKET}/${S3_PREFIX}/" 2>/dev/null | awk '{print $2}' | tr -d '/' | while read -r folder; do
  FOLDER_DATE=$(echo "${folder}" | grep -oE '^[0-9]{8}' || true)
  if [ -n "${FOLDER_DATE}" ] && [ "${FOLDER_DATE}" -lt "${CUTOFF_DATE}" ] 2>/dev/null; then
    log "  Removing old backup: ${folder}"
    aws s3 rm "${S3_BUCKET}/${S3_PREFIX}/${folder}/" --recursive --only-show-errors || true
  fi
done

# ── Summary ──────────────────────────────────────────────────────
log "═══ Backup complete ═══"
log "  Location: ${S3_BUCKET}/${S3_PREFIX}/${TIMESTAMP}/"
log "  Total size: ${TOTAL_SIZE}"
log "  Duration: ${SECONDS}s"
