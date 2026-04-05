#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Integration Test — OpenClaw + AION
# Ejecuta todos los wrappers y verifica que funcionan end-to-end
# Ejecutar como: sudo -iu openclaw bash test-integration.sh
# O como root: sudo bash test-integration.sh
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

PASS=0; FAIL=0; SKIP=0
ERRORS=()

run_test() {
    local NAME="$1"
    shift
    local CMD="$*"
    printf "  %-40s " "$NAME"

    OUTPUT=$(eval "sudo $CMD" 2>&1) && RC=$? || RC=$?

    if [[ $RC -eq 0 ]]; then
        echo -e "\033[0;32mPASS\033[0m"
        PASS=$((PASS + 1))
    else
        echo -e "\033[0;31mFAIL\033[0m (exit $RC)"
        ERRORS+=("$NAME: $OUTPUT")
        FAIL=$((FAIL + 1))
    fi
}

run_test_output() {
    local NAME="$1" EXPECTED="$2"
    shift 2
    local CMD="$*"
    printf "  %-40s " "$NAME"

    OUTPUT=$(eval "sudo $CMD" 2>&1) && RC=$? || RC=$?

    if echo "$OUTPUT" | grep -qi "$EXPECTED"; then
        echo -e "\033[0;32mPASS\033[0m"
        PASS=$((PASS + 1))
    else
        echo -e "\033[0;31mFAIL\033[0m (expected '$EXPECTED')"
        ERRORS+=("$NAME: got '$OUTPUT'")
        FAIL=$((FAIL + 1))
    fi
}

skip_test() {
    local NAME="$1" REASON="$2"
    printf "  %-40s \033[1;33mSKIP\033[0m (%s)\n" "$NAME" "$REASON"
    SKIP=$((SKIP + 1))
}

echo "═══════════════════════════════════════════════════════════"
echo "  OpenClaw + AION — Integration Tests"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── 1. Wrappers de lectura ────────────────────────────────────
echo "=== 1. Read Wrappers ==="

run_test "aion-status" "/usr/local/sbin/aion-status"
run_test "aion-health (text)" "/usr/local/sbin/aion-health"
run_test "aion-health (json)" "/usr/local/sbin/aion-health json"
run_test "aion-logs backend-api 10" "/usr/local/sbin/aion-logs backend-api 10"
run_test "aion-logs errors 10" "/usr/local/sbin/aion-logs errors 10"
run_test "aion-nginx-test" "/usr/local/sbin/aion-nginx-test"
run_test "aion-disk-usage" "/usr/local/sbin/aion-disk-usage"
run_test "aion-redis-ping" "/usr/local/sbin/aion-redis-ping"
run_test "aion-pg-status" "/usr/local/sbin/aion-pg-status"
run_test "aion-go2rtc-status" "/usr/local/sbin/aion-go2rtc-status"

# Asterisk might not be running
if systemctl is-active asterisk &>/dev/null; then
    run_test "aion-asterisk-status" "/usr/local/sbin/aion-asterisk-status"
else
    skip_test "aion-asterisk-status" "asterisk not running"
fi

echo ""

# ── 2. MQTT ───────────────────────────────────────────────────
echo "=== 2. MQTT ==="
if systemctl is-active mosquitto &>/dev/null; then
    run_test "aion-mqtt-read (timeout ok)" "/usr/local/sbin/aion-mqtt-read test/ping 1"
else
    skip_test "aion-mqtt-read" "mosquitto not running"
fi

echo ""

# ── 3. API Query ──────────────────────────────────────────────
echo "=== 3. API Query ==="
API_KEY=$(grep -m1 '^AION_API_KEY=' /home/openclaw/.openclaw/.env 2>/dev/null | cut -d= -f2- || echo "")

if [[ -n "$API_KEY" && "$API_KEY" != "REEMPLAZA"* ]]; then
    run_test "aion-api-query /health" "/usr/local/sbin/aion-api-query /health"
    run_test_output "aion-api-query /sites" "id" "/usr/local/sbin/aion-api-query /sites"
else
    skip_test "aion-api-query /health" "AION_API_KEY not configured"
    skip_test "aion-api-query /sites" "AION_API_KEY not configured"
fi

echo ""

# ── 4. DB Query ───────────────────────────────────────────────
echo "=== 4. DB Query ==="
DB_URL=$(grep -m1 '^AION_DB_READONLY_URL=' /home/openclaw/.openclaw/.env 2>/dev/null | cut -d= -f2- || echo "")

if [[ -n "$DB_URL" && "$DB_URL" != *"REEMPLAZA"* ]]; then
    run_test_output "aion-db-query SELECT 1" "1" "/usr/local/sbin/aion-db-query 'SELECT 1 AS test'"
    run_test_output "aion-db-query tables count" "tables" "/usr/local/sbin/aion-db-query \"SELECT count(*) || ' tables' FROM information_schema.tables WHERE table_schema = 'public'\""

    # Security: these MUST fail
    printf "  %-40s " "BLOCK: DROP TABLE"
    if sudo /usr/local/sbin/aion-db-query "DROP TABLE sites" 2>&1 | grep -qi "ERROR"; then
        echo -e "\033[0;32mPASS\033[0m (blocked)"
        PASS=$((PASS + 1))
    else
        echo -e "\033[0;31mFAIL\033[0m (not blocked!)"
        FAIL=$((FAIL + 1))
    fi

    printf "  %-40s " "BLOCK: semicolon injection"
    if sudo /usr/local/sbin/aion-db-query "SELECT 1; DROP TABLE sites" 2>&1 | grep -qi "ERROR"; then
        echo -e "\033[0;32mPASS\033[0m (blocked)"
        PASS=$((PASS + 1))
    else
        echo -e "\033[0;31mFAIL\033[0m (not blocked!)"
        FAIL=$((FAIL + 1))
    fi

    printf "  %-40s " "BLOCK: DELETE in CTE"
    if sudo /usr/local/sbin/aion-db-query "WITH x AS (DELETE FROM sites RETURNING *) SELECT * FROM x" 2>&1 | grep -qi "ERROR"; then
        echo -e "\033[0;32mPASS\033[0m (blocked)"
        PASS=$((PASS + 1))
    else
        echo -e "\033[0;31mFAIL\033[0m (not blocked!)"
        FAIL=$((FAIL + 1))
    fi
