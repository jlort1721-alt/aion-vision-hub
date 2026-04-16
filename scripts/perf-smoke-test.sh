#!/usr/bin/env bash
# AION Vision Hub — Performance Smoke Test
# Usage: ./scripts/perf-smoke-test.sh [BASE_URL] [TOKEN]

set -euo pipefail

BASE_URL="${1:-https://aionseg.co/api}"
TOKEN="${2:-${AION_TOKEN:-}}"
RUNS=5

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENDPOINTS=(
  "/health"
  "/health/ready"
  "/health/detailed"
  "/health/metrics/json"
  "/sites"
  "/devices?page=1&limit=10"
  "/cameras"
  "/events?limit=10"
  "/camera-detections?page=1&perPage=10"
  "/notes?page=1&perPage=10"
)

AUTH_HEADER=""
if [ -n "$TOKEN" ]; then
  AUTH_HEADER="-H \"Authorization: Bearer $TOKEN\""
fi

echo "========================================="
echo "  AION Performance Smoke Test"
echo "  Base URL: $BASE_URL"
echo "  Runs per endpoint: $RUNS"
echo "========================================="
echo ""

printf "%-35s %10s %10s %10s\n" "ENDPOINT" "p50 (ms)" "p95 (ms)" "STATUS"
printf "%-35s %10s %10s %10s\n" "-----------------------------------" "----------" "----------" "----------"

TOTAL_PASS=0
TOTAL_FAIL=0

for endpoint in "${ENDPOINTS[@]}"; do
  times=()
  status="PASS"

  for ((i=1; i<=RUNS; i++)); do
    if [ -n "$TOKEN" ]; then
      time_ms=$(curl -s -o /dev/null -w "%{time_total}" -H "Authorization: Bearer $TOKEN" "$BASE_URL$endpoint" 2>/dev/null)
    else
      time_ms=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL$endpoint" 2>/dev/null)
    fi
    time_ms_int=$(echo "$time_ms * 1000" | bc 2>/dev/null | cut -d. -f1 || echo "0")
    times+=("$time_ms_int")
  done

  sorted=($(printf '%s\n' "${times[@]}" | sort -n))
  count=${#sorted[@]}
  p50_idx=$(( count / 2 ))
  p95_idx=$(( count * 95 / 100 ))
  if [ $p95_idx -ge $count ]; then p95_idx=$((count - 1)); fi

  p50="${sorted[$p50_idx]}"
  p95="${sorted[$p95_idx]}"

  if [ "$p95" -gt 500 ]; then
    status="WARN"
    color="$YELLOW"
  elif [ "$p95" -gt 2000 ]; then
    status="FAIL"
    color="$RED"
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
  else
    color="$GREEN"
    TOTAL_PASS=$((TOTAL_PASS + 1))
  fi

  printf "%-35s %10s %10s ${color}%10s${NC}\n" "$endpoint" "${p50}ms" "${p95}ms" "$status"
done

echo ""
echo "========================================="
echo "  Results: ${TOTAL_PASS} PASS, ${TOTAL_FAIL} FAIL"
echo "========================================="

exit $TOTAL_FAIL
