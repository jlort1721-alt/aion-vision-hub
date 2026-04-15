#!/usr/bin/env bash
# install/phases/preflight.sh — system & dependency checks
set -Eeuo pipefail
# shellcheck disable=SC1091
source "$(dirname "$0")/../lib/common.sh"

log "Checking OS..."
. /etc/os-release
case "$ID" in
  ubuntu|debian) ok "OS: $PRETTY_NAME" ;;
  *) warn "Untested OS: $PRETTY_NAME — proceeding anyway" ;;
esac

log "Checking required commands..."
require_cmd curl jq tar gzip openssl awk sed grep find
ok "Core utilities present"

log "Checking optional but recommended commands..."
for c in docker docker-compose pm2 psql node npm pnpm nginx certbot; do
  if command -v "$c" >/dev/null 2>&1; then
    ok "  found: $c ($(command -v "$c"))"
  else
    warn "  missing: $c (will be installed in 'system' phase if needed)"
  fi
done

log "Checking disk space..."
free_gb="$(df -BG / | awk 'NR==2 {gsub("G","",$4); print $4}')"
[[ "$free_gb" -ge 20 ]] || warn "Less than 20GB free on /"
ok "Free disk: ${free_gb}GB"

log "Checking RAM..."
total_gb="$(free -g | awk '/^Mem:/ {print $2}')"
[[ "$total_gb" -ge 4 ]] || warn "Less than 4GB RAM — observability stack may be tight"
ok "Total RAM: ${total_gb}GB"

log "Checking network..."
if curl -fsS --max-time 5 https://api.anthropic.com >/dev/null 2>&1; then
  ok "Internet & Anthropic API reachable"
else
  warn "Cannot reach api.anthropic.com — agent features will fail"
fi

log "Checking ports..."
for port in 80 443 3000 3030 5432 9090 9093 9115; do
  if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
    log "  port ${port}: in use"
  else
    log "  port ${port}: free"
  fi
done

log "Checking aion user..."
if id "$AION_USER" &>/dev/null; then
  ok "User '$AION_USER' exists (uid=$(id -u "$AION_USER"))"
else
  log "User '$AION_USER' will be created in 'system' phase"
fi

log "Verifying installer assets present..."
BUNDLES="$(bundles_dir)"
[[ -d "$BUNDLES/v1-deploy"        ]] || die "Missing $BUNDLES/v1-deploy"
[[ -d "$BUNDLES/v2-rls-tests"     ]] || die "Missing $BUNDLES/v2-rls-tests"
[[ -d "$BUNDLES/v3-observability" ]] || die "Missing $BUNDLES/v3-observability"
[[ -d "$BUNDLES/all-specs"        ]] || die "Missing $BUNDLES/all-specs"
ok "All 4 bundle dirs present"

log "Counting bundle artifacts..."
file_count="$(find "$BUNDLES" -type f | wc -l)"
log "  Total files: $file_count"
[[ "$file_count" -ge 50 ]] || warn "Expected ~55 files, found $file_count"

ok "Preflight complete."
