#!/usr/bin/env bash
###############################################################################
# 05-validate-all.sh
#
# Final validation script for the AION platform.
# Checks build status, all services, database integrity, device samples,
# and prints a final PASS/FAIL verdict.
#
# Prerequisites:
#   - Run on the VPS where AION is deployed
#   - Node.js, pnpm, pm2, redis-cli, psql, curl available
#   - .env.production loaded or DATABASE_URL / REDIS_PASSWORD set
#
# Usage:
#   chmod +x 05-validate-all.sh
#   ./05-validate-all.sh
###############################################################################
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — adjust to match your VPS
# ---------------------------------------------------------------------------
PROJECT_ROOT="${PROJECT_ROOT:-/opt/aion}"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
API_URL="${API_URL:-http://localhost:3000}"
GO2RTC_URL="${GO2RTC_URL:-http://localhost:1984}"
FRONTEND_HTTPS_URL="${FRONTEND_HTTPS_URL:-https://aionseg.com}"
PM2_APP_NAME="${PM2_APP_NAME:-aion-backend}"
DB_NAME="${DB_NAME:-aion}"
DB_USER="${DB_USER:-aion}"

# Auth token for API endpoints (set via env or will be obtained via login)
API_TOKEN="${API_TOKEN:-}"
API_ADMIN_USER="${API_ADMIN_USER:-admin}"
API_ADMIN_PASS="${API_ADMIN_PASS:-}"

# ---------------------------------------------------------------------------
# Counters and state
# ---------------------------------------------------------------------------
TOTAL_CHECKS=0
PASS_CHECKS=0
FAIL_CHECKS=0
declare -a FAILURES=()

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
log()   { printf '\033[1;34m[CHECK]\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m[PASS]\033[0m  %s\n' "$*"; TOTAL_CHECKS=$((TOTAL_CHECKS+1)); PASS_CHECKS=$((PASS_CHECKS+1)); }
fail()  { printf '\033[1;31m[FAIL]\033[0m  %s\n' "$*"; TOTAL_CHECKS=$((TOTAL_CHECKS+1)); FAIL_CHECKS=$((FAIL_CHECKS+1)); FAILURES+=("$*"); }
warn()  { printf '\033[1;33m[WARN]\033[0m  %s\n' "$*"; }
sep()   { printf '\n%s\n\n' "════════════════════════════════════════════════════════════"; }

# Load .env.production if available
if [[ -f "${BACKEND_DIR}/.env.production" ]]; then
  set -a
  source "${BACKEND_DIR}/.env.production" 2>/dev/null || true
  set +a
fi

echo ""
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║           AION Platform — Final Validation                   ║"
echo "  ║           $(date)                      ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# 1. BUILD STATUS
# ═══════════════════════════════════════════════════════════════════════════
sep
log "1. Build Status (TypeScript type check)"

cd "${BACKEND_DIR}" 2>/dev/null || cd "${PROJECT_ROOT}"
if npx tsc --noEmit 2>/dev/null; then
  ok "tsc --noEmit: no type errors"
else
  fail "tsc --noEmit: type errors found"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 2. PM2 PROCESSES
# ═══════════════════════════════════════════════════════════════════════════
sep
log "2. PM2 Processes"

if command -v pm2 &>/dev/null; then
  PM2_STATUS=$(pm2 jlist 2>/dev/null || echo "[]")
  PM2_APP_STATUS=$(echo "${PM2_STATUS}" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try {
        const apps = JSON.parse(d);
        const app = apps.find(a => a.name === '${PM2_APP_NAME}');
        if (app) { console.log(app.pm2_env.status); }
        else { console.log('not_found'); }
      } catch { console.log('error'); }
    });
  " 2>/dev/null || echo "error")

  if [[ "${PM2_APP_STATUS}" == "online" ]]; then
    ok "PM2 ${PM2_APP_NAME}: online"
  elif [[ "${PM2_APP_STATUS}" == "not_found" ]]; then
    fail "PM2 ${PM2_APP_NAME}: not found in PM2 process list"
  else
    fail "PM2 ${PM2_APP_NAME}: status is '${PM2_APP_STATUS}' (expected 'online')"
  fi

  # Show all PM2 processes
  PM2_COUNT=$(echo "${PM2_STATUS}" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try { console.log(JSON.parse(d).length); } catch { console.log(0); }
    });
  " 2>/dev/null || echo "0")
  log "  Total PM2 processes: ${PM2_COUNT}"
