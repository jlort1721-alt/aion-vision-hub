#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AION Vision Hub — Health Check Script
# Cron: */5 * * * * /opt/aion/scripts/healthcheck.sh
# ═══════════════════════════════════════════════════════════

LOG="/opt/aion/logs/healthcheck.log"
ALERT_FILE="/opt/aion/logs/.last_alert"
ALERT_COOLDOWN=300  # 5 minutes between alerts

check_service() {
  local name="$1" url="$2"
  if curl -sf --max-time 5 "$url" >/dev/null 2>&1; then
    echo "[$(date '+%H:%M:%S')] $name: OK"
    return 0
  else
    echo "[$(date '+%H:%M:%S')] $name: DOWN"
    return 1
  fi
}

{
  echo "─── Health Check $(date '+%Y-%m-%d %H:%M:%S') ───"

  FAILURES=0

  check_service "Backend API" "http://localhost:3000/health" || FAILURES=$((FAILURES+1))
  check_service "Edge Gateway" "http://localhost:3100/health" || FAILURES=$((FAILURES+1))
  check_service "MediaMTX" "http://localhost:9997/v3/paths" || FAILURES=$((FAILURES+1))

  # Check Docker containers
  RESTARTING=$(docker ps --filter status=restarting --format '{{.Names}}' 2>/dev/null)
  if [ -n "$RESTARTING" ]; then
    echo "[$(date '+%H:%M:%S')] RESTARTING containers: $RESTARTING"
    FAILURES=$((FAILURES+1))
  fi

  # Check disk space (alert if < 10% free)
  DISK_PCT=$(df /opt/aion | tail -1 | awk '{print $5}' | tr -d '%')
  if [ "$DISK_PCT" -gt 90 ]; then
    echo "[$(date '+%H:%M:%S')] DISK: ${DISK_PCT}% used (CRITICAL)"
    FAILURES=$((FAILURES+1))
  fi

  # Check memory (alert if < 10% free)
  MEM_FREE_PCT=$(free | awk '/Mem:/{printf "%.0f", $7/$2*100}')
  if [ "$MEM_FREE_PCT" -lt 10 ]; then
    echo "[$(date '+%H:%M:%S')] MEMORY: ${MEM_FREE_PCT}% available (CRITICAL)"
    FAILURES=$((FAILURES+1))
  fi

  if [ $FAILURES -gt 0 ]; then
    echo "STATUS: $FAILURES FAILURE(S)"
  else
    echo "STATUS: ALL OK"
  fi

} >> "$LOG" 2>&1

# Keep log file manageable
tail -1000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG" 2>/dev/null || true
