#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# AION Vision Hub — Post-Deploy Smoke Tests
# Usage: ./smoke-tests.sh [BASE_URL]
# Default: http://localhost:3000
# ═══════════════════════════════════════════════════════════

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
# Strip trailing slash
BASE_URL="${BASE_URL%/}"

# Derive WebSocket URL from BASE_URL
WS_URL="${BASE_URL/http:/ws:}"
WS_URL="${WS_URL/https:/wss:}"

PASS=0
FAIL=0
TOTAL=0
RESULTS=()

# ── Helpers ──────────────────────────────────────────────

print_header() {
    echo ""
    echo "═══════════════════════════════════════════════════════"
    echo "  AION Vision Hub — Smoke Tests"
    echo "  Target: ${BASE_URL}"
    echo "  Date:   $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    echo "═══════════════════════════════════════════════════════"
    echo ""
}

record_result() {
    local test_name="$1"
    local status="$2"
    local detail="${3:-}"
    TOTAL=$((TOTAL + 1))

    if [ "$status" = "PASS" ]; then
        PASS=$((PASS + 1))
        RESULTS+=("[PASS] ${test_name}")
        echo "  [PASS] ${test_name}"
    else
        FAIL=$((FAIL + 1))
        RESULTS+=("[FAIL] ${test_name}: ${detail}")
        echo "  [FAIL] ${test_name}: ${detail}"
    fi
}

# ── Test 1: Health endpoint ──────────────────────────────

test_health() {
    echo "── Test 1: GET /health → 200"
    local http_code
    http_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${BASE_URL}/health" 2>/dev/null || echo "000")

    if [ "$http_code" = "200" ]; then
        record_result "GET /health returns 200" "PASS"
    else
        record_result "GET /health returns 200" "FAIL" "Got HTTP ${http_code}"
    fi
}

# ── Test 2: Readiness endpoint ───────────────────────────

test_readiness() {
    echo "── Test 2: GET /health/ready → 200 with ok status"
    local response http_code body
    response=$(curl -s -w '\n%{http_code}' --max-time 10 "${BASE_URL}/health/ready" 2>/dev/null || echo -e '\n000')
    body=$(echo "$response" | head -n -1)
    http_code=$(echo "$response" | tail -n 1)

    if [ "$http_code" = "200" ] && echo "$body" | grep -qi '"ok"\|"status".*"ok"'; then
        record_result "GET /health/ready returns 200 with ok" "PASS"
    else
        record_result "GET /health/ready returns 200 with ok" "FAIL" "HTTP ${http_code}, body: ${body:0:120}"
    fi
}

# ── Test 3: Auth rejects invalid credentials ─────────────

test_auth_invalid() {
    echo "── Test 3: POST /auth/login with invalid creds → 401"
    local http_code
    http_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"smoke-test@invalid.local","password":"wrong-password-12345"}' \
        "${BASE_URL}/auth/login" 2>/dev/null || echo "000")

    if [ "$http_code" = "401" ]; then
        record_result "POST /auth/login invalid creds → 401" "PASS"
    else
        record_result "POST /auth/login invalid creds → 401" "FAIL" "Got HTTP ${http_code}"
    fi
}

# ── Test 4: Auth protection on devices ────────────────────

test_devices_auth() {
    echo "── Test 4: GET /devices without auth → 401"
    local http_code
    http_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
        "${BASE_URL}/devices" 2>/dev/null || echo "000")

    if [ "$http_code" = "401" ]; then
        record_result "GET /devices without auth → 401" "PASS"
    else
        record_result "GET /devices without auth → 401" "FAIL" "Got HTTP ${http_code}"
    fi
}

# ── Test 5: Metrics endpoint ─────────────────────────────

test_metrics() {
    echo "── Test 5: GET /health/metrics → 200"
    local http_code
    http_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
        "${BASE_URL}/health/metrics" 2>/dev/null || echo "000")

    if [ "$http_code" = "200" ]; then
        record_result "GET /health/metrics returns 200" "PASS"
    else
        record_result "GET /health/metrics returns 200" "FAIL" "Got HTTP ${http_code}"
    fi
}

# ── Test 6: WebSocket connection ──────────────────────────