else
  fail "PM2: command not found"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 3. REDIS PING
# ═══════════════════════════════════════════════════════════════════════════
sep
log "3. Redis Connectivity"

REDIS_PASS_ARG=""
if [[ -n "${REDIS_PASSWORD:-}" ]]; then
  REDIS_PASS_ARG="-a ${REDIS_PASSWORD}"
fi

REDIS_PONG=$(redis-cli ${REDIS_PASS_ARG} ping 2>/dev/null || echo "FAIL")
if [[ "${REDIS_PONG}" == "PONG" ]]; then
  ok "Redis PING: PONG"

  # Check some Redis stats
  REDIS_KEYS=$(redis-cli ${REDIS_PASS_ARG} DBSIZE 2>/dev/null | grep -oE '[0-9]+' || echo "?")
  log "  Redis keys: ${REDIS_KEYS}"
else
  fail "Redis PING: ${REDIS_PONG} (expected PONG)"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 4. GO2RTC STREAMS
# ═══════════════════════════════════════════════════════════════════════════
sep
log "4. go2rtc Streams"

GO2RTC_RESPONSE=$(curl -s --max-time 5 "${GO2RTC_URL}/api/streams" 2>/dev/null || echo "")

if [[ -n "${GO2RTC_RESPONSE}" ]]; then
  STREAM_COUNT=$(echo "${GO2RTC_RESPONSE}" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try { console.log(Object.keys(JSON.parse(d)).length); }
      catch { console.log(0); }
    });
  " 2>/dev/null || echo "0")

  if [[ "${STREAM_COUNT}" -gt 0 ]]; then
    ok "go2rtc: ${STREAM_COUNT} streams configured"
  else
    fail "go2rtc: 0 streams configured (expected > 0)"
  fi
else
  fail "go2rtc: API not responding at ${GO2RTC_URL}"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 5. API HEALTH + KEY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════
sep
log "5. API Health & Key Endpoints"

# -- /api/health --
HEALTH_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${API_URL}/api/health" 2>/dev/null || echo "000")
if [[ "${HEALTH_CODE}" == "200" ]]; then
  ok "GET /api/health: HTTP ${HEALTH_CODE}"
else
  fail "GET /api/health: HTTP ${HEALTH_CODE} (expected 200)"
fi

# -- Obtain auth token if not provided --
if [[ -z "${API_TOKEN}" && -n "${API_ADMIN_PASS}" ]]; then
  log "  Obtaining auth token via /api/auth/login..."
  LOGIN_RESPONSE=$(curl -s --max-time 10 \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${API_ADMIN_USER}\",\"password\":\"${API_ADMIN_PASS}\"}" \
    "${API_URL}/api/auth/login" 2>/dev/null || echo "{}")

  API_TOKEN=$(echo "${LOGIN_RESPONSE}" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try {
        const j = JSON.parse(d);
        console.log(j.token || j.accessToken || j.access_token || '');
      } catch { console.log(''); }
    });
  " 2>/dev/null || echo "")

  if [[ -n "${API_TOKEN}" ]]; then
    ok "Auth login: token obtained"
  else
    warn "Auth login: could not obtain token (endpoints requiring auth will be skipped)"
  fi
fi

# -- Authenticated endpoints --
AUTH_HEADER=""
if [[ -n "${API_TOKEN}" ]]; then
  AUTH_HEADER="Authorization: Bearer ${API_TOKEN}"
fi

declare -a ENDPOINTS=(
  "/api/sites"
  "/api/devices"
  "/api/cameras"
  "/api/residents"
  "/api/vehicles"
)

