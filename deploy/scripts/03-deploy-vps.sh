#!/usr/bin/env bash
###############################################################################
# 03-deploy-vps.sh
#
# Full deployment script to run ON the VPS.
# Pulls latest code, installs deps, runs migrations, builds, restarts services,
# and performs health checks.
#
# Prerequisites:
#   - Run as the deploy user on the VPS
#   - pnpm, node, turbo, pm2, go2rtc installed
#   - PostgreSQL and Redis running
#   - .env.production in place
#
# Usage:
#   chmod +x 03-deploy-vps.sh
#   ./03-deploy-vps.sh
###############################################################################
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — adjust these paths to match your VPS layout
# ---------------------------------------------------------------------------
PROJECT_ROOT="${PROJECT_ROOT:-/opt/aion}"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
MIGRATIONS_DIR="${PROJECT_ROOT}/deploy/migrations"
GO2RTC_CONFIG_SRC="${PROJECT_ROOT}/deploy/go2rtc-hikvision.yaml"
GO2RTC_CONFIG_DST="/etc/go2rtc/go2rtc.yaml"
GO2RTC_BIN="/usr/local/bin/go2rtc"
PM2_APP_NAME="aion-backend"
API_URL="http://localhost:3000"
GO2RTC_URL="http://localhost:1984"
FRONTEND_URL="http://localhost:4173"

