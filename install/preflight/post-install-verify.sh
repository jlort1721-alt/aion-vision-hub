#!/usr/bin/env bash
# install/preflight/post-install-verify.sh
# Runs after all phases complete to verify the platform is operational.
set -Eeuo pipefail
# shellcheck disable=SC1091
source "$(dirname "$0")/../lib/common.sh"

readonly AION_USER="${AION_USER:-aion}"
readonly AION_ROOT="${AION_ROOT:-/opt/aion}"
DOMAIN="${AION_DOMAIN:-aionseg.co}"

log "═══════════════════════════════════════════════════════════════════════"
log "POST-INSTALL VERIFICATION"
log "═══════════════════════════════════════════════════════════════════════"

declare -A CHECKS=()
PASS=0; FAIL=0

# ---- 1. Files in place -----------------------------------------------------
log ""
log "1. File presence:"
for f in \
  "$AION_ROOT/ecosystem.config.js" \
  "$AION_ROOT/scripts/deploy.sh" \
  "$AION_ROOT/scripts/rollback.sh" \
  "$AION_ROOT/db/scripts/migrate.sh" \
  "$AION_ROOT/db/scripts/seed-qa.sh" \
  "$AION_ROOT/qa/playwright.config.ts" \
  "$AION_ROOT/observability/docker-compose.yml" \
  "$AION_ROOT/observability/.env" \
  "$AION_ROOT/runbooks/RUNBOOK_INCIDENTS.md"
do
  if [[ -f "$f" ]]; then
    ok "  $f"; PASS=$((PASS + 1))
  else
    err "  MISSING: $f"; FAIL=$((FAIL + 1))
  fi
done

# ---- 2. Migrations applied -------------------------------------------------
log ""
log "2. Database state:"
if [[ -n "${DATABASE_URL:-}" ]]; then
  APPLIED="$(psql "$DATABASE_URL" -Atc "
    SELECT version FROM schema_migrations
    WHERE version IN ('025','026','027','028','029')
    ORDER BY version
  " 2>/dev/null)"
  EXPECTED=$'025\n026\n027\n028\n029'
  if [[ "$APPLIED" == "$EXPECTED" ]]; then
    ok "  All 5 migrations applied (025-029)"; PASS=$((PASS + 1))
  else
    err "  Missing migrations. Applied: $(echo "$APPLIED" | tr '\n' ' ')"; FAIL=$((FAIL + 1))
  fi

  RLS_GAP="$(psql "$DATABASE_URL" -Atc "
    SELECT count(*) FROM pg_tables
    WHERE schemaname='public' AND rowsecurity=false
      AND tablename<>'schema_migrations'
  " 2>/dev/null || echo "?")"
  if [[ "$RLS_GAP" == "0" ]]; then
    ok "  RLS coverage: 100% (0 gaps)"; PASS=$((PASS + 1))
  else
    err "  $RLS_GAP tables WITHOUT RLS"; FAIL=$((FAIL + 1))
  fi

  if psql "$DATABASE_URL" -Atc "SELECT 1 FROM pg_tables WHERE tablename='audit_log'" 2>/dev/null | grep -q 1; then
    ok "  audit_log table present"; PASS=$((PASS + 1))
  else
    err "  audit_log MISSING"; FAIL=$((FAIL + 1))
  fi
else
  warn "  Skipped: DATABASE_URL not set"
fi

# ---- 3. QA tenant seeded ---------------------------------------------------
log ""
log "3. QA tenant:"
if [[ -n "${DATABASE_URL:-}" ]]; then
  if psql "$DATABASE_URL" -Atc \
    "SELECT 1 FROM sites WHERE id='22222222-2222-2222-2222-222222222222'" 2>/dev/null | grep -q 1; then
    ok "  QA site exists"; PASS=$((PASS + 1))
  else
    err "  QA site NOT seeded"; FAIL=$((FAIL + 1))
  fi
fi

# ---- 4. Playwright installable & config valid ------------------------------
log ""
log "4. Playwright:"
if sudo -u "$AION_USER" "$AION_ROOT/qa/node_modules/.bin/playwright" --version &>/dev/null; then
  V="$(sudo -u "$AION_USER" "$AION_ROOT/qa/node_modules/.bin/playwright" --version)"
  ok "  $V"; PASS=$((PASS + 1))
else
  err "  Playwright not installed in $AION_ROOT/qa"; FAIL=$((FAIL + 1))
fi

SPEC_COUNT="$(ls "$AION_ROOT/qa/tests/e2e/" 2>/dev/null | grep -c '\.spec\.ts$' || echo 0)"
if [[ "$SPEC_COUNT" -ge 10 ]]; then
  ok "  $SPEC_COUNT specs installed"; PASS=$((PASS + 1))
else
  err "  Only $SPEC_COUNT specs (expected 10)"; FAIL=$((FAIL + 1))
fi

# ---- 5. Observability stack up --------------------------------------------
log ""
log "5. Observability stack:"
declare -A SERVICES=(
  [Prometheus]="http://127.0.0.1:9090/-/ready"
  [Alertmanager]="http://127.0.0.1:9093/-/ready"
  [Blackbox]="http://127.0.0.1:9115/-/healthy"
  [Grafana]="http://127.0.0.1:3009/api/health"
  [PM2-exporter]="http://127.0.0.1:9209/metrics"
  [AION-exporter]="http://127.0.0.1:9210/metrics"
)
for name in "${!SERVICES[@]}"; do
  if curl -fsS --max-time 5 "${SERVICES[$name]}" >/dev/null 2>&1; then
    ok "  $name UP"; PASS=$((PASS + 1))
  else
    err "  $name DOWN (${SERVICES[$name]})"; FAIL=$((FAIL + 1))
  fi
done

# ---- 6. Public site reachable ----------------------------------------------
log ""
log "6. Public site (https://${DOMAIN}):"
if curl -fsS --max-time 10 -o /dev/null -w '%{http_code}' "https://${DOMAIN}/api/health" 2>/dev/null | grep -q 200; then
  ok "  /api/health: 200"; PASS=$((PASS + 1))
else
  warn "  /api/health: not 200 — app may not be deployed yet"
fi

# ---- 7. nginx config -------------------------------------------------------
log ""
log "7. Nginx:"
if nginx -t 2>&1 | grep -q "test is successful"; then
  ok "  nginx -t passes"; PASS=$((PASS + 1))
else
  err "  nginx -t FAILS"; FAIL=$((FAIL + 1))
fi
ACTIVE_COLOR="$(basename "$(readlink -f /etc/nginx/conf.d/aion-upstream.conf 2>/dev/null)" .conf 2>/dev/null || echo unknown)"
log "  Active color: $ACTIVE_COLOR"

# ---- Summary ---------------------------------------------------------------
log ""
log "═══════════════════════════════════════════════════════════════════════"
log "Summary: ${GREEN}${PASS} passed${RESET} / ${RED}${FAIL} failed${RESET}"
log "═══════════════════════════════════════════════════════════════════════"

if [[ "$FAIL" -eq 0 ]]; then
  ok "✅ AION Platform fully operational."
  exit 0
else
  err "❌ ${FAIL} checks failed. Review above and consult /opt/aion/runbooks/RUNBOOK_INCIDENTS.md"
  exit 1
fi
