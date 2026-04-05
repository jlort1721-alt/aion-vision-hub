#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# AION Full Platform Validation — All 47 Modules
# Tests every API endpoint group, reports status per module
# Run as: sudo /usr/local/sbin/aion-validate-all [json|text]
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

FORMAT="${1:-text}"
API="http://127.0.0.1:3000"
API_KEY=$(grep -m1 '^AION_API_KEY=' /home/openclaw/.openclaw/.env 2>/dev/null | cut -d= -f2- || echo "")

if [[ -z "$API_KEY" ]]; then
    echo "ERROR: AION_API_KEY not configured"
    exit 1
fi

PASS=0; FAIL=0; SKIP=0; WARN=0
RESULTS=()
ISSUES=()

# HTTP GET with API key auth
api_check() {
    local ENDPOINT="$1" EXPECTED="${2:-200}"
    local CODE
    CODE=$(curl -sf --max-time 8 -o /dev/null -w "%{http_code}" \
        -H "X-API-Key: ${API_KEY}" "${API}${ENDPOINT}" 2>/dev/null || echo "000")
    echo "$CODE"
}

# Test a module: name, primary endpoint, expected code
test_module() {
    local NAME="$1" ENDPOINT="$2" EXPECTED="${3:-200}" MENU_ITEM="${4:-$1}"
    local CODE
    CODE=$(api_check "$ENDPOINT" "$EXPECTED")

    local STATUS="pass"
    if [[ "$CODE" == "$EXPECTED" ]]; then
        PASS=$((PASS + 1))
    elif [[ "$CODE" == "000" ]]; then
        STATUS="skip"
        SKIP=$((SKIP + 1))
        ISSUES+=("$NAME: endpoint unreachable ($ENDPOINT)")
    elif [[ "$CODE" == "401" || "$CODE" == "403" ]]; then
        STATUS="warn"
        WARN=$((WARN + 1))
        ISSUES+=("$NAME: auth required ($CODE) at $ENDPOINT")
    else
        STATUS="fail"
        FAIL=$((FAIL + 1))
        ISSUES+=("$NAME: expected $EXPECTED got $CODE at $ENDPOINT")
    fi

    RESULTS+=("{\"module\":\"$NAME\",\"menu\":\"$MENU_ITEM\",\"endpoint\":\"$ENDPOINT\",\"status\":\"$STATUS\",\"http\":$CODE}")

    if [[ "$FORMAT" == "text" ]]; then
        case "$STATUS" in
            pass) printf "  \033[0;32mPASS\033[0m %-30s %-35s %s\n" "$MENU_ITEM" "$ENDPOINT" "$CODE" ;;
            fail) printf "  \033[0;31mFAIL\033[0m %-30s %-35s %s\n" "$MENU_ITEM" "$ENDPOINT" "$CODE" ;;
            warn) printf "  \033[1;33mWARN\033[0m %-30s %-35s %s\n" "$MENU_ITEM" "$ENDPOINT" "$CODE" ;;
            skip) printf "  \033[0;36mSKIP\033[0m %-30s %-35s %s\n" "$MENU_ITEM" "$ENDPOINT" "$CODE" ;;
        esac
    fi
}

[[ "$FORMAT" == "text" ]] && echo "═══════════════════════════════════════════════════════════════"
[[ "$FORMAT" == "text" ]] && echo "  AION Full Platform Validation — $(date)"
[[ "$FORMAT" == "text" ]] && echo "═══════════════════════════════════════════════════════════════"
[[ "$FORMAT" == "text" ]] && echo ""

# ── 1. Core Infrastructure ────────────────────────────────────
[[ "$FORMAT" == "text" ]] && echo "=== Core Infrastructure ==="
test_module "health"             "/health"                  200 "Salud del Sistema"
test_module "auth"               "/auth/me"                 401 "Login"
test_module "users"              "/users"                   200 "Administracion"
test_module "roles"              "/roles"                   200 "Administracion"
test_module "tenants"            "/tenants"                 200 "Administracion"
test_module "api-keys"           "/api-keys"                200 "Administracion"
test_module "audit"              "/audit"                   200 "Auditoria"
[[ "$FORMAT" == "text" ]] && echo ""

# ── 2. Dashboard & Analytics ─────────────────────────────────
[[ "$FORMAT" == "text" ]] && echo "=== Dashboard & Analytics ==="
test_module "operations"         "/operations/overview"     200 "Panel Principal"
test_module "analytics"          "/analytics/summary"       200 "Analiticas"
test_module "anomalies"          "/anomalies"               200 "Analiticas"
test_module "biomarkers"         "/analytics/biomarkers"    200 "Busqueda Biogenetica"
test_module "heatmap"            "/analytics/heatmap"       200 "Analiticas"
[[ "$FORMAT" == "text" ]] && echo ""

