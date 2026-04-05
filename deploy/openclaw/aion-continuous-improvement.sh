#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# AION Continuous Improvement Agent
# Ciclo 24/7: Monitor → Analyze → Plan → Implement → Test → Deploy
#
# Este script es el loop principal. Cada iteracion:
# 1. Recoge estado de salud, logs, errores, metricas
# 2. Envia analisis al agente aion-improver de OpenClaw
# 3. El agente decide si hay mejoras por hacer
# 4. Si hay, ejecuta el ciclo de desarrollo
#
# Intervalo: 30 minutos (configurable)
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

INTERVAL="${IMPROVEMENT_INTERVAL:-1800}"  # 30 minutes
PLANS_DIR="/home/openclaw/devops/plans"
REPORTS_DIR="/home/openclaw/devops/reports"
OPENCLAW_API="http://127.0.0.1:18789"
GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-}"

mkdir -p "$PLANS_DIR" "$REPORTS_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Read gateway token from .env
if [[ -z "$GATEWAY_TOKEN" && -f /home/openclaw/.openclaw/.env ]]; then
    GATEWAY_TOKEN=$(grep -m1 '^OPENCLAW_GATEWAY_TOKEN=' /home/openclaw/.openclaw/.env 2>/dev/null | cut -d= -f2 || true)
fi

log "=== AION Continuous Improvement Agent Started ==="
log "Interval: ${INTERVAL}s"
log "Plans: ${PLANS_DIR}"

ITERATION=0

while true; do
    ITERATION=$((ITERATION + 1))
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    REPORT_FILE="${REPORTS_DIR}/analysis-${TIMESTAMP}.json"

    log "--- Iteration #${ITERATION} ---"

    # ── 1. COLLECT: Gather platform state ─────────────────────
    log "Phase 1: Collecting platform state..."

    # Health check (JSON)
    HEALTH_JSON=$(sudo /usr/local/sbin/aion-health json 2>/dev/null || echo '{"errors":99}')

    # Recent errors in logs
    RECENT_ERRORS=$(sudo /usr/local/sbin/aion-logs errors 30 2>/dev/null | head -50 || echo "")

    # Internal agent status
    AGENT_STATUS=$(sudo /usr/local/sbin/aion-internal-agent status 2>/dev/null | head -100 || echo "{}")

    # Proactive alerts
    PROACTIVE=$(sudo /usr/local/sbin/aion-internal-agent proactive 2>/dev/null | head -50 || echo "[]")

    # Disk usage
    DISK=$(sudo /usr/local/sbin/aion-disk-usage 2>/dev/null | head -20 || echo "")

    # PM2 restart counts (high restarts = stability issue)
    PM2_RESTARTS=$(su - ubuntu -c "pm2 jlist" 2>/dev/null | jq '[.[] | {name, restarts: .pm2_env.restart_time}]' 2>/dev/null || echo "[]")

    # Build analysis report
    cat > "$REPORT_FILE" <<REPORT_EOF
{
  "timestamp": "$(date -Iseconds)",
  "iteration": $ITERATION,
  "health": $HEALTH_JSON,
  "pm2_restarts": $PM2_RESTARTS,
  "proactive_alerts": $(echo "$PROACTIVE" | jq '.' 2>/dev/null || echo "null"),
  "recent_errors_count": $(echo "$RECENT_ERRORS" | wc -l),
  "recent_errors_sample": $(echo "$RECENT_ERRORS" | head -10 | jq -Rs '.' 2>/dev/null || echo '""'),
  "disk_summary": $(echo "$DISK" | head -5 | jq -Rs '.' 2>/dev/null || echo '""')
}
REPORT_EOF

    log "  Report: $REPORT_FILE"

    # ── 2. ANALYZE: Check if action needed ────────────────────
    log "Phase 2: Analyzing..."

    HEALTH_ERRORS=$(echo "$HEALTH_JSON" | jq '.errors // 0' 2>/dev/null || echo "0")
    ERROR_COUNT=$(echo "$RECENT_ERRORS" | grep -c "error\|ERROR\|FATAL" 2>/dev/null || echo "0")
    HIGH_RESTARTS=$(echo "$PM2_RESTARTS" | jq '[.[] | select(.restarts > 10)] | length' 2>/dev/null || echo "0")

    NEEDS_ACTION=false
    ACTION_REASON=""

    if [[ "$HEALTH_ERRORS" -gt 0 ]]; then
        NEEDS_ACTION=true
        ACTION_REASON="health_issues:${HEALTH_ERRORS}"
    fi

    if [[ "$ERROR_COUNT" -gt 20 ]]; then
        NEEDS_ACTION=true
        ACTION_REASON="${ACTION_REASON},high_error_rate:${ERROR_COUNT}"
    fi

    if [[ "$HIGH_RESTARTS" -gt 0 ]]; then
        NEEDS_ACTION=true
        ACTION_REASON="${ACTION_REASON},unstable_services:${HIGH_RESTARTS}"
    fi

    # ── 3. NOTIFY: Send to OpenClaw for AI analysis ───────────
    if [[ "$NEEDS_ACTION" == "true" ]]; then
        log "Phase 3: Issues detected — sending to OpenClaw: $ACTION_REASON"

        # Send analysis to OpenClaw's aion-improver agent
        if [[ -n "$GATEWAY_TOKEN" ]]; then
            ANALYSIS_MSG="AION Analysis Report #${ITERATION}:
Issues detected: ${ACTION_REASON}
Health errors: ${HEALTH_ERRORS}
Log errors (30 lines): ${ERROR_COUNT}
Unstable services: ${HIGH_RESTARTS}

Recent errors sample:
$(echo "$RECENT_ERRORS" | head -20)

Request: Analyze these issues, identify root cause, and propose a fix plan.
If the fix is safe and well-understood, implement it."

            curl -sf --max-time 15 \
                -X POST "${OPENCLAW_API}/api/messages" \
                -H "Authorization: Bearer ${GATEWAY_TOKEN}" \
                -H "Content-Type: application/json" \
                -d "{\"agent\":\"aion-improver\",\"message\":$(echo "$ANALYSIS_MSG" | jq -Rs '.')}" \
                2>/dev/null || log "  WARN: Could not reach OpenClaw API"
        fi

        # Save plan for audit
        echo "$ACTION_REASON" > "${PLANS_DIR}/action-${TIMESTAMP}.txt"
    else
        log "Phase 2: All systems nominal. No action needed."
    fi

    # ── 4. CLEANUP: Rotate old reports ────────────────────────
    ls -t "${REPORTS_DIR}"/analysis-*.json 2>/dev/null | tail -n +100 | xargs rm -f 2>/dev/null || true
    ls -t "${PLANS_DIR}"/action-*.txt 2>/dev/null | tail -n +50 | xargs rm -f 2>/dev/null || true

    log "  Next iteration in ${INTERVAL}s"
    sleep "$INTERVAL"
done
