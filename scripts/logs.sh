#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AION Vision Hub — Log Viewer
# Usage: bash logs.sh [api|gateway|mediamtx|postgres|nginx|all]
# ═══════════════════════════════════════════════════════════

SERVICE="${1:-all}"
LINES="${2:-100}"

case "$SERVICE" in
  api)
    echo "=== Backend API Logs (last $LINES) ==="
    docker logs --tail "$LINES" -f $(docker ps -q --filter name=backend-api) 2>/dev/null || echo "Container not running"
    ;;
  gateway)
    echo "=== Edge Gateway Logs (last $LINES) ==="
    docker logs --tail "$LINES" -f $(docker ps -q --filter name=edge-gateway) 2>/dev/null || echo "Container not running"
    ;;
  mediamtx)
    echo "=== MediaMTX Logs (last $LINES) ==="
    docker logs --tail "$LINES" -f $(docker ps -q --filter name=mediamtx) 2>/dev/null || echo "Container not running"
    ;;
  postgres)
    echo "=== PostgreSQL Logs (last $LINES) ==="
    docker logs --tail "$LINES" -f $(docker ps -q --filter name=postgres) 2>/dev/null || echo "Container not running"
    ;;
  nginx)
    echo "=== Nginx Logs ==="
    tail -f /opt/aion/logs/nginx-*.log
    ;;
  health)
    echo "=== Health Check Log ==="
    tail -f /opt/aion/logs/healthcheck.log
    ;;
  all)
    echo "=== All Docker Logs (last $LINES) ==="
    cd /opt/aion/app/backend
    docker compose -f docker-compose.prod.yml logs --tail "$LINES" -f
    ;;
  *)
    echo "Usage: logs.sh [api|gateway|mediamtx|postgres|nginx|health|all] [lines]"
    ;;
esac
