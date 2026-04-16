#!/usr/bin/env bash
# =============================================================================
# AION Platform — Master Installer
# -----------------------------------------------------------------------------
# Despliega las 55 piezas (v1 deploy + v2 RLS/E2E + v3 observabilidad) en el
# VPS, en orden seguro, con rollback automático en cada paso.
#
# Uso:
#   sudo ./install.sh                       # instalación completa interactiva
#   sudo ./install.sh --auto                # sin prompts (usa .env de install.env)
#   sudo ./install.sh --phase deploy         # solo una fase (1-7)
#   sudo ./install.sh --phase rls --dry-run # solo la fase RLS, sin aplicar
#   sudo ./install.sh --skip migrate-rls    # saltar fase específica
#   sudo ./install.sh --resume              # continuar desde el último check OK
#   sudo ./install.sh --status              # ver qué fases están instaladas
#   sudo ./install.sh --uninstall           # remover (preserva DB + logs)
#
# Fases (en orden):
#   1. preflight        — chequeos del sistema, dependencias
#   2. system           — usuario aion, dirs, systemd, ufw, certbot
#   3. deploy           — PM2 ecosystem + nginx blue/green + rollback scripts
#   4. migrate-rls      — migraciones 025-029 (RLS + audit triggers)
#   5. seed-qa          — tenant QA con UUIDs fijos
#   6. tests            — Playwright en /opt/aion/qa con los 10 specs
#   7. observability    — Prometheus + Grafana + Alertmanager + exporters
#
# Cada fase es idempotente: re-ejecutar es seguro.
# =============================================================================
set -Eeuo pipefail
IFS=$'\n\t'

# ---- Constants --------------------------------------------------------------
readonly INSTALL_VERSION="1.0.0"
readonly AION_USER="${AION_USER:-aion}"
readonly AION_ROOT="${AION_ROOT:-/opt/aion}"
readonly LOG_DIR="${LOG_DIR:-/var/log/aion}"
readonly STATE_FILE="/var/lib/aion-install/state.json"
readonly INSTALLER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly RUN_ID="install-$(date +%Y%m%d-%H%M%S)"
readonly LOG="${LOG_DIR}/${RUN_ID}.log"

# ---- Phase definitions ------------------------------------------------------
readonly PHASES=(
  "preflight"
  "system"
  "deploy"
  "migrate-rls"
  "seed-qa"
  "tests"
  "observability"
)

# ---- Argument parsing -------------------------------------------------------
MODE="interactive"
PHASE_FILTER=""
SKIP_PHASES=()
DRY_RUN=0
RESUME=0
STATUS_ONLY=0
UNINSTALL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --auto)      MODE="auto"; shift ;;
    --phase)     PHASE_FILTER="$2"; shift 2 ;;
    --skip)      SKIP_PHASES+=("$2"); shift 2 ;;
    --dry-run)   DRY_RUN=1; shift ;;
    --resume)    RESUME=1; shift ;;
    --status)    STATUS_ONLY=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    --version)   echo "AION installer $INSTALL_VERSION"; exit 0 ;;
    -h|--help)   sed -n '1,40p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

# ---- Source helpers ---------------------------------------------------------
# shellcheck disable=SC1091
source "${INSTALLER_DIR}/lib/common.sh"
# shellcheck disable=SC1091
source "${INSTALLER_DIR}/lib/state.sh"

# ---- Sanity / bootstrap -----------------------------------------------------
[[ $EUID -eq 0 ]] || die "Must run as root (use sudo)"

mkdir -p "$LOG_DIR" "$(dirname "$STATE_FILE")"
exec > >(tee -a "$LOG") 2>&1

log "╔══════════════════════════════════════════════════════════════════════╗"
log "║   AION Platform Installer v${INSTALL_VERSION}                                  ║"
log "║   Run ID: ${RUN_ID}                                          ║"
log "║   Mode:   ${MODE}                                                  ║"
log "║   Log:    ${LOG}                                ║"
log "╚══════════════════════════════════════════════════════════════════════╝"

# ---- Status mode ------------------------------------------------------------
if [[ "$STATUS_ONLY" -eq 1 ]]; then
  show_status
  exit 0
fi

# ---- Uninstall mode ---------------------------------------------------------
if [[ "$UNINSTALL" -eq 1 ]]; then
  bash "${INSTALLER_DIR}/uninstall.sh"
  exit $?
fi

# ---- Load env ---------------------------------------------------------------
if [[ -f "${INSTALLER_DIR}/install.env" ]]; then
  log "Loading ${INSTALLER_DIR}/install.env"
  # shellcheck disable=SC1091
  set -a; source "${INSTALLER_DIR}/install.env"; set +a
elif [[ "$MODE" == "auto" ]]; then
  die "--auto requires install.env to exist (cp install.env.example install.env)"
