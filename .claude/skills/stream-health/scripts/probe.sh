#!/usr/bin/env bash
# stream-health probe. Read-only against go2rtc local API.
set -euo pipefail

GO2RTC="${GO2RTC_API:-http://127.0.0.1:1984}"
TS="$(date -u +%Y%m%d-%H%M)"
OUT="/tmp/stream-health-${TS}.md"
PROBE_HLS=0
FILTER=""

for arg in "$@"; do
  case "$arg" in
    --probe-hls) PROBE_HLS=1 ;;
    --filter=*) FILTER="${arg#*=}" ;;
    --output=*) OUT="${arg#*=}" ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

if ! curl -sSf -o /dev/null --max-time 3 "$GO2RTC/api/streams"; then
  echo "[stream-health] go2rtc not reachable at $GO2RTC" >&2
  exit 3
fi

STREAMS=$(curl -sS "$GO2RTC/api/streams" | jq -r 'keys[]' | { [[ -n "$FILTER" ]] && grep -E "$FILTER" || cat; })
COUNT=$(echo "$STREAMS" | wc -l | tr -d ' ')

{
  echo "# stream-health — $(date -u --iso-8601=seconds)"
  echo
  echo "- go2rtc endpoint: \`$GO2RTC\`"
  echo "- probe-hls: $PROBE_HLS"
  echo "- filter: ${FILTER:-none}"
  echo "- streams matched: $COUNT"
  echo
  echo "| name | producer | consumers | src | hls_http | ttfb_ms | notes |"
  echo "|---|---|---|---|---|---|---|"
} > "$OUT"

probe_one() {
  local name="$1"
  local data producer consumers src hls_http ttfb notes
  data=$(curl -sS --max-time 5 "$GO2RTC/api/streams?src=${name}&probe=1" || echo "{}")
  producer=$(echo "$data" | jq -r '.producers[0].state // "-"')
  consumers=$(echo "$data" | jq -r '[.consumers[]?] | length // 0')
  src=$(echo "$data" | jq -r '.producers[0].url // "-"')
  src=$(printf '%s' "$src" | cut -c1-60)
  hls_http="-"
  ttfb="-"
  notes=""
  if [[ "$PROBE_HLS" -eq 1 ]]; then
    local hls_url="$GO2RTC/api/stream.m3u8?src=${name}"
    local timing
    timing=$(curl -sS -o /dev/null -w '%{http_code} %{time_starttransfer}' --max-time 4 "$hls_url" || echo "000 0")
    hls_http=$(echo "$timing" | awk '{print $1}')
    ttfb=$(echo "$timing" | awk '{printf "%.0f", $2*1000}')
    [[ "$hls_http" != "200" ]] && notes="hls-not-200"
  fi
  [[ "$producer" != "connected" && -z "$notes" ]] && notes="producer-${producer}"
  printf '| %s | %s | %s | %s | %s | %s | %s |\n' \
    "$name" "$producer" "$consumers" "$src" "$hls_http" "$ttfb" "$notes"
}

export -f probe_one
export GO2RTC PROBE_HLS

echo "$STREAMS" | xargs -P 4 -I{} bash -c 'probe_one "$@"' _ {} >> "$OUT"

echo
echo "[stream-health] wrote $OUT ($COUNT streams)"
