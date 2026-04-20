#!/usr/bin/env bash
# device-audit — orchestrator. DRY-RUN by default.
# Usage: run.sh [--execute] [--brand=hikvision|dahua] [--site=<slug>] [--device=<id>]
set -euo pipefail

EXECUTE=0
BRAND=""
SITE=""
DEVICE=""

for arg in "$@"; do
  case "$arg" in
    --execute) EXECUTE=1 ;;
    --brand=*) BRAND="${arg#*=}" ;;
    --site=*) SITE="${arg#*=}" ;;
    --device=*) DEVICE="${arg#*=}" ;;
    -h|--help)
      sed -n '1,6p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TS="$(date -u +%Y%m%d-%H%M)"
REPORT="/tmp/device-audit-${TS}.md"

echo "[device-audit] mode=$([[ $EXECUTE -eq 1 ]] && echo EXECUTE || echo DRY-RUN) brand=${BRAND:-all} site=${SITE:-all} device=${DEVICE:-all}"
echo "[device-audit] report → $REPORT"

# ---- Cooldown guard for --execute ----
if [[ $EXECUTE -eq 1 ]]; then
  COOLDOWN_FILE="/home/openclaw/devops/dvr-cooldown.state"
  NOW_EPOCH=$(date -u +%s)
  UNTIL_EPOCH=0
  if [[ -n "${DVR_COOLDOWN_UNTIL:-}" ]]; then
    UNTIL_EPOCH=$(date -u -d "$DVR_COOLDOWN_UNTIL" +%s 2>/dev/null || echo 0)
  elif [[ -f "$COOLDOWN_FILE" ]]; then
    UNTIL_EPOCH=$(date -u -d "$(cat "$COOLDOWN_FILE")" +%s 2>/dev/null || echo 0)
  fi
  if (( UNTIL_EPOCH > NOW_EPOCH )); then
    echo "[device-audit] REFUSED: DVR cooldown until $(date -u -d "@$UNTIL_EPOCH" --iso-8601=seconds). Re-run later." >&2
    exit 3
  fi
fi

# ---- Dispatch ----
PY=python3
FILTER_ARGS=()
[[ -n "$BRAND"  ]] && FILTER_ARGS+=(--brand "$BRAND")
[[ -n "$SITE"   ]] && FILTER_ARGS+=(--site "$SITE")
[[ -n "$DEVICE" ]] && FILTER_ARGS+=(--device "$DEVICE")

if [[ $EXECUTE -eq 0 ]]; then
  "$PY" "$SCRIPT_DIR/dry_run.py" --report "$REPORT" "${FILTER_ARGS[@]}"
else
  # Sequential real execution: first dry_run snapshot, then per-brand login probe.
  "$PY" "$SCRIPT_DIR/dry_run.py" --report "$REPORT" "${FILTER_ARGS[@]}"
  if [[ -z "$BRAND" || "$BRAND" == "hikvision" ]]; then
    "$PY" "$SCRIPT_DIR/execute_hik.py" --append "$REPORT" "${FILTER_ARGS[@]}"
  fi
  if [[ -z "$BRAND" || "$BRAND" == "dahua" ]]; then
    "$PY" "$SCRIPT_DIR/execute_dahua.py" --append "$REPORT" "${FILTER_ARGS[@]}"
  fi
fi

echo "[device-audit] DONE → $REPORT"
