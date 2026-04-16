#!/usr/bin/env bash
# =============================================================================
# drain-app.sh — Gracefully drain a stateful PM2 app before stopping it.
# -----------------------------------------------------------------------------
# Polls the app's /health endpoint with ?drain=1 to signal it should:
#   1. Stop accepting new work
#   2. Finish in-flight requests/jobs
#   3. Return 503 once drained
#
# Then issues PM2 stop with a generous kill_timeout.
#
# Usage:
#   ./drain-app.sh aion-n8n-blue 60      # drain n8n-blue with 60s timeout
#   ./drain-app.sh aion-snapshot-blue 120
# =============================================================================
set -Eeuo pipefail

APP_NAME="${1:?Usage: $0 <app-name> [timeout-seconds]}"
TIMEOUT="${2:-60}"

log() { printf '[drain] %s\n' "$*"; }

# Get app port from PM2 env
PORT="$(pm2 jlist | jq -r --arg n "$APP_NAME" '
  .[] | select(.name == $n) | .pm2_env.PORT // .pm2_env.env.PORT // empty
')"

if [[ -z "$PORT" ]]; then
  log "ERROR: cannot determine port for $APP_NAME"
  exit 1
fi

HEALTH_URL="http://127.0.0.1:${PORT}/health"

# 1. Signal drain
log "Signaling drain to $APP_NAME on port $PORT..."
curl -fsS -X POST "${HEALTH_URL}?action=drain" \
  -H 'X-Drain-Reason: deploy' \
  --max-time 5 \
  || log "  (drain signal endpoint not implemented — proceeding with timeout)"

# 2. Poll until 503 (drained) or timeout
log "Waiting up to ${TIMEOUT}s for in-flight to finish..."
START="$(date +%s)"
while true; do
  ELAPSED=$(( $(date +%s) - START ))
  if [[ $ELAPSED -ge $TIMEOUT ]]; then
    log "Timeout reached. Forcing stop."
    break
  fi

  CODE="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 3 "$HEALTH_URL" 2>/dev/null || echo "000")"
  case "$CODE" in
    503) log "  drained (503). Safe to stop."; break ;;
    200) log "  still serving (200), elapsed=${ELAPSED}s" ;;
    000) log "  not responding, assuming dead. Proceeding."; break ;;
    *)   log "  http=$CODE, elapsed=${ELAPSED}s" ;;
  esac
  sleep 2
done

# 3. Stop via PM2 (with kill_timeout from ecosystem config respected)
log "Stopping $APP_NAME via PM2..."
pm2 stop "$APP_NAME"
log "Done."
