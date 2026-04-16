#!/usr/bin/env bash
# =============================================================================
# AION Platform — Rollback
# -----------------------------------------------------------------------------
# Instantly switches nginx upstream back to the previous color and restarts
# those PM2 apps if they were stopped by deploy.sh's drain step.
#
# Usage:
#   ./rollback.sh                            # rollback to "other color"
#   ./rollback.sh --to-color blue
#   ./rollback.sh --to-snapshot val-20260414-120000   # read snapshot json
# =============================================================================
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-/opt/aion}"
LOG_DIR="${LOG_DIR:-/var/log/aion}"
NGINX_UPSTREAMS_DIR="/etc/nginx/aion-upstreams"
NGINX_ACTIVE_LINK="/etc/nginx/conf.d/aion-upstream.conf"
PM2_ECOSYSTEM="${APP_ROOT}/ecosystem.config.js"

TARGET_COLOR=""
SNAPSHOT_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --to-color)    TARGET_COLOR="$2"; shift 2 ;;
    --to-snapshot) SNAPSHOT_ID="$2"; shift 2 ;;
    -h|--help) sed -n '1,25p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

LOG_FILE="${LOG_DIR}/rollback-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1
log() { printf '[%s] [rollback] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

current_color() {
  [[ -L "$NGINX_ACTIVE_LINK" ]] && basename "$(readlink -f "$NGINX_ACTIVE_LINK")" .conf || echo "blue"
}
other_color() { [[ "$1" == "blue" ]] && echo "green" || echo "blue"; }

# Resolve target color
if [[ -n "$SNAPSHOT_ID" ]]; then
  SNAP="${APP_ROOT}/snapshots/${SNAPSHOT_ID}.json"
  [[ -f "$SNAP" ]] || die "Snapshot not found: $SNAP"
  TARGET_COLOR="$(jq -r '.previous' "$SNAP")"
  log "Rolling back to snapshot $SNAPSHOT_ID → color=$TARGET_COLOR"
fi

CURRENT="$(current_color)"
if [[ -z "$TARGET_COLOR" ]]; then
  TARGET_COLOR="$(other_color "$CURRENT")"
fi

[[ "$TARGET_COLOR" == "blue" || "$TARGET_COLOR" == "green" ]] \
  || die "Invalid target color: $TARGET_COLOR"

log "Current active: $CURRENT   → rolling back to: $TARGET_COLOR"

# Bring target color PM2 apps back up (they were stopped after drain)
APPS=(
  "aion-api-${TARGET_COLOR}"
  "aion-frontend-${TARGET_COLOR}"
  "aion-agent-${TARGET_COLOR}"
  "aion-model-router-${TARGET_COLOR}"
  "aion-vision-hub-${TARGET_COLOR}"
  "aion-comms-${TARGET_COLOR}"
)
for app in "${APPS[@]}"; do
  pm2 startOrReload "$PM2_ECOSYSTEM" --only "$app" --env production
done

# Wait for api health
TARGET_PORT=$([[ "$TARGET_COLOR" == "blue" ]] && echo 3000 || echo 3001)
for i in {1..20}; do
  curl -fsS --max-time 5 "http://127.0.0.1:${TARGET_PORT}/api/health" | grep -q '"status":"healthy"' && break
  sleep 2
done

# Atomic nginx swap
ln -sfn "${NGINX_UPSTREAMS_DIR}/${TARGET_COLOR}.conf" "$NGINX_ACTIVE_LINK"
nginx -t || die "nginx -t failed on rollback"
nginx -s reload

# Public sanity
curl -fsS --max-time 10 "https://aionseg.co/api/health" \
  | grep -q '"status":"healthy"' \
  || die "Public /api/health NOT healthy after rollback"

pm2 save
log "✅ Rollback complete. Active color: $TARGET_COLOR"
