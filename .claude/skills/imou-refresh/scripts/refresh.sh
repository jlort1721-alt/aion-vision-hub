#!/usr/bin/env bash
# imou-refresh — renew HLS URLs via Imou Open Platform.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TS="$(date -u +%Y%m%d-%H%M)"
OUT="/tmp/imou-refresh-${TS}.md"
DEVICE=""
DRY_RUN=0
RELOAD=0

for arg in "$@"; do
  case "$arg" in
    --device=*) DEVICE="${arg#*=}" ;;
    --dry-run) DRY_RUN=1 ;;
    --reload-go2rtc) RELOAD=1 ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

if [[ -r /etc/aion/secrets/imou.env ]]; then
  set -a; . /etc/aion/secrets/imou.env; set +a
fi

for v in IMOU_APP_ID IMOU_APP_SECRET IMOU_API_BASE; do
  if [[ -z "${!v:-}" ]]; then
    echo "[imou-refresh] missing $v (load /etc/aion/secrets/imou.env)" >&2
    exit 3
  fi
done

python3 "$SCRIPT_DIR/refresh.py" \
  --out "$OUT" \
  $([[ $DRY_RUN -eq 1 ]] && echo --dry-run) \
  $([[ -n "$DEVICE" ]] && echo --device "$DEVICE")

if [[ $RELOAD -eq 1 && $DRY_RUN -eq 0 ]]; then
  echo "[imou-refresh] reloading go2rtc…"
  curl -sS -X POST http://127.0.0.1:1984/api/config -o /dev/null
fi

echo "[imou-refresh] report → $OUT"
