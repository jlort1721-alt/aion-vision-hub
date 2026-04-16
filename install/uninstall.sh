#!/usr/bin/env bash
# install/uninstall.sh — remove AION Platform installation.
# Preserves DB data, logs, and snapshots by default.
# =============================================================================
set -Eeuo pipefail

readonly INSTALLER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${INSTALLER_DIR}/lib/common.sh"
# shellcheck disable=SC1091
source "${INSTALLER_DIR}/lib/state.sh"

readonly AION_USER="${AION_USER:-aion}"
readonly AION_ROOT="${AION_ROOT:-/opt/aion}"
readonly LOG_DIR="${LOG_DIR:-/var/log/aion}"

PURGE_DATA=0
PURGE_LOGS=0
PURGE_DB=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --purge-data) PURGE_DATA=1; shift ;;
    --purge-logs) PURGE_LOGS=1; shift ;;
    --purge-db)   PURGE_DB=1;   shift ;;
    --purge-all)  PURGE_DATA=1; PURGE_LOGS=1; PURGE_DB=1; shift ;;
    -h|--help)    sed -n '1,15p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

[[ $EUID -eq 0 ]] || die "Must run as root"

log "╔══════════════════════════════════════════════════════════════════════╗"
log "║   AION Platform Uninstaller                                          ║"
log "╚══════════════════════════════════════════════════════════════════════╝"
log ""
log "This will REMOVE:"
log "  • PM2 apps and systemd integration"
log "  • Observability stack (Prometheus, Grafana, Alertmanager, exporters)"
log "  • nginx site + upstreams"
log "  • $AION_ROOT/qa, $AION_ROOT/observability"

if [[ $PURGE_DATA -eq 1 ]]; then
  warn "  • $AION_ROOT/snapshots (--purge-data)"
fi
if [[ $PURGE_LOGS -eq 1 ]]; then
  warn "  • $LOG_DIR/* (--purge-logs)"
fi
if [[ $PURGE_DB -eq 1 ]]; then
  warn "  • DROP all RLS policies and audit triggers (--purge-db)"
  warn "  • DROP audit_log table"
fi

log ""
log "PRESERVED (unless --purge-* flags used):"
log "  • PostgreSQL database (use --purge-db to remove RLS only, NOT data)"
log "  • Snapshots in $AION_ROOT/snapshots"
log "  • Logs in $LOG_DIR"
log "  • aion user account"
log ""

read -rp "Type 'UNINSTALL' to confirm: " confirm
[[ "$confirm" == "UNINSTALL" ]] || { log "Cancelled."; exit 0; }

# ---- Stop & remove PM2 apps -------------------------------------------------
log "Stopping PM2 apps..."
sudo -u "$AION_USER" pm2 delete all 2>/dev/null || true
sudo -u "$AION_USER" pm2 save        2>/dev/null || true
systemctl disable --now pm2-"$AION_USER".service 2>/dev/null || true
ok "PM2 apps removed"

# ---- Stop observability stack ----------------------------------------------
if [[ -f "$AION_ROOT/observability/docker-compose.yml" ]]; then
  log "Stopping observability stack..."
  cd "$AION_ROOT/observability"
  sudo -u "$AION_USER" docker compose down -v 2>/dev/null || true
  ok "Observability stack stopped"
fi

# ---- Remove nginx config ---------------------------------------------------
log "Removing nginx config..."
rm -f /etc/nginx/sites-enabled/aionseg.co
rm -f /etc/nginx/conf.d/aion-upstream.conf
rm -f /etc/nginx/conf.d/stub_status.conf
nginx -t >/dev/null 2>&1 && systemctl reload nginx
ok "nginx config removed (sites-available/ and snippets/ kept for re-install)"

# ---- Remove qa and observability dirs --------------------------------------
log "Removing $AION_ROOT/qa and $AION_ROOT/observability..."
rm -rf "$AION_ROOT/qa"
rm -rf "$AION_ROOT/observability"

# ---- Optional: purge data --------------------------------------------------
if [[ $PURGE_DATA -eq 1 ]]; then
  log "Purging snapshots..."
  rm -rf "$AION_ROOT/snapshots"
fi

if [[ $PURGE_LOGS -eq 1 ]]; then
  log "Purging logs..."
  rm -rf "$LOG_DIR"/*
fi

# ---- Optional: rollback DB migrations --------------------------------------
if [[ $PURGE_DB -eq 1 ]]; then
  log "Rolling back RLS migrations..."
  if [[ -x "$AION_ROOT/db/scripts/migrate.sh" ]] && [[ -n "${DATABASE_URL:-}" ]]; then
    sudo -u "$AION_USER" \
      DATABASE_URL="$DATABASE_URL" \
      "$AION_ROOT/db/scripts/migrate.sh" --env production --rollback 024 || \
      warn "Rollback failed — manual cleanup required"
  else
    warn "Cannot rollback: migrate.sh missing or DATABASE_URL not set"
  fi
fi

# ---- Reset state file -------------------------------------------------------
if [[ -f "$STATE_FILE" ]]; then
  mv "$STATE_FILE" "${STATE_FILE}.uninstalled-$(date +%s)"
  log "State file archived"
fi

log ""
ok "Uninstall complete."
log ""
log "To re-install: sudo ./install.sh"
log "Logs preserved at: $LOG_DIR"
log "Snapshots preserved at: $AION_ROOT/snapshots"
