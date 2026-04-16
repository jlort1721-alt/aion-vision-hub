#!/usr/bin/env bash
# =============================================================================
# AION Platform — Blue/Green Deploy
# -----------------------------------------------------------------------------
# Strategy:
#   1. Detect the currently LIVE color from nginx upstream symlink.
#   2. Build & start the IDLE color on alternate ports.
#   3. Run health checks + smoke tests against the idle color.
#   4. Atomically swap nginx upstream symlink -> reload nginx.
#   5. Drain & stop the old color after grace period.
#   6. On any failure: rollback symlink, keep old color running, exit non-zero.
#
# Usage:
#   ./deploy.sh --env production --run-id val-20260414-120000
#   ./deploy.sh --env production --skip-build       # hot reload only
#   ./deploy.sh --env production --force-color blue # override target
# =============================================================================
set -Eeuo pipefail
IFS=$'\n\t'

# ---- Config -----------------------------------------------------------------
APP_ROOT="${APP_ROOT:-/opt/aion}"
LOG_DIR="${LOG_DIR:-/var/log/aion}"
NGINX_UPSTREAMS_DIR="/etc/nginx/aion-upstreams"   # contains blue.conf and green.conf
NGINX_ACTIVE_LINK="/etc/nginx/conf.d/aion-upstream.conf"
PM2_ECOSYSTEM="${APP_ROOT}/ecosystem.config.js"
SMOKE_SCRIPT="${APP_ROOT}/validation/smoke.py"
HEALTH_URL_TEMPLATE="http://127.0.0.1:%d/api/health"
GRACE_SECONDS=45
DRAIN_SECONDS=30

ENV="production"
RUN_ID="deploy-$(date +%Y%m%d-%H%M%S)"
SKIP_BUILD=0
FORCE_COLOR=""

# ---- Args -------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)          ENV="$2"; shift 2 ;;
    --run-id)       RUN_ID="$2"; shift 2 ;;
    --skip-build)   SKIP_BUILD=1; shift ;;
    --force-color)  FORCE_COLOR="$2"; shift 2 ;;
    -h|--help)      sed -n '1,40p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

LOG_FILE="${LOG_DIR}/${RUN_ID}.deploy.log"
mkdir -p "$LOG_DIR" "$(dirname "$NGINX_ACTIVE_LINK")" "${APP_ROOT}/snapshots"

exec > >(tee -a "$LOG_FILE") 2>&1
log() { printf '[%s] [deploy] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

# ---- Traps for safety -------------------------------------------------------
SNAPSHOT_LINK_TARGET=""
rollback() {
  local rc=$?
  log "!! Trap fired (rc=$rc). Attempting rollback."
  if [[ -n "$SNAPSHOT_LINK_TARGET" && -e "$SNAPSHOT_LINK_TARGET" ]]; then
    ln -sfn "$SNAPSHOT_LINK_TARGET" "$NGINX_ACTIVE_LINK"
    nginx -t && nginx -s reload && log "Rolled back nginx upstream -> $(basename "$SNAPSHOT_LINK_TARGET")"
  fi
  exit "$rc"
}
trap rollback ERR INT TERM

# ---- Helpers ----------------------------------------------------------------
current_color() {
  if [[ -L "$NGINX_ACTIVE_LINK" ]]; then
    basename "$(readlink -f "$NGINX_ACTIVE_LINK")" .conf
  else
    echo "blue" # first deploy default
  fi
}

other_color() { [[ "$1" == "blue" ]] && echo "green" || echo "blue"; }

# API port mapping must match ecosystem.config.js
api_port_for() {
  case "$1" in
    blue)  echo 3000 ;;
    green) echo 3001 ;;
    *) die "Unknown color: $1" ;;
  esac
}

wait_healthy() {
  local port="$1" tries=30 url
  url="$(printf "$HEALTH_URL_TEMPLATE" "$port")"
  log "Waiting for health at $url"
  for ((i=1; i<=tries; i++)); do
    if curl -fsS --max-time 5 "$url" | grep -q '"status":"healthy"'; then
      log "Healthy after ${i} attempts."
      return 0
    fi
    sleep 2
  done
  die "Health check failed after $((tries*2))s at $url"
}