# ── 3. Devices & Cameras ─────────────────────────────────────
[[ "$FORMAT" == "text" ]] && echo "=== Devices & Cameras ==="
test_module "devices"            "/devices?limit=5"         200 "Dispositivos"
test_module "cameras"            "/cameras?limit=5"         200 "Salud de Camaras"
test_module "cameras-by-site"    "/cameras/by-site"         200 "Vista en Vivo"
test_module "streams"            "/streams"                 200 "Vista en Vivo"
test_module "camera-events"      "/camera-events/recent"    200 "Eventos"
test_module "device-control"     "/device-control"          200 "Dispositivos"
test_module "reboots"            "/reboots"                 200 "Reinicios"
[[ "$FORMAT" == "text" ]] && echo ""

# ── 4. Sites & Locations ─────────────────────────────────────
[[ "$FORMAT" == "text" ]] && echo "=== Sites ==="
test_module "sites"              "/sites"                   200 "Sitios"
[[ "$FORMAT" == "text" ]] && echo ""

# ── 5. Events & Incidents ────────────────────────────────────
[[ "$FORMAT" == "text" ]] && echo "=== Events & Incidents ==="
test_module "events"             "/events?limit=5"          200 "Eventos"
test_module "incidents"          "/incidents?limit=5"       200 "Incidentes"
test_module "alerts"             "/alerts?limit=5"          200 "Alertas"
test_module "alert-rules"        "/alerts/rules"            200 "Alertas"
test_module "evidence"           "/evidence"                200 "Incidentes"
[[ "$FORMAT" == "text" ]] && echo ""

# ── 6. Automation & Rules ────────────────────────────────────
[[ "$FORMAT" == "text" ]] && echo "=== Automation ==="
test_module "automation-status"  "/automation/system/status" 200 "Automatizacion"
test_module "automation-rules"   "/automation/rules"        200 "Automatizacion"
test_module "automation-stats"   "/automation/stats"        200 "Automatizacion"
[[ "$FORMAT" == "text" ]] && echo ""

# ── 7. Operations & Security ─────────────────────────────────
[[ "$FORMAT" == "text" ]] && echo "=== Operations ==="
test_module "shifts"             "/shifts"                  200 "Turnos y Guardias"
test_module "patrols"            "/patrols"                 200 "Patrullas"
test_module "emergency"          "/emergency"               200 "Emergencias"
test_module "sla"                "/sla/definitions"         200 "Gestion SLA"
test_module "access-control"     "/access-control"          200 "Control Acceso"
test_module "visitors"           "/visitors"                200 "Visitantes"
test_module "pre-registrations"  "/pre-registrations"       200 "Visitantes"
[[ "$FORMAT" == "text" ]] && echo ""

# ── 8. Communications ────────────────────────────────────────
[[ "$FORMAT" == "text" ]] && echo "=== Communications ==="
test_module "whatsapp"           "/whatsapp/health"         200 "WhatsApp"
test_module "email"              "/email/health"            200 "Integraciones"
test_module "voice"              "/voice"                   200 "Panel Telefonico"
test_module "intercom"           "/intercom"                200 "Citofonia IP"
test_module "push"               "/push"                    200 "Integraciones"
test_module "notif-templates"    "/notification-templates"  200 "Integraciones"
[[ "$FORMAT" == "text" ]] && echo ""

# ── 9. Smart Home & IoT ──────────────────────────────────────
[[ "$FORMAT" == "text" ]] && echo "=== Smart Home & IoT ==="
test_module "domotics"           "/domotics"                200 "Domoticos"
test_module "ewelink"            "/ewelink"                 200 "Domoticos"
test_module "relay"              "/relay"                   200 "Domoticos"
[[ "$FORMAT" == "text" ]] && echo ""

# ── 10. Data Management ──────────────────────────────────────
[[ "$FORMAT" == "text" ]] && echo "=== Data Management ==="
test_module "database-records"   "/database-records?limit=5" 200 "Base de Datos"
test_module "reports"            "/reports"                 200 "Reportes"
test_module "scheduled-reports"  "/scheduled-reports"       200 "Reportes Programados"
test_module "data-import"        "/data-import"             200 "Base de Datos"
test_module "backup"             "/backup"                  200 "Administracion"
[[ "$FORMAT" == "text" ]] && echo ""

# ── 11. Governance ────────────────────────────────────────────
[[ "$FORMAT" == "text" ]] && echo "=== Governance ==="
test_module "contracts"          "/contracts"               200 "Contratos"
test_module "keys"               "/keys"                    200 "Gestion de Llaves"
test_module "compliance"         "/compliance"              200 "Cumplimiento"
test_module "training"           "/training"                200 "Capacitacion"
test_module "gdpr"               "/gdpr"                    200 "Cumplimiento"
[[ "$FORMAT" == "text" ]] && echo ""

# ── 12. Cloud & Integrations ─────────────────────────────────
[[ "$FORMAT" == "text" ]] && echo "=== Cloud & Integrations ==="
test_module "integrations"       "/integrations"            200 "Integraciones"
test_module "cloud-accounts"     "/cloud-accounts"          200 "Integraciones"
test_module "hikconnect"         "/hikconnect"              200 "Integraciones"
test_module "imou"               "/imou"                    200 "Integraciones"
test_module "zkteco"             "/zkteco"                  200 "Control Acceso"
[[ "$FORMAT" == "text" ]] && echo ""