else
    skip_test "aion-db-query" "AION_DB_READONLY_URL not configured"
fi

echo ""

# ── 5. Write Wrappers (rate-limited) ─────────────────────────
echo "=== 5. Write Wrappers ==="

printf "  %-40s " "aion-restart (no args = usage)"
OUTPUT=$(sudo /usr/local/sbin/aion-restart 2>&1) && RC=$? || RC=$?
if [[ $RC -ne 0 ]] && echo "$OUTPUT" | grep -qi "uso\|servicios"; then
    echo -e "\033[0;32mPASS\033[0m (shows usage)"
    PASS=$((PASS + 1))
else
    echo -e "\033[0;31mFAIL\033[0m"
    FAIL=$((FAIL + 1))
fi

printf "  %-40s " "BLOCK: aion-restart invalid-service"
if sudo /usr/local/sbin/aion-restart "not-a-service" 2>&1 | grep -qi "ERROR\|no permitido"; then
    echo -e "\033[0;32mPASS\033[0m (blocked)"
    PASS=$((PASS + 1))
else
    echo -e "\033[0;31mFAIL\033[0m (not blocked!)"
    FAIL=$((FAIL + 1))
fi

printf "  %-40s " "BLOCK: aion-restart injection attempt"
if sudo /usr/local/sbin/aion-restart 'aion-api; rm -rf /' 2>&1 | grep -qi "ERROR\|no permitido"; then
    echo -e "\033[0;32mPASS\033[0m (blocked)"
    PASS=$((PASS + 1))
else
    echo -e "\033[0;31mFAIL\033[0m (not blocked!)"
    FAIL=$((FAIL + 1))
fi

echo ""

# ── 6. OpenClaw itself ───────────────────────────────────────
echo "=== 6. OpenClaw ==="

if command -v openclaw &>/dev/null || su - openclaw -c "which openclaw" &>/dev/null; then
    run_test "openclaw --version" "su - openclaw -c 'openclaw --version'"

    # Config validation
    printf "  %-40s " "openclaw config validate"
    OUTPUT=$(su - openclaw -c "openclaw config validate" 2>&1) && RC=$? || RC=$?
    if [[ $RC -eq 0 ]]; then
        echo -e "\033[0;32mPASS\033[0m"
        PASS=$((PASS + 1))
    else
        echo -e "\033[0;31mFAIL\033[0m"
        ERRORS+=("config validate: $OUTPUT")
        FAIL=$((FAIL + 1))
    fi
else
    skip_test "openclaw --version" "openclaw not installed"
    skip_test "openclaw config validate" "openclaw not installed"
fi

echo ""

# ── 7. Security checks ───────────────────────────────────────
echo "=== 7. Security ==="

printf "  %-40s " "Port 18789 not public"
if ss -tlnp 2>/dev/null | grep -q "0.0.0.0:18789\|:::18789"; then
    echo -e "\033[0;31mFAIL\033[0m (exposed!)"
    FAIL=$((FAIL + 1))
else
    echo -e "\033[0;32mPASS\033[0m"
    PASS=$((PASS + 1))
fi

printf "  %-40s " "openclaw not in sudo group"
if groups openclaw 2>/dev/null | grep -qw sudo; then
    echo -e "\033[0;31mFAIL\033[0m"
    FAIL=$((FAIL + 1))
else
    echo -e "\033[0;32mPASS\033[0m"
    PASS=$((PASS + 1))
fi

printf "  %-40s " "sudoers env_reset enabled"
if grep -q "env_reset" /etc/sudoers.d/openclaw-aion 2>/dev/null; then
    echo -e "\033[0;32mPASS\033[0m"
    PASS=$((PASS + 1))
else
    echo -e "\033[0;31mFAIL\033[0m"
    FAIL=$((FAIL + 1))
fi

printf "  %-40s " ".env permissions 600"
PERMS=$(stat -c %a /home/openclaw/.openclaw/.env 2>/dev/null || echo "???")
if [[ "$PERMS" == "600" ]]; then
    echo -e "\033[0;32mPASS\033[0m"
    PASS=$((PASS + 1))
else
    echo -e "\033[0;31mFAIL\033[0m (perms: $PERMS)"
    FAIL=$((FAIL + 1))
fi

echo ""

# ── Resumen ──────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL + SKIP))
echo -e "  Results: \033[0;32m${PASS} PASS\033[0m | \033[0;31m${FAIL} FAIL\033[0m | \033[1;33m${SKIP} SKIP\033[0m | Total: ${TOTAL}"
echo "═══════════════════════════════════════════════════════════"

if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo ""
    echo "=== Error Details ==="
    for E in "${ERRORS[@]}"; do
        echo "  - $E" | head -3
    done
fi

exit $([[ $FAIL -eq 0 ]] && echo 0 || echo 1)
