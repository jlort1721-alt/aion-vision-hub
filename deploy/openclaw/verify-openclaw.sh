#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Verificacion post-deploy de OpenClaw en AION VPS (v2)
# 35+ checks: seguridad, permisos, servicios, aislamiento, wrappers
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

PASS=0; FAIL=0; WARN=0

check_pass() { printf "  \033[0;32m[PASS]\033[0m %s\n" "$*"; PASS=$((PASS + 1)); }
check_fail() { printf "  \033[0;31m[FAIL]\033[0m %s\n" "$*"; FAIL=$((FAIL + 1)); }
check_warn() { printf "  \033[1;33m[WARN]\033[0m %s\n" "$*"; WARN=$((WARN + 1)); }

echo "═══════════════════════════════════════════════════════════"
echo "  OpenClaw + AION — Verificacion de Seguridad (v2)"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ── 1. Usuario openclaw ──────────────────────────────────────
echo "=== 1. Usuario y Permisos ==="

if id openclaw &>/dev/null; then
    check_pass "Usuario 'openclaw' existe"
else
    check_fail "Usuario 'openclaw' no existe"
fi

if groups openclaw 2>/dev/null | grep -qw sudo; then
    check_fail "Usuario 'openclaw' en grupo sudo — RIESGO"
else
    check_pass "Usuario 'openclaw' NO en grupo sudo"
fi

if groups openclaw 2>/dev/null | grep -qw docker; then
    check_pass "Usuario 'openclaw' tiene acceso a Docker"
else
    check_warn "Usuario 'openclaw' sin acceso a Docker"
fi

# ── 2. Archivos de configuracion ─────────────────────────────
echo ""
echo "=== 2. Configuracion ==="

OPENCLAW_HOME="/home/openclaw/.openclaw"

for F in openclaw.json .env exec-approvals.json; do
    FPATH="${OPENCLAW_HOME}/${F}"
    if [[ -f "$FPATH" ]]; then
        PERMS=$(stat -c %a "$FPATH" 2>/dev/null || stat -f %Lp "$FPATH" 2>/dev/null)
        OWNER=$(stat -c %U "$FPATH" 2>/dev/null || stat -f %Su "$FPATH" 2>/dev/null)
        if [[ "$PERMS" == "600" && "$OWNER" == "openclaw" ]]; then
            check_pass "$F (600:openclaw)"
        else
            check_warn "$F (perms:$PERMS owner:$OWNER) — deberia ser 600:openclaw"
        fi
    else
        check_fail "$F no encontrado"
    fi
done

# Check for placeholder values
if grep -q "REEMPLAZA" "${OPENCLAW_HOME}/.env" 2>/dev/null; then
    check_fail ".env tiene valores REEMPLAZA sin configurar"
else
    check_pass ".env sin placeholders pendientes"
fi

# ── 3. Gateway NO expuesto ────────────────────────────────────
echo ""
echo "=== 3. Seguridad de Red ==="

if ss -tlnp 2>/dev/null | grep -q "0.0.0.0:18789\|:::18789"; then
    check_fail "Puerto 18789 en TODAS las interfaces — EXPUESTO"
elif ss -tlnp 2>/dev/null | grep -q "127.0.0.1:18789"; then
    check_pass "Puerto 18789 solo en loopback"
else
    check_warn "Puerto 18789 no escuchando (OpenClaw no arrancado?)"
fi

if grep -rq "18789" /etc/nginx/ 2>/dev/null; then
    check_fail "Nginx referencia puerto 18789"
else
    check_pass "Nginx NO proxea a 18789"
fi

if command -v ufw &>/dev/null; then
    if ufw status 2>/dev/null | grep -q "18789.*ALLOW"; then
        check_fail "UFW permite trafico a 18789"
    else
        check_pass "UFW no permite 18789"
    fi
fi

# ── 4. Wrappers AION (14 wrappers v2) ────────────────────────
echo ""
echo "=== 4. Wrappers AION ==="

WRAPPERS=(aion-status aion-health aion-logs aion-restart aion-nginx-test
          aion-disk-usage aion-redis-ping aion-pg-status aion-go2rtc-status
          aion-db-query aion-api-query aion-mqtt-read aion-asterisk-status
          aion-db-backup)

for W in "${WRAPPERS[@]}"; do
    WPATH="/usr/local/sbin/${W}"
    if [[ -f "$WPATH" ]]; then
        OWNER=$(stat -c %U "$WPATH" 2>/dev/null || stat -f %Su "$WPATH" 2>/dev/null)
        PERMS=$(stat -c %a "$WPATH" 2>/dev/null || stat -f %Lp "$WPATH" 2>/dev/null)
        if [[ "$OWNER" == "root" && "$PERMS" == "750" ]]; then
            check_pass "$W (root:750)"
        else
            check_warn "$W ($OWNER:$PERMS) — deberia ser root:750"
        fi
    else
        check_fail "$W no instalado"
    fi
