#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# AION Event Bridge → OpenClaw
# Escucha Redis Stream 'aion:events' y reenvía eventos criticos
# a OpenClaw via su API local (webhook-style)
#
# Instalar como servicio systemd:
#   sudo cp aion-event-bridge.service /etc/systemd/system/
#   sudo systemctl enable --now aion-event-bridge
#
# O ejecutar manualmente:
#   sudo -iu openclaw bash aion-event-bridge.sh
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

# Config
REDIS_HOST="127.0.0.1"
REDIS_PORT="6379"
REDIS_STREAM="aion:events"
OPENCLAW_API="http://127.0.0.1:18789"
GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-}"
POLL_INTERVAL=5  # seconds
LAST_ID="$"      # Start from new events only

# Read Redis password safely
REDIS_PASS=""
if [[ -f /opt/aion/app/backend/.env ]]; then
    REDIS_PASS=$(grep -m1 '^REDIS_PASSWORD=' /opt/aion/app/backend/.env 2>/dev/null | cut -d= -f2 || true)
fi

# Read gateway token from .env if not set
if [[ -z "$GATEWAY_TOKEN" && -f /home/openclaw/.openclaw/.env ]]; then
    GATEWAY_TOKEN=$(grep -m1 '^OPENCLAW_GATEWAY_TOKEN=' /home/openclaw/.openclaw/.env 2>/dev/null | cut -d= -f2 || true)
fi

redis_cmd() {
    if [[ -n "$REDIS_PASS" ]]; then
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASS" --no-auth-warning "$@" 2>/dev/null
    else
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" "$@" 2>/dev/null
    fi
}

# Severity filter: only forward these severities
FORWARD_SEVERITIES="critical emergency warning"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "=== AION Event Bridge started ==="
log "Stream: $REDIS_STREAM"
log "Polling interval: ${POLL_INTERVAL}s"
log "Forwarding severities: $FORWARD_SEVERITIES"

# Verify Redis connection
if ! redis_cmd ping | grep -q PONG; then
    log "ERROR: Cannot connect to Redis"
    exit 1
fi

# Main loop
while true; do
    # XREAD with block timeout (non-blocking polling)
    EVENTS=$(redis_cmd XREAD COUNT 10 BLOCK $((POLL_INTERVAL * 1000)) STREAMS "$REDIS_STREAM" "$LAST_ID" 2>/dev/null || true)

    if [[ -z "$EVENTS" || "$EVENTS" == "(nil)" ]]; then
        continue
    fi

    # Parse Redis XREAD output
    # Format: stream_name\nentry_id\nfield1\nvalue1\nfield2\nvalue2...
    # This is simplified — in production, use a proper Redis client
    echo "$EVENTS" | while IFS= read -r line; do
        # Try to extract event data
        if echo "$line" | grep -qE '^[0-9]+-[0-9]+$'; then
            LAST_ID="$line"
            continue
        fi

        # Check if this line contains severity info
        SEVERITY=$(echo "$line" | grep -oP '"severity"\s*:\s*"(critical|emergency|warning)"' | grep -oP '(critical|emergency|warning)' || true)

        if [[ -n "$SEVERITY" ]]; then
            EVENT_TYPE=$(echo "$line" | grep -oP '"type"\s*:\s*"[^"]*"' | cut -d'"' -f4 || echo "unknown")
            log "Forwarding $SEVERITY event: $EVENT_TYPE"

            # Forward to OpenClaw (if gateway is running and token is set)
            if [[ -n "$GATEWAY_TOKEN" ]]; then
                curl -sf --max-time 5 \
                    -X POST "${OPENCLAW_API}/api/events" \
                    -H "Authorization: Bearer ${GATEWAY_TOKEN}" \
                    -H "Content-Type: application/json" \
                    -d "{\"source\":\"aion\",\"severity\":\"${SEVERITY}\",\"type\":\"${EVENT_TYPE}\",\"raw\":$(echo "$line" | jq -Rs '.')}" \
                    2>/dev/null || log "WARN: Could not forward to OpenClaw"
            fi
        fi
    done

    sleep 1
done