test_websocket() {
    echo "── Test 6: WebSocket connection to /ws"

    # Check if we have a tool that can test websockets
    if command -v websocat &>/dev/null; then
        local ws_result
        ws_result=$(echo "" | timeout 5 websocat --one-message "${WS_URL}/ws" 2>&1) && ws_ok=true || ws_ok=false
        if [ "$ws_ok" = true ] || echo "$ws_result" | grep -qi "connected\|upgrade\|open"; then
            record_result "WebSocket /ws connection" "PASS"
        else
            record_result "WebSocket /ws connection" "FAIL" "websocat failed: ${ws_result:0:100}"
        fi
    elif command -v curl &>/dev/null; then
        # Use curl with websocket upgrade headers to test
        local http_code
        http_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
            -H "Upgrade: websocket" \
            -H "Connection: Upgrade" \
            -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
            -H "Sec-WebSocket-Version: 13" \
            "${BASE_URL}/ws" 2>/dev/null || echo "000")

        if [ "$http_code" = "101" ] || [ "$http_code" = "426" ] || [ "$http_code" = "400" ]; then
            # 101 = switching protocols (success)
            # 426 = upgrade required (server recognizes WS but needs auth)
            # 400 = bad request (server recognized WS attempt)
            record_result "WebSocket /ws endpoint responds" "PASS"
        else
            record_result "WebSocket /ws endpoint responds" "FAIL" "Got HTTP ${http_code}"
        fi
    else
        record_result "WebSocket /ws connection" "FAIL" "No WebSocket client available (install websocat or curl)"
    fi
}

# ── Test 7: Response headers ──────────────────────────────

test_response_headers() {
    echo "── Test 7: Response headers (CORS, security)"
    local headers
    headers=$(curl -s -D - -o /dev/null --max-time 10 "${BASE_URL}/health" 2>/dev/null || echo "")

    local missing=""

    # Check security headers
    if ! echo "$headers" | grep -qi "x-content-type-options"; then
        missing="${missing} X-Content-Type-Options"
    fi

    if ! echo "$headers" | grep -qi "x-frame-options\|content-security-policy"; then
        missing="${missing} X-Frame-Options/CSP"
    fi

    # Check for CORS headers (may only appear with Origin header)
    local cors_headers
    cors_headers=$(curl -s -D - -o /dev/null --max-time 10 \
        -H "Origin: https://aionseg.co" \
        "${BASE_URL}/health" 2>/dev/null || echo "")

    if ! echo "$cors_headers" | grep -qi "access-control-allow"; then
        missing="${missing} CORS"
    fi

    if [ -z "$missing" ]; then
        record_result "Security & CORS headers present" "PASS"
    else
        record_result "Security & CORS headers present" "FAIL" "Missing:${missing}"
    fi
}

# ── Test 8: Rate limiting ─────────────────────────────────

test_rate_limit() {
    echo "── Test 8: Rate limiting on /auth/login"
    local got_429=false
    local last_code="000"

    # Send rapid requests to trigger rate limiting
    # Most setups have stricter limits on auth endpoints (e.g., 5/min)
    for i in $(seq 1 20); do
        last_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
            -X POST \
            -H "Content-Type: application/json" \
            -d '{"email":"ratelimit-test@invalid.local","password":"test12345"}' \
            "${BASE_URL}/auth/login" 2>/dev/null || echo "000")

        if [ "$last_code" = "429" ]; then
            got_429=true
            break
        fi
    done

    if [ "$got_429" = true ]; then
        record_result "Rate limiting triggers 429" "PASS"
    else
        record_result "Rate limiting triggers 429" "FAIL" "Sent 20 rapid requests, last code: ${last_code} (no 429 received)"
    fi
}

# ── Run All Tests ─────────────────────────────────────────

print_header

test_health
test_readiness
test_auth_invalid
test_devices_auth
test_metrics
test_websocket
test_response_headers
test_rate_limit

# ── Summary ───────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  SUMMARY: ${PASS}/${TOTAL} passed, ${FAIL} failed"
echo "═══════════════════════════════════════════════════════"
echo ""

for result in "${RESULTS[@]}"; do
    echo "  ${result}"
done

echo ""

if [ "$FAIL" -gt 0 ]; then
    echo "EXIT: Some tests failed."
    exit 1
else
    echo "EXIT: All tests passed."
    exit 0
fi