for EP in "${ENDPOINTS[@]}"; do
  if [[ -n "${AUTH_HEADER}" ]]; then
    EP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
      -H "${AUTH_HEADER}" \
      "${API_URL}${EP}" 2>/dev/null || echo "000")
  else
    EP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
      "${API_URL}${EP}" 2>/dev/null || echo "000")
  fi

  if [[ "${EP_CODE}" == "200" ]]; then
    ok "GET ${EP}: HTTP ${EP_CODE}"
  elif [[ "${EP_CODE}" == "401" && -z "${AUTH_HEADER}" ]]; then
    warn "GET ${EP}: HTTP 401 (no auth token available — skipping)"
  else
    fail "GET ${EP}: HTTP ${EP_CODE} (expected 200)"
  fi
done

# ═══════════════════════════════════════════════════════════════════════════
# 6. DATABASE TABLE COUNTS
# ═══════════════════════════════════════════════════════════════════════════
sep
log "6. Database Table Counts"

declare -a DB_TABLES=(
  "sites"
  "residents"
  "vehicles"
  "devices"
  "cameras"
  "ewelink_device_mappings"
)

DB_AVAILABLE=true
if ! psql -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" &>/dev/null; then
  fail "PostgreSQL: cannot connect to ${DB_NAME} as ${DB_USER}"
  DB_AVAILABLE=false
fi

if [[ "${DB_AVAILABLE}" == "true" ]]; then
  ok "PostgreSQL: connected to ${DB_NAME}"

  for TABLE in "${DB_TABLES[@]}"; do
    COUNT=$(psql -U "${DB_USER}" -d "${DB_NAME}" -tAc "
      SELECT COUNT(*) FROM ${TABLE};
    " 2>/dev/null || echo "ERROR")

    if [[ "${COUNT}" == "ERROR" ]]; then
      fail "Table '${TABLE}': query failed (table may not exist)"
    elif [[ "${COUNT}" -eq 0 ]]; then
      warn "Table '${TABLE}': 0 rows (empty)"
      # Count it as pass — empty is valid, just noteworthy
      ok "Table '${TABLE}': ${COUNT} rows (empty but exists)"
    else
      ok "Table '${TABLE}': ${COUNT} rows"
    fi
  done
fi

# ═══════════════════════════════════════════════════════════════════════════
# 7. SAMPLE ISAPI DEVICE CHECKS (3 devices)
# ═══════════════════════════════════════════════════════════════════════════
sep
log "7. Sample ISAPI Device Checks (3 devices)"

test_isapi_device() {
  local NAME="$1"
  local HOST="$2"
  local PORT="$3"
  local USER="$4"
  local PASS="$5"

  local URL="http://${HOST}:${PORT}/ISAPI/System/deviceInfo"
  local HTTP_CODE
  HTTP_CODE=$(curl -s --digest -u "${USER}:${PASS}" \
    --max-time 8 \
    --connect-timeout 8 \
    -o /dev/null \
    -w '%{http_code}' \
    "${URL}" 2>/dev/null) || HTTP_CODE="000"

  if [[ "${HTTP_CODE}" == "200" ]]; then
    ok "ISAPI ${NAME} (${HOST}:${PORT}): HTTP ${HTTP_CODE}"
  else
    fail "ISAPI ${NAME} (${HOST}:${PORT}): HTTP ${HTTP_CODE}"
  fi
}

# Sample 1: Torre Lucia DVR
test_isapi_device "Torre Lucia DVR" "181.205.215.210" "8010" "admin" "seg12345"

# Sample 2: San Nicolas NVR
test_isapi_device "San Nicolas NVR" "181.143.16.170" "8000" "admin" "Clave.seg2023"

# Sample 3: Portalegre NVR
test_isapi_device "Portalegre NVR" "200.58.214.114" "8000" "admin" "Clave.seg2023"

# ═══════════════════════════════════════════════════════════════════════════
# 8. FRONTEND HTTPS
# ═══════════════════════════════════════════════════════════════════════════
sep
log "8. Frontend HTTPS"

FRONTEND_CODE=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 \
  "${FRONTEND_HTTPS_URL}" 2>/dev/null || echo "000")

if [[ "${FRONTEND_CODE}" == "200" || "${FRONTEND_CODE}" == "304" ]]; then
  ok "Frontend HTTPS (${FRONTEND_HTTPS_URL}): HTTP ${FRONTEND_CODE}"
