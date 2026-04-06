#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# AION Vision Hub — Credential Rotation Script
# Rotates JWT_SECRET, REDIS_PASSWORD, SESSION_SECRET, COOKIE_SECRET
# Creates timestamped backup before any changes
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────
APP_DIR="${AION_APP_DIR:-/opt/aion}"
ENV_FILE="${APP_DIR}/.env"
BACKUP_DIR="${APP_DIR}/backups/credentials"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Secrets to rotate and their byte lengths
declare -A SECRET_LENGTHS=(
  [JWT_SECRET]=64
  [REDIS_PASSWORD]=32
  [SESSION_SECRET]=48
  [COOKIE_SECRET]=48
)

# ── Helpers ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "[$(date '+%H:%M:%S')] $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1" >&2; }

# ── Pre-flight checks ───────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  err "This script must be run as root (for Redis config and PM2 restart)"
  exit 1
fi

if [ ! -f "${ENV_FILE}" ]; then
  err ".env file not found at ${ENV_FILE}"
  exit 1
fi

command -v openssl   >/dev/null 2>&1 || { err "openssl not found"; exit 1; }
command -v redis-cli >/dev/null 2>&1 || { err "redis-cli not found"; exit 1; }
command -v pm2       >/dev/null 2>&1 || { err "pm2 not found"; exit 1; }

# ── 1. Backup current .env ──────────────────────────────────────
log "Step 1: Backing up current .env..."

mkdir -p "${BACKUP_DIR}"
cp "${ENV_FILE}" "${BACKUP_DIR}/.env.${TIMESTAMP}"
chmod 600 "${BACKUP_DIR}/.env.${TIMESTAMP}"
ok "Backup saved to ${BACKUP_DIR}/.env.${TIMESTAMP}"

# ── 2. Generate new secrets ─────────────────────────────────────
log "Step 2: Generating new secrets..."

declare -A NEW_SECRETS=()
declare -A OLD_SECRETS=()

for key in "${!SECRET_LENGTHS[@]}"; do
  bytes=${SECRET_LENGTHS[$key]}
  NEW_SECRETS[$key]=$(openssl rand -base64 "${bytes}" | tr -d '\n/+=')

  # Capture old value for summary
  OLD_SECRETS[$key]=$(grep -E "^${key}=" "${ENV_FILE}" | cut -d'=' -f2- | head -1 || echo "(not set)")
  ok "Generated ${key} (${bytes} bytes of entropy)"
done

# ── 3. Update Redis password ────────────────────────────────────
log "Step 3: Updating Redis password..."

CURRENT_REDIS_PASS=$(grep -E "^REDIS_PASSWORD=" "${ENV_FILE}" | cut -d'=' -f2- | head -1 || echo "")

if [ -n "${CURRENT_REDIS_PASS}" ]; then
  redis-cli -a "${CURRENT_REDIS_PASS}" CONFIG SET requirepass "${NEW_SECRETS[REDIS_PASSWORD]}" >/dev/null 2>&1 \
    || { err "Failed to update Redis password via CONFIG SET"; exit 1; }
else
  redis-cli CONFIG SET requirepass "${NEW_SECRETS[REDIS_PASSWORD]}" >/dev/null 2>&1 \
    || { err "Failed to update Redis password via CONFIG SET"; exit 1; }
fi

# Persist to redis.conf so it survives restart
if [ -f /etc/redis/redis.conf ]; then
  sed -i "s/^requirepass .*/requirepass ${NEW_SECRETS[REDIS_PASSWORD]}/" /etc/redis/redis.conf 2>/dev/null || true
fi

ok "Redis password updated (runtime + config)"

# ── 4. Update .env file ─────────────────────────────────────────
log "Step 4: Updating .env file..."

for key in "${!NEW_SECRETS[@]}"; do
  value="${NEW_SECRETS[$key]}"

  if grep -qE "^${key}=" "${ENV_FILE}"; then
    # Replace existing value
    sed -i "s|^${key}=.*|${key}=${value}|" "${ENV_FILE}"
  else
    # Append if not present
    echo "${key}=${value}" >> "${ENV_FILE}"
    warn "${key} was missing — appended to .env"
  fi
  ok "Updated ${key} in .env"
done

chmod 600 "${ENV_FILE}"

# ── 5. Restart PM2 processes ────────────────────────────────────
log "Step 5: Restarting PM2 processes..."

pm2 restart all --update-env >/dev/null 2>&1 \
  || { err "PM2 restart failed — secrets are updated but services may be down"; exit 1; }

# Wait briefly and verify
sleep 3
PM2_STATUS=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
procs = json.load(sys.stdin)
online = sum(1 for p in procs if p.get('pm2_env', {}).get('status') == 'online')
total = len(procs)
print(f'{online}/{total}')
" 2>/dev/null || echo "unknown")

ok "PM2 restarted (${PM2_STATUS} processes online)"

# ── Summary ──────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════"
echo "  CREDENTIAL ROTATION SUMMARY"
echo "════════════════════════════════════════════════════"
echo ""
echo "  Timestamp:  ${TIMESTAMP}"
echo "  Backup:     ${BACKUP_DIR}/.env.${TIMESTAMP}"
echo ""

for key in JWT_SECRET REDIS_PASSWORD SESSION_SECRET COOKIE_SECRET; do
  OLD_PREFIX="${OLD_SECRETS[$key]:0:8}"
  NEW_PREFIX="${NEW_SECRETS[$key]:0:8}"
  printf "  %-18s %s... → %s...\n" "${key}" "${OLD_PREFIX}" "${NEW_PREFIX}"
done

echo ""
echo "  PM2 status: ${PM2_STATUS} processes online"
echo ""
echo "════════════════════════════════════════════════════"
echo ""
warn "Remember: If external services use JWT_SECRET (e.g., Supabase Edge Functions), update them manually."
