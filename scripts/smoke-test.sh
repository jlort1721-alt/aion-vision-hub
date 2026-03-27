#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AION Vision Hub — Production Smoke Test Suite
# Run after deployment to verify all services are operational
#
# Usage: ./scripts/smoke-test.sh [BASE_URL]
# Example: ./scripts/smoke-test.sh https://app.claveseguridad.com
# ═══════════════════════════════════════════════════════════

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0
WARN=0
RESULTS=()

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local timeout="${4:-10}"

    STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null || echo "000")
    LATENCY=$(curl -s -o /dev/null -w "%{time_total}" --max-time "$timeout" "$url" 2>/dev/null || echo "0")
    LATENCY_MS=$(echo "$LATENCY * 1000" | bc 2>/dev/null || echo "N/A")

    if [ "$STATUS" = "$expected_status" ]; then
        echo -e "  ${GREEN}PASS${NC} $name (${STATUS}, ${LATENCY_MS}ms)"
        PASS=$((PASS + 1))
        RESULTS+=("PASS|$name|$STATUS|${LATENCY_MS}ms")
    elif [ "$STATUS" = "000" ]; then
        echo -e "  ${RED}FAIL${NC} $name (connection refused/timeout)"
        FAIL=$((FAIL + 1))
        RESULTS+=("FAIL|$name|timeout|N/A")
    else
        echo -e "  ${RED}FAIL${NC} $name (expected $expected_status, got $STATUS)"
        FAIL=$((FAIL + 1))
        RESULTS+=("FAIL|$name|$STATUS|${LATENCY_MS}ms")
    fi
}

check_json() {
    local name="$1"
    local url="$2"
    local jq_filter="${3:-.}"

    RESPONSE=$(curl -s --max-time 10 "$url" 2>/dev/null || echo '{}')
    RESULT=$(echo "$RESPONSE" | jq -r "$jq_filter" 2>/dev/null || echo "error")

    if [ "$RESULT" != "null" ] && [ "$RESULT" != "error" ] && [ -n "$RESULT" ]; then
        echo -e "  ${GREEN}PASS${NC} $name → $RESULT"
        PASS=$((PASS + 1))
        RESULTS+=("PASS|$name|200|OK")
    else
        echo -e "  ${RED}FAIL${NC} $name → invalid response"
        FAIL=$((FAIL + 1))
        RESULTS+=("FAIL|$name|error|invalid JSON")
    fi
}

echo "═══════════════════════════════════════════════════════"
echo " AION Vision Hub — Smoke Tests"
echo " Target: $BASE_URL"
echo " Time:   $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. Core Health Checks ────────────────────────────────
echo "1. Core Health Checks"
check "API Health" "$BASE_URL/health"
check "API Readiness" "$BASE_URL/health/ready"
echo ""

# ── 2. Frontend Accessibility ────────────────────────────
echo "2. Frontend"
check "Frontend loads" "$BASE_URL/" "200" 15
check "Login page" "$BASE_URL/login" "200" 15
echo ""

# ── 3. API Endpoints (unauthenticated → expect 401) ─────
echo "3. API Authentication (expect 401 for protected routes)"
check "Devices requires auth" "$BASE_URL/api/v1/devices" "401"
check "Events requires auth" "$BASE_URL/api/v1/events" "401"
check "Sites requires auth" "$BASE_URL/api/v1/sites" "401"
check "Users requires auth" "$BASE_URL/api/v1/users" "401"
echo ""

# ── 4. Health JSON Validation ────────────────────────────
echo "4. Health Response Validation"
check_json "Health status field" "$BASE_URL/health" ".status"
echo ""

# ── 5. Security Headers ─────────────────────────────────
echo "5. Security Headers"
HEADERS=$(curl -s -I --max-time 10 "$BASE_URL/" 2>/dev/null || echo "")
for header in "X-Content-Type-Options" "X-Frame-Options" "Strict-Transport-Security"; do
    if echo "$HEADERS" | grep -qi "$header"; then
        echo -e "  ${GREEN}PASS${NC} $header present"
        PASS=$((PASS + 1))
        RESULTS+=("PASS|Header: $header|present|OK")
    else
        echo -e "  ${YELLOW}WARN${NC} $header missing"
        WARN=$((WARN + 1))
        RESULTS+=("WARN|Header: $header|missing|N/A")
    fi
done
echo ""

# ── 6. SSL Certificate ──────────────────────────────────
echo "6. SSL Certificate"
if [[ "$BASE_URL" == https://* ]]; then
    DOMAIN=$(echo "$BASE_URL" | sed 's|https://||' | sed 's|/.*||')
    EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | sed 's/notAfter=//')
    if [ -n "$EXPIRY" ]; then
        EXPIRY_EPOCH=$(date -j -f "%b %d %H:%M:%S %Y %Z" "$EXPIRY" "+%s" 2>/dev/null || date -d "$EXPIRY" "+%s" 2>/dev/null || echo "0")
        NOW_EPOCH=$(date "+%s")
        DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
        if [ "$DAYS_LEFT" -gt 30 ]; then
            echo -e "  ${GREEN}PASS${NC} SSL valid for $DAYS_LEFT days (expires: $EXPIRY)"
            PASS=$((PASS + 1))
        elif [ "$DAYS_LEFT" -gt 0 ]; then
            echo -e "  ${YELLOW}WARN${NC} SSL expires in $DAYS_LEFT days!"
            WARN=$((WARN + 1))
        else
            echo -e "  ${RED}FAIL${NC} SSL certificate expired!"
            FAIL=$((FAIL + 1))
        fi
    else
        echo -e "  ${YELLOW}WARN${NC} Could not check SSL certificate"
        WARN=$((WARN + 1))
    fi
else
    echo -e "  ${YELLOW}WARN${NC} Not using HTTPS — skipping SSL check"
    WARN=$((WARN + 1))
fi
echo ""

# ── 7. Response Times ────────────────────────────────────
echo "7. Response Time Thresholds"
for endpoint in "/health" "/api/v1/devices" "/"; do
    LATENCY=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$BASE_URL$endpoint" 2>/dev/null || echo "99")
    LATENCY_MS=$(echo "$LATENCY * 1000" | bc 2>/dev/null || echo "99999")
    LATENCY_INT=$(printf "%.0f" "$LATENCY_MS" 2>/dev/null || echo "99999")
    if [ "$LATENCY_INT" -lt 500 ]; then
        echo -e "  ${GREEN}PASS${NC} $endpoint → ${LATENCY_INT}ms (< 500ms)"
        PASS=$((PASS + 1))
    elif [ "$LATENCY_INT" -lt 2000 ]; then
        echo -e "  ${YELLOW}WARN${NC} $endpoint → ${LATENCY_INT}ms (< 2000ms but slow)"
        WARN=$((WARN + 1))
    else
        echo -e "  ${RED}FAIL${NC} $endpoint → ${LATENCY_INT}ms (too slow)"
        FAIL=$((FAIL + 1))
    fi
done
echo ""

# ── Summary ──────────────────────────────────────────────
TOTAL=$((PASS + FAIL + WARN))
echo "═══════════════════════════════════════════════════════"
echo -e " Results: ${GREEN}$PASS passed${NC} / ${RED}$FAIL failed${NC} / ${YELLOW}$WARN warnings${NC} (total: $TOTAL)"
echo "═══════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
    echo ""
    echo "FAILED CHECKS:"
    for r in "${RESULTS[@]}"; do
        if [[ "$r" == FAIL* ]]; then
            echo "  - $(echo "$r" | cut -d'|' -f2)"
        fi
    done
    exit 1
fi

exit 0