# ---- Begin deploy -----------------------------------------------------------
log "Run ID: $RUN_ID   env=$ENV   skip_build=$SKIP_BUILD"

LIVE="$(current_color)"
IDLE="${FORCE_COLOR:-$(other_color "$LIVE")}"
log "LIVE=$LIVE   IDLE=$IDLE (deploying into IDLE)"

SNAPSHOT_LINK_TARGET="${NGINX_UPSTREAMS_DIR}/${LIVE}.conf"

# ---- Build ------------------------------------------------------------------
if [[ "$SKIP_BUILD" -eq 0 ]]; then
  log "Installing deps & building monorepo…"
  cd "$APP_ROOT"
  pnpm install --frozen-lockfile
  pnpm -r --parallel build
  pnpm db:migrate
else
  log "Skipping build (--skip-build)"
fi

# ---- Start IDLE PM2 apps ----------------------------------------------------
log "Starting IDLE color ($IDLE) PM2 apps…"
IDLE_APPS=(
  "aion-api-${IDLE}"
  "aion-frontend-${IDLE}"
  "aion-agent-${IDLE}"
  "aion-model-router-${IDLE}"
  "aion-vision-hub-${IDLE}"
  "aion-comms-${IDLE}"
)
for app in "${IDLE_APPS[@]}"; do
  pm2 startOrReload "$PM2_ECOSYSTEM" --only "$app" --env "$ENV"
done

# Non-paired workers always run (not color-specific)
pm2 startOrReload "$PM2_ECOSYSTEM" --only "aion-worker,aion-scheduler" --env "$ENV"

# ---- Health check idle ------------------------------------------------------
wait_healthy "$(api_port_for "$IDLE")"

# ---- Smoke test against idle color (direct, bypassing nginx) ---------------
if [[ -f "$SMOKE_SCRIPT" ]]; then
  log "Running smoke tests against IDLE…"
  AION_SMOKE_BASE="http://127.0.0.1:$(api_port_for "$IDLE")" \
    python3 "$SMOKE_SCRIPT" --fast --label "idle-$IDLE" \
    || die "Smoke tests failed on IDLE color"
else
  log "No smoke.py present — skipping smoke (NOT recommended)."
fi

# ---- Atomic swap: nginx upstream symlink + reload --------------------------
log "Swapping nginx upstream: $LIVE -> $IDLE"
ln -sfn "${NGINX_UPSTREAMS_DIR}/${IDLE}.conf" "$NGINX_ACTIVE_LINK"
nginx -t || die "nginx -t failed after swap"
nginx -s reload
log "Nginx reloaded. Traffic now hitting $IDLE."

# ---- Post-swap verification via public domain ------------------------------
log "Verifying public endpoint…"
for url in "https://aionseg.co/api/health" "https://aionseg.co/login"; do
  if ! curl -fsS --max-time 10 -o /dev/null -w 'HTTP %{http_code}\n' "$url"; then
    die "Public verification failed: $url"
  fi
done

# ---- Drain + stop OLD color -------------------------------------------------
log "Draining OLD color ($LIVE) for ${DRAIN_SECONDS}s before stopping…"
sleep "$DRAIN_SECONDS"

OLD_APPS=(
  "aion-api-${LIVE}"
  "aion-frontend-${LIVE}"
  "aion-agent-${LIVE}"
  "aion-model-router-${LIVE}"
  "aion-vision-hub-${LIVE}"
  "aion-comms-${LIVE}"
)
for app in "${OLD_APPS[@]}"; do
  pm2 stop  "$app" || true
  pm2 reset "$app" || true
done
pm2 save

# ---- Done -------------------------------------------------------------------
trap - ERR INT TERM
log "✅ Deploy complete. Active color: $IDLE   (run-id: $RUN_ID)"
log "   Log: $LOG_FILE"

# ---- Summary JSON for CI ----------------------------------------------------
cat > "${APP_ROOT}/snapshots/${RUN_ID}.json" <<JSON
{
  "run_id":       "${RUN_ID}",
  "previous":     "${LIVE}",
  "active":       "${IDLE}",
  "finished_at":  "$(date -Is)",
  "log":          "${LOG_FILE}"
}
JSON