DEPLOY_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/tmp/deploy-${DEPLOY_TIMESTAMP}.log"

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
log()   { printf '\033[1;34m[DEPLOY %s]\033[0m %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "${LOG_FILE}"; }
warn()  { printf '\033[1;33m[WARN   %s]\033[0m %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "${LOG_FILE}"; }
err()   { printf '\033[1;31m[ERROR  %s]\033[0m %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "${LOG_FILE}"; }
ok()    { printf '\033[1;32m[OK     %s]\033[0m %s\n' "$(date +%H:%M:%S)" "$*" | tee -a "${LOG_FILE}"; }

cleanup() {
  if [[ $? -ne 0 ]]; then
    err "Deploy failed! See rollback instructions at the end of this script."
    echo ""
    echo "  ╔══════════════════════════════════════════════════════════╗"
    echo "  ║                   ROLLBACK INSTRUCTIONS                  ║"
    echo "  ╚══════════════════════════════════════════════════════════╝"
    echo ""
    echo "  1. Revert to the previous commit:"
    echo "       cd ${PROJECT_ROOT}"
    echo "       git log --oneline -5        # find the previous commit"
    echo "       git checkout <prev_commit>"
    echo ""
    echo "  2. Rebuild:"
    echo "       cd ${BACKEND_DIR} && pnpm install && pnpm run build"
    echo "       cd ${FRONTEND_DIR} && pnpm install && pnpm run build"
    echo ""
    echo "  3. Restart services:"
    echo "       pm2 restart ${PM2_APP_NAME}"
    echo "       sudo systemctl restart go2rtc"
    echo ""
    echo "  4. If migrations failed, restore from backup:"
    echo "       pg_restore -U aion -d aion /tmp/aion_pre_deploy_*.dump"
    echo ""
    echo "  5. Check logs:"
    echo "       pm2 logs ${PM2_APP_NAME} --lines 100"
    echo "       journalctl -u go2rtc --since '1 hour ago'"
    echo ""
    echo "  Deploy log saved to: ${LOG_FILE}"
  fi
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
log "=== AION Platform Deployment ==="
log "Timestamp: ${DEPLOY_TIMESTAMP}"
log "Project root: ${PROJECT_ROOT}"
log "Log file: ${LOG_FILE}"

if [[ ! -d "${PROJECT_ROOT}" ]]; then
  err "Project root ${PROJECT_ROOT} does not exist."
  exit 1
fi

cd "${PROJECT_ROOT}"

# Check required tools
for cmd in git pnpm node pm2; do
  if ! command -v "${cmd}" &>/dev/null; then
    err "Required command '${cmd}' not found."
    exit 1
  fi
done
ok "All required tools found."

# Record current state for potential rollback
CURRENT_COMMIT=$(git rev-parse HEAD)
log "Current commit before deploy: ${CURRENT_COMMIT}"

# ---------------------------------------------------------------------------
# Step 1: Pull latest code
# ---------------------------------------------------------------------------
log "Step 1/7: Pulling latest code from origin/main..."

git fetch origin
LOCAL_HEAD=$(git rev-parse HEAD)
REMOTE_HEAD=$(git rev-parse origin/main)

if [[ "${LOCAL_HEAD}" == "${REMOTE_HEAD}" ]]; then
  warn "Already up to date with origin/main (${LOCAL_HEAD})."
  warn "Continuing deploy anyway (rebuild + restart)."
else
  git pull origin main
  ok "Code pulled. New HEAD: $(git rev-parse --short HEAD)"
fi

NEW_COMMIT=$(git rev-parse HEAD)
log "Deploying commit: $(git log --oneline -1)"

# ---------------------------------------------------------------------------
# Step 2: Install backend dependencies
# ---------------------------------------------------------------------------
log "Step 2/7: Installing backend dependencies..."

cd "${BACKEND_DIR}"
pnpm install --frozen-lockfile 2>&1 | tail -5 | tee -a "${LOG_FILE}"
ok "Backend dependencies installed."

# ---------------------------------------------------------------------------
# Step 3: Run SQL migrations
# ---------------------------------------------------------------------------
log "Step 3/7: Running SQL migrations..."

cd "${PROJECT_ROOT}"

if [[ -d "${MIGRATIONS_DIR}" ]]; then
  MIGRATION_FILES=$(find "${MIGRATIONS_DIR}" -name '*.sql' -type f | sort)
  MIGRATION_COUNT=$(echo "${MIGRATION_FILES}" | grep -c '.' || true)

  if [[ ${MIGRATION_COUNT} -gt 0 ]]; then
    log "Found ${MIGRATION_COUNT} migration file(s)."

    # Create pre-deploy backup
    log "Creating pre-deploy database backup..."
    BACKUP_FILE="/tmp/aion_pre_deploy_${DEPLOY_TIMESTAMP}.dump"
    if pg_dump -U aion -d aion -Fc -f "${BACKUP_FILE}" 2>/dev/null; then
      ok "Database backup saved to ${BACKUP_FILE}"
    else
      warn "Database backup failed. Continuing anyway (pg_dump may not be available)."
    fi

    # Create migrations tracking table if it doesn't exist
    psql -U aion -d aion -c "
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    " 2>/dev/null || warn "Could not create _migrations table (may already exist)."

    # Run each migration if not already applied
    for MIG_FILE in ${MIGRATION_FILES}; do
      MIG_NAME=$(basename "${MIG_FILE}")

      ALREADY_APPLIED=$(psql -U aion -d aion -tAc "
        SELECT COUNT(*) FROM _migrations WHERE filename = '${MIG_NAME}';
      " 2>/dev/null || echo "0")

      if [[ "${ALREADY_APPLIED}" -gt 0 ]]; then
        log "  Skipping ${MIG_NAME} (already applied)"
        continue
      fi

      log "  Applying migration: ${MIG_NAME}..."
      if psql -U aion -d aion -f "${MIG_FILE}" 2>&1 | tee -a "${LOG_FILE}"; then
        psql -U aion -d aion -c "
          INSERT INTO _migrations (filename) VALUES ('${MIG_NAME}');
        " 2>/dev/null || true
        ok "  Migration ${MIG_NAME} applied."
      else
        err "  Migration ${MIG_NAME} FAILED. Aborting deploy."
        err "  Restore from backup: pg_restore -U aion -d aion ${BACKUP_FILE}"
        exit 1
      fi
    done
    ok "All migrations applied."
  else
    log "No .sql migration files found in ${MIGRATIONS_DIR}."
  fi
else
  log "Migrations directory ${MIGRATIONS_DIR} does not exist. Skipping."
fi

# ---------------------------------------------------------------------------
# Step 4: Build backend (turbo)
# ---------------------------------------------------------------------------
log "Step 4/7: Building backend with turbo..."

cd "${BACKEND_DIR}"
if command -v turbo &>/dev/null; then
  turbo run build 2>&1 | tail -10 | tee -a "${LOG_FILE}"
else
  warn "turbo not found globally, trying npx..."
  npx turbo run build 2>&1 | tail -10 | tee -a "${LOG_FILE}"
fi
ok "Backend built."

# ---------------------------------------------------------------------------
# Step 5: Build frontend (vite)
# ---------------------------------------------------------------------------
log "Step 5/7: Building frontend with vite..."

cd "${FRONTEND_DIR}"
pnpm install --frozen-lockfile 2>&1 | tail -5 | tee -a "${LOG_FILE}"
pnpm run build 2>&1 | tail -10 | tee -a "${LOG_FILE}"
ok "Frontend built."

# ---------------------------------------------------------------------------
# Step 6: Copy go2rtc config and restart services
# ---------------------------------------------------------------------------
log "Step 6/7: Updating go2rtc config and restarting services..."

cd "${PROJECT_ROOT}"

# Copy go2rtc config
if [[ -f "${GO2RTC_CONFIG_SRC}" ]]; then
  if [[ -d "$(dirname "${GO2RTC_CONFIG_DST}")" ]]; then
    sudo cp "${GO2RTC_CONFIG_SRC}" "${GO2RTC_CONFIG_DST}"
    ok "go2rtc config copied to ${GO2RTC_CONFIG_DST}"
  else
    warn "go2rtc config directory does not exist. Skipping config copy."
  fi
else
  warn "go2rtc config source not found at ${GO2RTC_CONFIG_SRC}."
fi

# Restart go2rtc
if systemctl is-active --quiet go2rtc 2>/dev/null; then
  log "Restarting go2rtc via systemd..."
  sudo systemctl restart go2rtc
  sleep 2
  if systemctl is-active --quiet go2rtc; then
    ok "go2rtc restarted and running."
  else
    err "go2rtc failed to start after restart."
    journalctl -u go2rtc --since '30 seconds ago' --no-pager | tail -20 | tee -a "${LOG_FILE}"
  fi
elif pgrep -x go2rtc &>/dev/null; then
  log "Restarting go2rtc (process-based)..."
  sudo pkill go2rtc || true
  sleep 1
  nohup sudo "${GO2RTC_BIN}" -config "${GO2RTC_CONFIG_DST}" &>/dev/null &
  sleep 2
  if pgrep -x go2rtc &>/dev/null; then
    ok "go2rtc restarted."
  else
    err "go2rtc failed to start."
  fi
else
  warn "go2rtc is not running. Starting it..."
  nohup sudo "${GO2RTC_BIN}" -config "${GO2RTC_CONFIG_DST}" &>/dev/null &
  sleep 2
fi

# Restart PM2 backend
log "Restarting PM2 app: ${PM2_APP_NAME}..."
if pm2 describe "${PM2_APP_NAME}" &>/dev/null; then
  pm2 restart "${PM2_APP_NAME}" 2>&1 | tee -a "${LOG_FILE}"
else
  warn "PM2 app '${PM2_APP_NAME}' not found. Starting it..."
  cd "${BACKEND_DIR}"
  pm2 start dist/index.js --name "${PM2_APP_NAME}" 2>&1 | tee -a "${LOG_FILE}"
fi
sleep 3
ok "PM2 restart issued."

# Save PM2 state
pm2 save 2>&1 | tee -a "${LOG_FILE}"

# ---------------------------------------------------------------------------
# Step 7: Health checks
# ---------------------------------------------------------------------------
log "Step 7/7: Running health checks..."

HEALTH_PASS=0
HEALTH_FAIL=0

# -- API health check --
log "  Checking API health..."
API_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${API_URL}/api/health" 2>/dev/null || echo "000")
if [[ "${API_STATUS}" == "200" ]]; then
  ok "  API health: HTTP ${API_STATUS}"
  HEALTH_PASS=$((HEALTH_PASS + 1))
else
  err "  API health: HTTP ${API_STATUS} (expected 200)"
  HEALTH_FAIL=$((HEALTH_FAIL + 1))
  pm2 logs "${PM2_APP_NAME}" --lines 20 --nostream 2>/dev/null | tail -10 | tee -a "${LOG_FILE}"
fi

# -- go2rtc streams count --
log "  Checking go2rtc streams..."
GO2RTC_RESPONSE=$(curl -s --max-time 10 "${GO2RTC_URL}/api/streams" 2>/dev/null || echo "{}")
STREAM_COUNT=$(echo "${GO2RTC_RESPONSE}" | node -e "
  let data = '';
  process.stdin.on('data', c => data += c);
  process.stdin.on('end', () => {
    try { console.log(Object.keys(JSON.parse(data)).length); }
    catch { console.log(0); }
  });
" 2>/dev/null || echo "0")

if [[ "${STREAM_COUNT}" -gt 0 ]]; then
  ok "  go2rtc streams: ${STREAM_COUNT} configured"
  HEALTH_PASS=$((HEALTH_PASS + 1))
else
  err "  go2rtc streams: ${STREAM_COUNT} (expected > 0)"
  HEALTH_FAIL=$((HEALTH_FAIL + 1))
fi

# -- Frontend HTTP check --
log "  Checking frontend..."
# Try common frontend ports
FRONTEND_STATUS="000"
for FPORT in 4173 5173 80 443; do
  FRONTEND_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:${FPORT}" 2>/dev/null || echo "000")
  if [[ "${FRONTEND_STATUS}" == "200" || "${FRONTEND_STATUS}" == "304" ]]; then
    ok "  Frontend: HTTP ${FRONTEND_STATUS} on port ${FPORT}"
    HEALTH_PASS=$((HEALTH_PASS + 1))
    break
  fi
done
if [[ "${FRONTEND_STATUS}" != "200" && "${FRONTEND_STATUS}" != "304" ]]; then
  # Try via nginx on HTTPS
  FRONTEND_STATUS=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 5 "https://localhost" 2>/dev/null || echo "000")
  if [[ "${FRONTEND_STATUS}" == "200" || "${FRONTEND_STATUS}" == "304" ]]; then
    ok "  Frontend: HTTP ${FRONTEND_STATUS} via HTTPS/nginx"
    HEALTH_PASS=$((HEALTH_PASS + 1))
  else
    err "  Frontend: HTTP ${FRONTEND_STATUS} (expected 200)"
    HEALTH_FAIL=$((HEALTH_FAIL + 1))
  fi
fi

# -- Redis ping --
log "  Checking Redis..."
REDIS_PONG=$(redis-cli ping 2>/dev/null || echo "FAIL")
if [[ "${REDIS_PONG}" == "PONG" ]]; then
  ok "  Redis: PONG"
  HEALTH_PASS=$((HEALTH_PASS + 1))
else
  # Try with auth from env
  if [[ -f "${BACKEND_DIR}/.env.production" ]]; then
    REDIS_PASS=$(grep -oP 'REDIS_PASSWORD=\K.*' "${BACKEND_DIR}/.env.production" 2>/dev/null || true)
    if [[ -n "${REDIS_PASS}" ]]; then
      REDIS_PONG=$(redis-cli -a "${REDIS_PASS}" ping 2>/dev/null || echo "FAIL")
    fi
  fi
  if [[ "${REDIS_PONG}" == "PONG" ]]; then
    ok "  Redis: PONG (with auth)"
    HEALTH_PASS=$((HEALTH_PASS + 1))
  else
    err "  Redis: ${REDIS_PONG} (expected PONG)"
    HEALTH_FAIL=$((HEALTH_FAIL + 1))
  fi
fi

# ---------------------------------------------------------------------------
# Deploy summary
# ---------------------------------------------------------------------------
echo ""
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║                   DEPLOYMENT SUMMARY                        ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Timestamp:      ${DEPLOY_TIMESTAMP}"
echo "  Previous commit: ${CURRENT_COMMIT:0:12}"
echo "  Deployed commit: ${NEW_COMMIT:0:12} — $(git log --oneline -1 "${NEW_COMMIT}")"
echo "  Health checks:   ${HEALTH_PASS} passed, ${HEALTH_FAIL} failed"
echo "  Log file:        ${LOG_FILE}"
echo ""

if [[ ${HEALTH_FAIL} -gt 0 ]]; then
  err "Deploy completed with ${HEALTH_FAIL} health check failure(s)."
  echo ""
  echo "  ROLLBACK INSTRUCTIONS:"
  echo "  ──────────────────────"
  echo "  1. git checkout ${CURRENT_COMMIT}"
  echo "  2. cd ${BACKEND_DIR} && pnpm install && turbo run build"
  echo "  3. cd ${FRONTEND_DIR} && pnpm install && pnpm run build"
  echo "  4. pm2 restart ${PM2_APP_NAME}"
  echo "  5. sudo systemctl restart go2rtc"
  echo "  6. If DB migrations failed:"
  echo "       pg_restore -U aion -d aion -c /tmp/aion_pre_deploy_${DEPLOY_TIMESTAMP}.dump"
  echo ""
  exit 1
else
  ok "Deploy completed successfully. All health checks passed."
fi