else
  fail "Frontend HTTPS (${FRONTEND_HTTPS_URL}): HTTP ${FRONTEND_CODE} (expected 200)"
fi

# Check SSL certificate expiry
if command -v openssl &>/dev/null; then
  DOMAIN=$(echo "${FRONTEND_HTTPS_URL}" | sed 's|https://||' | sed 's|/.*||')
  CERT_EXPIRY=$(echo | openssl s_client -servername "${DOMAIN}" -connect "${DOMAIN}:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || echo "unknown")

  if [[ "${CERT_EXPIRY}" != "unknown" ]]; then
    EXPIRY_EPOCH=$(date -j -f "%b %d %T %Y %Z" "${CERT_EXPIRY}" "+%s" 2>/dev/null || date -d "${CERT_EXPIRY}" "+%s" 2>/dev/null || echo "0")
    NOW_EPOCH=$(date "+%s")
    DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))

    if [[ ${DAYS_LEFT} -gt 14 ]]; then
      ok "SSL cert expires: ${CERT_EXPIRY} (${DAYS_LEFT} days left)"
    elif [[ ${DAYS_LEFT} -gt 0 ]]; then
      warn "SSL cert expires in ${DAYS_LEFT} days: ${CERT_EXPIRY}"
      fail "SSL certificate expires soon (${DAYS_LEFT} days)"
    else
      fail "SSL certificate has EXPIRED: ${CERT_EXPIRY}"
    fi
  else
    warn "Could not determine SSL certificate expiry"
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════
# 9. LAST GIT COMMIT
# ═══════════════════════════════════════════════════════════════════════════
sep
log "9. Last Git Commit"

cd "${PROJECT_ROOT}" 2>/dev/null || true
if git rev-parse --git-dir &>/dev/null; then
  LAST_COMMIT=$(git log --oneline -1 2>/dev/null || echo "unknown")
  LAST_COMMIT_DATE=$(git log -1 --format='%ci' 2>/dev/null || echo "unknown")
  CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

  ok "Branch: ${CURRENT_BRANCH}"
  ok "Last commit: ${LAST_COMMIT}"
  log "  Commit date: ${LAST_COMMIT_DATE}"

  # Check if there are uncommitted changes
  if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
    ok "Working tree: clean"
  else
    warn "Working tree has uncommitted changes"
  fi
else
  warn "Not a git repository at ${PROJECT_ROOT}"
fi

# ═══════════════════════════════════════════════════════════════════════════
# FINAL VERDICT
# ═══════════════════════════════════════════════════════════════════════════
sep
echo ""
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║                   VALIDATION RESULTS                         ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Total checks:  ${TOTAL_CHECKS}"
echo "  Passed:        ${PASS_CHECKS}"
echo "  Failed:        ${FAIL_CHECKS}"
echo ""

if [[ ${FAIL_CHECKS} -gt 0 ]]; then
  echo "  ┌──────────────────────────────────────────────────────────┐"
  echo "  │  FAILURES                                                 │"
  echo "  └──────────────────────────────────────────────────────────┘"
  echo ""
  for F in "${FAILURES[@]}"; do
    echo "    - ${F}"
  done
  echo ""
fi

echo ""
if [[ ${FAIL_CHECKS} -eq 0 ]]; then
  printf '  \033[1;42;97m  %-56s  \033[0m\n' ""
  printf '  \033[1;42;97m  %-56s  \033[0m\n' "VERDICT:  PASS"
  printf '  \033[1;42;97m  %-56s  \033[0m\n' "All ${TOTAL_CHECKS} checks passed. Platform is healthy."
  printf '  \033[1;42;97m  %-56s  \033[0m\n' ""
  echo ""
  exit 0
else
  printf '  \033[1;41;97m  %-56s  \033[0m\n' ""
  printf '  \033[1;41;97m  %-56s  \033[0m\n' "VERDICT:  FAIL"
  printf '  \033[1;41;97m  %-56s  \033[0m\n' "${FAIL_CHECKS} of ${TOTAL_CHECKS} checks failed. Review above."
  printf '  \033[1;41;97m  %-56s  \033[0m\n' ""
  echo ""
  exit 1
fi