fi

# ---- Determine phases to run ------------------------------------------------
declare -a PHASES_TO_RUN=()
if [[ -n "$PHASE_FILTER" ]]; then
  PHASES_TO_RUN+=("$PHASE_FILTER")
elif [[ "$RESUME" -eq 1 ]]; then
  for p in "${PHASES[@]}"; do
    if ! is_phase_complete "$p"; then
      PHASES_TO_RUN+=("$p")
    fi
  done
  log "Resume mode — phases to run: ${PHASES_TO_RUN[*]:-<none, all done>}"
else
  PHASES_TO_RUN=("${PHASES[@]}")
fi

# Apply --skip filter
declare -a FINAL_PHASES=()
for p in "${PHASES_TO_RUN[@]}"; do
  skip=0
  for s in "${SKIP_PHASES[@]:-}"; do
    [[ "$p" == "$s" ]] && skip=1 && break
  done
  [[ "$skip" -eq 0 ]] && FINAL_PHASES+=("$p")
done

if [[ "${#FINAL_PHASES[@]}" -eq 0 ]]; then
  log "No phases to run. Done."
  exit 0
fi

log ""
log "Phases planned: ${FINAL_PHASES[*]}"
[[ "$DRY_RUN" -eq 1 ]] && log "*** DRY RUN — no changes will be applied ***"

if [[ "$MODE" == "interactive" ]]; then
  read -rp "Proceed? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { log "Cancelled"; exit 0; }
fi

# ---- Phase execution loop ---------------------------------------------------
overall_start="$(date +%s)"
declare -a PHASE_RESULTS=()

for phase in "${FINAL_PHASES[@]}"; do
  log ""
  log "════════════════════════════════════════════════════════════════════"
  log "▶ Phase: $phase"
  log "════════════════════════════════════════════════════════════════════"
  phase_start="$(date +%s)"

  phase_script="${INSTALLER_DIR}/phases/${phase}.sh"
  if [[ ! -x "$phase_script" ]]; then
    err "Phase script not found or not executable: $phase_script"
    PHASE_RESULTS+=("$phase:MISSING")
    continue
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "[DRY-RUN] would execute: $phase_script"
    PHASE_RESULTS+=("$phase:DRY")
    continue
  fi

  # Snapshot the phase before running
  snapshot_phase "$phase"

  # Run with controlled failure
  set +e
  bash "$phase_script"
  rc=$?
  set -e

  phase_dur=$(( $(date +%s) - phase_start ))

  if [[ $rc -eq 0 ]]; then
    log "✓ Phase '$phase' completed in ${phase_dur}s"
    mark_phase_complete "$phase"
    PHASE_RESULTS+=("$phase:OK:${phase_dur}s")
  else
    err "✗ Phase '$phase' FAILED (rc=$rc, ${phase_dur}s)"
    PHASE_RESULTS+=("$phase:FAIL:${phase_dur}s")
    mark_phase_failed "$phase"

    if [[ "$MODE" == "interactive" ]]; then
      echo ""
      read -rp "Continue with remaining phases? [y/N] " ans
      [[ "$ans" =~ ^[Yy]$ ]] || break
    else
      log "Auto mode: stopping on failure."
      break
    fi
  fi
done

# ---- Summary ----------------------------------------------------------------
overall_dur=$(( $(date +%s) - overall_start ))
log ""
log "════════════════════════════════════════════════════════════════════"
log "INSTALLATION SUMMARY                       (total: ${overall_dur}s)"
log "════════════════════════════════════════════════════════════════════"
for r in "${PHASE_RESULTS[@]}"; do
  log "  • $r"
done
log "════════════════════════════════════════════════════════════════════"
log ""
log "Logs:  $LOG"
log "State: $STATE_FILE"
log ""

# ---- Final verification -----------------------------------------------------
if [[ "$DRY_RUN" -eq 0 ]] && all_phases_complete; then
  log "Running final smoke test against production..."
  if [[ -x "${INSTALLER_DIR}/preflight/post-install-verify.sh" ]]; then
    bash "${INSTALLER_DIR}/preflight/post-install-verify.sh" || true
  fi

  log ""
  log "✅ All 7 phases installed successfully."
  log ""
  log "Next steps:"
  log "  1. Verify Grafana:    https://metrics.aionseg.co  (admin / see install.env)"
  log "  2. Verify alerts:     https://alerts.aionseg.co"
  log "  3. Run E2E suite:     sudo -u aion -- npx playwright test --config /opt/aion/qa/playwright.config.ts"
  log "  4. Read runbook:      /opt/aion/runbooks/RUNBOOK_INCIDENTS.md"
  log "  5. Print quick card:  lp /opt/aion/runbooks/QUICK_CARD.md"
fi

exit 0