done

# ── 5. Sudoers ────────────────────────────────────────────────
echo ""
echo "=== 5. Sudoers ==="

if [[ -f /etc/sudoers.d/openclaw-aion ]]; then
    if visudo -cf /etc/sudoers.d/openclaw-aion &>/dev/null; then
        check_pass "sudoers valido"
    else
        check_fail "sudoers INVALIDO"
    fi

    if grep -q "ALL=(ALL)" /etc/sudoers.d/openclaw-aion 2>/dev/null; then
        check_fail "sudoers tiene ALL=(ALL) — acceso root completo"
    else
        check_pass "sudoers restringido a wrappers"
    fi

    if grep -q "env_reset" /etc/sudoers.d/openclaw-aion 2>/dev/null; then
        check_pass "sudoers tiene env_reset (LD_PRELOAD bloqueado)"
    else
        check_fail "sudoers sin env_reset — vulnerable a LD_PRELOAD"
    fi
else
    check_fail "sudoers no configurado"
fi

# ── 6. AION sigue funcionando ─────────────────────────────────
echo ""
echo "=== 6. AION Integridad ==="

PM2_JSON=$(su - ubuntu -c "pm2 jlist" 2>/dev/null || echo "[]")
PM2_ONLINE=$(echo "$PM2_JSON" | jq '[.[] | select(.pm2_env.status == "online")] | length' 2>/dev/null || echo 0)
PM2_TOTAL=$(echo "$PM2_JSON" | jq 'length' 2>/dev/null || echo 0)

if [[ "$PM2_ONLINE" -eq "$PM2_TOTAL" && "$PM2_TOTAL" -gt 0 ]]; then
    check_pass "PM2: $PM2_ONLINE/$PM2_TOTAL online"
else
    check_fail "PM2: $PM2_ONLINE/$PM2_TOTAL online"
fi

HTTP_CODE=$(curl -sf --max-time 5 -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
    check_pass "Backend API: HTTP $HTTP_CODE"
else
    check_fail "Backend API: HTTP $HTTP_CODE"
fi

for SVC in nginx redis-server postgresql; do
    if systemctl is-active "$SVC" &>/dev/null; then
        check_pass "$SVC activo"
    else
        check_fail "$SVC NO activo"
    fi
done

# ── 7. Aislamiento ───────────────────────────────────────────
echo ""
echo "=== 7. Aislamiento ==="

# .env de AION no legible por openclaw
if su - openclaw -c "cat /opt/aion/app/backend/.env" &>/dev/null 2>&1; then
    check_warn "openclaw puede leer .env de AION"
else
    check_pass "openclaw NO puede leer .env de AION"
fi

# No puede escribir en /opt/aion
if su - openclaw -c "touch /opt/aion/test-write-$$" &>/dev/null 2>&1; then
    rm -f "/opt/aion/test-write-$$"
    check_fail "openclaw puede ESCRIBIR en /opt/aion"
else
    check_pass "openclaw NO puede escribir en /opt/aion"
fi

# docker.sock
DOCKER_SOCK="/var/run/docker.sock"
if [[ -S "$DOCKER_SOCK" ]]; then
    SOCK_GROUP=$(stat -c %G "$DOCKER_SOCK" 2>/dev/null || echo "unknown")
    if [[ "$SOCK_GROUP" == "docker" ]]; then
        check_warn "docker.sock via grupo docker (necesario para sandbox)"
    fi
fi

# ── 8. Infraestructura adicional ──────────────────────────────
echo ""
echo "=== 8. Infraestructura ==="

if [[ -f /etc/logrotate.d/openclaw ]]; then
    check_pass "Logrotate configurado"
else
    check_warn "Logrotate no configurado"
fi

if [[ -f /etc/systemd/system/aion-event-bridge.service ]]; then
    if systemctl is-active aion-event-bridge &>/dev/null; then
        check_pass "Event bridge activo"
    else
        check_warn "Event bridge instalado pero no activo"
    fi
else
    check_warn "Event bridge no instalado"
fi

if [[ -f /home/openclaw/openclaw-ops.sh ]]; then
    check_pass "openclaw-ops.sh instalado"
else
    check_fail "openclaw-ops.sh no encontrado"
fi

# ── Resumen ──────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
printf "  Resultados: \033[0;32m%d PASS\033[0m | \033[0;31m%d FAIL\033[0m | \033[1;33m%d WARN\033[0m\n" "$PASS" "$FAIL" "$WARN"
echo "═══════════════════════════════════════════════════════════"

if [[ $FAIL -gt 0 ]]; then
    echo ""
    echo "  HAY FALLOS. Corregir antes de produccion."
    exit 1
elif [[ $WARN -gt 0 ]]; then
    echo ""
    echo "  Warnings no bloqueantes pero revisar."
    exit 0
else
    echo ""
    echo "  Todo OK."
    exit 0
fi
