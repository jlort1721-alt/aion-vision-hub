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
# Uses python for cross-platform ISO-8601 parsing (GNU `date -d` is Linux-only).
iso_to_epoch() {
  python3 -c "import sys,datetime; s=sys.argv[1].replace('Z','+00:00'); print(int(datetime.datetime.fromisoformat(s).timestamp()))" "$1" 2>/dev/null || echo 0
}

if [[ $EXECUTE -eq 1 ]]; then
  COOLDOWN_FILE="/home/openclaw/devops/dvr-cooldown.state"
  NOW_EPOCH=$(date -u +%s)
  UNTIL_EPOCH=0
  if [[ -n "${DVR_COOLDOWN_UNTIL:-}" ]]; then
    UNTIL_EPOCH=$(iso_to_epoch "$DVR_COOLDOWN_UNTIL")
  elif [[ -f "$COOLDOWN_FILE" ]]; then
    UNTIL_EPOCH=$(iso_to_epoch "$(cat "$COOLDOWN_FILE")")
  fi
  if (( UNTIL_EPOCH > NOW_EPOCH )); then
    UNTIL_ISO=$(python3 -c "import datetime,sys;print(datetime.datetime.fromtimestamp(int(sys.argv[1]),tz=datetime.timezone.utc).isoformat(timespec='seconds'))" "$UNTIL_EPOCH" 2>/dev/null || echo "$UNTIL_EPOCH")
    echo "[device-audit] REFUSED: DVR cooldown until $UNTIL_ISO. Re-run later." >&2
    exit 3
  fi
fi

# ---- Dispatch ----
PY=python3
FILTER_ARGS=()
[[ -n "$BRAND"  ]] && FILTER_ARGS+=(--brand "$BRAND")
[[ -n "$SITE"   ]] && FILTER_ARGS+=(--site "$SITE")
[[ -n "$DEVICE" ]] && FILTER_ARGS+=(--device "$DEVICE")

# Expand array safely even when empty (set -u compatible via ${arr[@]+...}).
FILTER_EXPANDED=("${FILTER_ARGS[@]+"${FILTER_ARGS[@]}"}")

if [[ $EXECUTE -eq 0 ]]; then
  "$PY" "$SCRIPT_DIR/dry_run.py" --report "$REPORT" "${FILTER_EXPANDED[@]+"${FILTER_EXPANDED[@]}"}"
else
  # Sequential real execution: first dry_run snapshot, then per-brand login probe.
  "$PY" "$SCRIPT_DIR/dry_run.py" --report "$REPORT" "${FILTER_EXPANDED[@]+"${FILTER_EXPANDED[@]}"}"
  if [[ -z "$BRAND" || "$BRAND" == "hikvision" ]]; then
    "$PY" "$SCRIPT_DIR/execute_hik.py" --append "$REPORT" "${FILTER_EXPANDED[@]+"${FILTER_EXPANDED[@]}"}"
  fi
  if [[ -z "$BRAND" || "$BRAND" == "dahua" ]]; then
    "$PY" "$SCRIPT_DIR/execute_dahua.py" --append "$REPORT" "${FILTER_EXPANDED[@]+"${FILTER_EXPANDED[@]}"}"
  fi
fi

echo "[device-audit] DONE → $REPORT"