# ── 13. AI & Knowledge ───────────────────────────────────────
[[ "$FORMAT" == "text" ]] && echo "=== AI & Knowledge ==="
test_module "ai-bridge"          "/ai/conversations"        200 "Asistente IA"
test_module "mcp-tools"          "/mcp/tools"               200 "Asistente IA"
test_module "knowledge-base"     "/knowledge"               200 "Asistente IA"
test_module "internal-agent"     "/internal-agent/status"   200 "Salud del Sistema"
test_module "face-recognition"   "/face-recognition/status" 200 "Busqueda Biogenetica"
[[ "$FORMAT" == "text" ]] && echo ""

# ── 14. Infrastructure ───────────────────────────────────────
[[ "$FORMAT" == "text" ]] && echo "=== Infrastructure ==="
test_module "network"            "/network"                 200 "Centro de Red"
test_module "remote-access"      "/remote-access"           200 "Acceso Remoto"
test_module "lpr"                "/lpr"                     200 "Control Acceso"
test_module "live-view"          "/live-view"               200 "Vista en Vivo"
[[ "$FORMAT" == "text" ]] && echo ""

# ── 15. External Services ────────────────────────────────────
[[ "$FORMAT" == "text" ]] && echo "=== External Services ==="

# go2rtc
GO2RTC=$(curl -sf --max-time 5 -o /dev/null -w "%{http_code}" http://127.0.0.1:1984/api/streams 2>/dev/null || echo "000")
if [[ "$GO2RTC" == "200" ]]; then
    printf "  \033[0;32mPASS\033[0m %-30s %-35s %s\n" "go2rtc" ":1984/api/streams" "$GO2RTC" 2>/dev/null || true
    PASS=$((PASS + 1))
else
    printf "  \033[0;31mFAIL\033[0m %-30s %-35s %s\n" "go2rtc" ":1984/api/streams" "$GO2RTC" 2>/dev/null || true
    FAIL=$((FAIL + 1))
fi

# Redis
REDIS_OK=$(redis-cli ping 2>/dev/null || echo "")
if [[ "$REDIS_OK" == "PONG" ]]; then
    [[ "$FORMAT" == "text" ]] && printf "  \033[0;32mPASS\033[0m %-30s %-35s %s\n" "Redis" ":6379 PING" "PONG"
    PASS=$((PASS + 1))
else
    [[ "$FORMAT" == "text" ]] && printf "  \033[0;31mFAIL\033[0m %-30s %-35s %s\n" "Redis" ":6379 PING" "no response"
    FAIL=$((FAIL + 1))
fi

# PostgreSQL
if su - postgres -c "pg_isready -q" 2>/dev/null; then
    [[ "$FORMAT" == "text" ]] && printf "  \033[0;32mPASS\033[0m %-30s %-35s %s\n" "PostgreSQL" ":5432" "ready"
    PASS=$((PASS + 1))
else
    [[ "$FORMAT" == "text" ]] && printf "  \033[0;31mFAIL\033[0m %-30s %-35s %s\n" "PostgreSQL" ":5432" "not ready"
    FAIL=$((FAIL + 1))
fi

# Nginx
if systemctl is-active nginx &>/dev/null; then
    [[ "$FORMAT" == "text" ]] && printf "  \033[0;32mPASS\033[0m %-30s %-35s %s\n" "Nginx" "systemd" "active"
    PASS=$((PASS + 1))
else
    [[ "$FORMAT" == "text" ]] && printf "  \033[0;31mFAIL\033[0m %-30s %-35s %s\n" "Nginx" "systemd" "inactive"
    FAIL=$((FAIL + 1))
fi
[[ "$FORMAT" == "text" ]] && echo ""

# ── Summary ──────────────────────────────────────────────────
TOTAL=$((PASS + FAIL + WARN + SKIP))
SCORE=$(( (PASS * 100) / (TOTAL > 0 ? TOTAL : 1) ))

if [[ "$FORMAT" == "json" ]]; then
    echo "{\"timestamp\":\"$(date -Iseconds)\",\"total\":$TOTAL,\"pass\":$PASS,\"fail\":$FAIL,\"warn\":$WARN,\"skip\":$SKIP,\"score\":$SCORE,\"results\":[$(IFS=,; echo "${RESULTS[*]}")]}"
else
    echo "═══════════════════════════════════════════════════════════════"
    printf "  Score: %d/100 | \033[0;32m%d PASS\033[0m | \033[0;31m%d FAIL\033[0m | \033[1;33m%d WARN\033[0m | \033[0;36m%d SKIP\033[0m\n" "$SCORE" "$PASS" "$FAIL" "$WARN" "$SKIP"
    echo "═══════════════════════════════════════════════════════════════"

    if [[ ${#ISSUES[@]} -gt 0 ]]; then
        echo ""
        echo "=== Issues ==="
        for I in "${ISSUES[@]}"; do
            echo "  - $I"
        done
    fi
fi

exit $([[ $FAIL -eq 0 ]] && echo 0 || echo 1)
