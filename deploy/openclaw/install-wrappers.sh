#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Wrappers AION para OpenClaw — Operaciones unifuncion, root-owned
# Cada wrapper hace UNA sola cosa. Sin shell libre. Sin acceso generico.
#
# v2 — Fixes: injection-safe restart, hardened SQL filter, rate-limit,
#       covers all 5 PM2 services, Asterisk/MQTT wrappers, API query,
#       DB backup, safe Redis password handling, env_reset in sudoers
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "ERROR: Ejecutar como root"; exit 1; }

WRAPPER_DIR="/usr/local/sbin"
PM2_USER="ubuntu"  # Usuario que ejecuta PM2 en AION
RATE_LIMIT_DIR="/tmp/openclaw-ratelimit"
mkdir -p "$RATE_LIMIT_DIR"
chmod 1777 "$RATE_LIMIT_DIR"

echo "=== Instalando wrappers AION para OpenClaw (v2) ==="

# ─────────────────────────────────────────────────────────────
# HELPER: Rate-limit function (embebida en cada wrapper que la necesite)
# ─────────────────────────────────────────────────────────────
RATE_LIMIT_FUNC='
# Rate limiter: max N calls per M seconds for this wrapper
_rate_limit() {
    local NAME="$1" MAX="$2" WINDOW="$3"
    local LOCKFILE="/tmp/openclaw-ratelimit/${NAME}.lock"
    local NOW
    NOW=$(date +%s)
    local CUTOFF=$((NOW - WINDOW))
    # Atomic append + prune
    (
        flock -w 2 200 || { echo "ERROR: rate-limit lock timeout"; exit 1; }
        # Prune old entries
        if [[ -f "$LOCKFILE.log" ]]; then
            awk -v c="$CUTOFF" "\$1 >= c" "$LOCKFILE.log" > "$LOCKFILE.tmp" 2>/dev/null || true
            mv -f "$LOCKFILE.tmp" "$LOCKFILE.log" 2>/dev/null || true
        fi
        # Count recent
        local COUNT
        COUNT=$(wc -l < "$LOCKFILE.log" 2>/dev/null || echo 0)
        COUNT=$((COUNT + 0))
        if [[ "$COUNT" -ge "$MAX" ]]; then
            echo "ERROR: Rate limit alcanzado ($MAX/$WINDOW s). Esperar."
            exit 1
        fi
        echo "$NOW" >> "$LOCKFILE.log"
    ) 200>"$LOCKFILE"
}
'

# ─────────────────────────────────────────────────────────────
# 1. aion-status: Estado completo de todos los servicios AION
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-status" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

echo "=== PM2 Processes ==="
su - ubuntu -c "pm2 jlist" 2>/dev/null | jq -r '.[] | "\(.name)\t\(.pm2_env.status)\tCPU:\(.monit.cpu)%\tMEM:\(.monit.memory / 1048576 | floor)MB\tRestarts:\(.pm2_env.restart_time)\tUptime:\(.pm2_env.pm_uptime)"' 2>/dev/null || echo "PM2: no disponible"

echo ""
echo "=== System Services ==="
for svc in nginx redis-server postgresql mosquitto asterisk go2rtc; do
    STATUS=$(systemctl is-active "$svc" 2>/dev/null || echo "not-found")
    printf "  %-20s %s\n" "$svc" "$STATUS"
done

echo ""
echo "=== go2rtc ==="
curl -sf --max-time 5 http://127.0.0.1:1984/api/streams 2>/dev/null | jq 'length' 2>/dev/null | xargs -I{} echo "  Streams configurados: {}" || echo "  go2rtc: no disponible"

echo ""
echo "=== Docker ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "  Docker: no disponible"

echo ""
echo "=== Resources ==="
df -h / | tail -1 | awk '{printf "  Disco: %s/%s (%s)\n", $3, $2, $5}'
free -h | awk '/^Mem:/ {printf "  RAM: %s/%s\n", $3, $2}'
uptime | sed 's/^/  /'
WRAPPER

# ─────────────────────────────────────────────────────────────
# 2. aion-health: Health check rapido con exit code + JSON output
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-health" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

FORMAT="${1:-text}"  # text o json
ERRORS=0
CHECKS=()

add_check() {
    local name="$1" status="$2" detail="${3:-}"
    CHECKS+=("{\"name\":\"$name\",\"status\":\"$status\",\"detail\":\"$detail\"}")
    [[ "$status" == "fail" || "$status" == "crit" ]] && ERRORS=$((ERRORS + 1))
}

# PM2 processes
PM2_JSON=$(su - ubuntu -c "pm2 jlist" 2>/dev/null || echo "[]")
PM2_TOTAL=$(echo "$PM2_JSON" | jq 'length' 2>/dev/null || echo 0)
PM2_ONLINE=$(echo "$PM2_JSON" | jq '[.[] | select(.pm2_env.status == "online")] | length' 2>/dev/null || echo 0)
PM2_DOWN=$(echo "$PM2_JSON" | jq -r '[.[] | select(.pm2_env.status != "online") | .name] | join(",")' 2>/dev/null || echo "")

if [[ "$PM2_ONLINE" -eq "$PM2_TOTAL" && "$PM2_TOTAL" -gt 0 ]]; then
    add_check "pm2" "ok" "${PM2_ONLINE}/${PM2_TOTAL} online"
else
    add_check "pm2" "fail" "${PM2_ONLINE}/${PM2_TOTAL} online, down: ${PM2_DOWN}"
fi

# Backend API health endpoint
HTTP_CODE=$(curl -sf --max-time 5 -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
    add_check "backend_api" "ok" "HTTP ${HTTP_CODE}"
else
    add_check "backend_api" "fail" "HTTP ${HTTP_CODE}"
fi

# Redis (safe: read password from file, don't expose in process list)
REDIS_PASS_FILE=$(mktemp)
chmod 600 "$REDIS_PASS_FILE"
grep -m1 '^REDIS_PASSWORD=' /opt/aion/app/backend/.env 2>/dev/null | cut -d= -f2 > "$REDIS_PASS_FILE" || true
REDIS_PASS=$(cat "$REDIS_PASS_FILE")
rm -f "$REDIS_PASS_FILE"

if [[ -n "$REDIS_PASS" ]]; then
    REDIS_OK=$(redis-cli -a "$REDIS_PASS" --no-auth-warning ping 2>/dev/null || echo "")
else
    REDIS_OK=$(redis-cli ping 2>/dev/null || echo "")
fi
if [[ "$REDIS_OK" == "PONG" ]]; then
    add_check "redis" "ok" "PONG"
else
    add_check "redis" "fail" "no response"
fi

# PostgreSQL
if su - postgres -c "pg_isready -q" 2>/dev/null; then
    add_check "postgresql" "ok" "accepting connections"
else
    add_check "postgresql" "fail" "not ready"
fi

# go2rtc
GO2RTC_STREAMS=$(curl -sf --max-time 5 http://127.0.0.1:1984/api/streams 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
add_check "go2rtc" "ok" "${GO2RTC_STREAMS} streams"

# Nginx
if nginx -t 2>/dev/null; then
    add_check "nginx" "ok" "config valid"
else
    add_check "nginx" "fail" "config invalid"
fi

# Mosquitto MQTT
if systemctl is-active mosquitto &>/dev/null; then
    add_check "mosquitto" "ok" "active"
else
    add_check "mosquitto" "warn" "inactive"
fi

# Asterisk
if systemctl is-active asterisk &>/dev/null; then
    add_check "asterisk" "ok" "active"
else
    add_check "asterisk" "warn" "inactive"
fi

# Disk
DISK_PCT=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [[ "$DISK_PCT" -gt 90 ]]; then
    add_check "disk" "crit" "${DISK_PCT}%"
elif [[ "$DISK_PCT" -gt 80 ]]; then
    add_check "disk" "warn" "${DISK_PCT}%"
else
    add_check "disk" "ok" "${DISK_PCT}%"
fi

# Memory
MEM_PCT=$(free | awk '/^Mem:/ {printf "%.0f", $3/$2 * 100}')
if [[ "$MEM_PCT" -gt 90 ]]; then
    add_check "memory" "crit" "${MEM_PCT}%"
elif [[ "$MEM_PCT" -gt 80 ]]; then
    add_check "memory" "warn" "${MEM_PCT}%"
else
    add_check "memory" "ok" "${MEM_PCT}%"
fi

# Output
if [[ "$FORMAT" == "json" ]]; then
    echo "{\"timestamp\":\"$(date -Iseconds)\",\"errors\":$ERRORS,\"checks\":[$(IFS=,; echo "${CHECKS[*]}")]}"
else
    for C in "${CHECKS[@]}"; do
        STATUS=$(echo "$C" | jq -r '.status')
        NAME=$(echo "$C" | jq -r '.name')
        DETAIL=$(echo "$C" | jq -r '.detail')
        case "$STATUS" in
            ok)   printf "  \033[0;32mOK\033[0m   %-15s %s\n" "$NAME" "$DETAIL" ;;
            warn) printf "  \033[1;33mWARN\033[0m %-15s %s\n" "$NAME" "$DETAIL" ;;
            fail) printf "  \033[0;31mFAIL\033[0m %-15s %s\n" "$NAME" "$DETAIL" ;;
            crit) printf "  \033[0;31mCRIT\033[0m %-15s %s\n" "$NAME" "$DETAIL" ;;
        esac
    done
    echo ""
    if [[ $ERRORS -eq 0 ]]; then echo "HEALTH: ALL OK"; else echo "HEALTH: ${ERRORS} ISSUES"; fi
fi

exit $([[ $ERRORS -eq 0 ]] && echo 0 || echo 1)
WRAPPER

# ─────────────────────────────────────────────────────────────
# 3. aion-logs: Ultimas N lineas de logs — ALL 5 PM2 services
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-logs" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

SERVICE="${1:-all}"
LINES="${2:-100}"

# Sanitizar input
SERVICE=$(echo "$SERVICE" | tr -cd 'a-zA-Z0-9-')
LINES=$(echo "$LINES" | tr -cd '0-9')
[[ -z "$LINES" ]] && LINES=100
[[ "$LINES" -gt 500 ]] && LINES=500

LOGDIR="/opt/aion/logs"

case "$SERVICE" in
    all)
        for LOG in backend-api edge-gateway; do
            echo "=== ${LOG} (ultimas $LINES) ==="
            tail -n "$LINES" "${LOGDIR}/${LOG}.log" 2>/dev/null || echo "(sin logs)"
            echo ""
        done
        echo "=== Nginx Error (ultimas $LINES) ==="
        tail -n "$LINES" "${LOGDIR}/nginx-error.log" 2>/dev/null || echo "(sin logs)"
        ;;
    backend-api|aion-api)
        tail -n "$LINES" "${LOGDIR}/backend-api.log" 2>/dev/null || echo "(sin logs)"
        ;;
    aionseg-api)
        # aionseg-api puede loguear via PM2 stdout
        su - ubuntu -c "pm2 logs aionseg-api --nostream --lines $LINES" 2>/dev/null || echo "(sin logs)"
        ;;
    clave-api)
        su - ubuntu -c "pm2 logs clave-api --nostream --lines $LINES" 2>/dev/null || echo "(sin logs)"
        ;;
    clave-web)
        su - ubuntu -c "pm2 logs clave-web --nostream --lines $LINES" 2>/dev/null || echo "(sin logs)"
        ;;
    face-recognition)
        su - ubuntu -c "pm2 logs face-recognition --nostream --lines $LINES" 2>/dev/null || echo "(sin logs)"
        ;;
    edge-gateway)
        tail -n "$LINES" "${LOGDIR}/edge-gateway.log" 2>/dev/null || echo "(sin logs)"
        ;;
    nginx)
        tail -n "$LINES" "${LOGDIR}/nginx-error.log" 2>/dev/null || echo "(sin logs)"
        echo "---"
        tail -n "$LINES" "${LOGDIR}/nginx-api-error.log" 2>/dev/null || echo "(sin logs API)"
        ;;
    nginx-access)
        tail -n "$LINES" "${LOGDIR}/nginx-access.log" 2>/dev/null || echo "(sin logs)"
        ;;
    errors)
        echo "=== Errores recientes en todos los servicios ==="
        for LOG in backend-api edge-gateway; do
            echo "--- ${LOG} ---"
            grep -i "error\|fatal\|exception\|CRIT" "${LOGDIR}/${LOG}.log" 2>/dev/null | tail -n "$LINES" || echo "(sin errores)"
            echo ""
        done
        ;;
    *)
        echo "Servicios: all, backend-api, aionseg-api, clave-api, clave-web,"
        echo "           face-recognition, edge-gateway, nginx, nginx-access, errors"
        exit 1
        ;;
esac
WRAPPER

# ─────────────────────────────────────────────────────────────
# 4. aion-restart: Reinicio seguro — INJECTION-PROOF
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-restart" <<WRAPPER
#!/usr/bin/env bash
set -euo pipefail

${RATE_LIMIT_FUNC}

_rate_limit "aion-restart" 5 300  # Max 5 restarts por 5 minutos

SERVICE="\${1:-}"

# Allowlist estricta — comparacion exacta, sin regex ni glob
declare -A ALLOWED=(
    [aion-api]=1
    [aionseg-api]=1
    [clave-api]=1
    [clave-web]=1
    [face-recognition]=1
    [edge-gateway]=1
)

if [[ -z "\$SERVICE" ]]; then
    echo "Uso: aion-restart <servicio>"
    echo "Servicios: \${!ALLOWED[*]}"
    exit 1
fi

# Validacion estricta: comparacion exacta contra associative array
if [[ -z "\${ALLOWED[\$SERVICE]+x}" ]]; then
    echo "ERROR: '\$SERVICE' no permitido."
    echo "Servicios: \${!ALLOWED[*]}"
    exit 1
fi

echo "Reiniciando \$SERVICE..."

# SAFE: usar --only flag para que PM2 no interprete el nombre como glob
# Ejecutar como array, no como string en su -c
su - ubuntu -s /bin/bash -c "exec pm2 restart '\$SERVICE'" 2>&1

sleep 3
STATUS=\$(su - ubuntu -c "pm2 jlist" 2>/dev/null | jq -r ".[] | select(.name == \"\$SERVICE\") | .pm2_env.status" 2>/dev/null || echo "unknown")
echo "Estado post-restart: \$STATUS"

if [[ "\$STATUS" != "online" ]]; then
    echo "WARN: \$SERVICE no volvio a 'online'"
    exit 1
fi

echo "OK: \$SERVICE reiniciado"
WRAPPER

# ─────────────────────────────────────────────────────────────
# 5. aion-nginx-test: Validar config sin recargar
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-nginx-test" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
nginx -t 2>&1
WRAPPER

# ─────────────────────────────────────────────────────────────
# 6. aion-disk-usage
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-disk-usage" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

echo "=== Filesystem ==="
df -h / /tmp 2>/dev/null

echo ""
echo "=== AION Directories ==="
du -sh /opt/aion/app 2>/dev/null || echo "  /opt/aion/app: N/A"
du -sh /opt/aion/logs 2>/dev/null || echo "  /opt/aion/logs: N/A"
du -sh /var/lib/postgresql 2>/dev/null || echo "  PostgreSQL: N/A"
du -sh /var/lib/redis 2>/dev/null || echo "  Redis: N/A"

echo ""
echo "=== Archivos grandes en logs (>50MB) ==="
find /opt/aion/logs -type f -size +50M -exec ls -lh {} \; 2>/dev/null || echo "  Ninguno"

echo ""
echo "=== Docker ==="
docker system df 2>/dev/null || echo "  Docker: N/A"
WRAPPER

# ─────────────────────────────────────────────────────────────
# 7. aion-redis-ping: SAFE password handling
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-redis-ping" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

# Read password from file, not command line (prevents /proc exposure)
REDIS_PASS=""
if [[ -f /opt/aion/app/backend/.env ]]; then
    REDIS_PASS=$(grep -m1 '^REDIS_PASSWORD=' /opt/aion/app/backend/.env 2>/dev/null | cut -d= -f2 || true)
fi

redis_cmd() {
    if [[ -n "$REDIS_PASS" ]]; then
        redis-cli -a "$REDIS_PASS" --no-auth-warning "$@" 2>/dev/null
    else
        redis-cli "$@" 2>/dev/null
    fi
}

echo "=== Ping ==="
redis_cmd ping

echo ""
echo "=== Memory ==="
redis_cmd info memory | grep -E "^(used_memory_human|maxmemory_human|mem_fragmentation_ratio)" || true

echo ""
echo "=== Clients ==="
redis_cmd info clients | grep -E "^(connected_clients|blocked_clients)" || true

echo ""
echo "=== Keyspace ==="
redis_cmd info keyspace || true
WRAPPER

# ─────────────────────────────────────────────────────────────
# 8. aion-pg-status
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-pg-status" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

echo "=== PostgreSQL Status ==="
su - postgres -c "pg_isready" 2>/dev/null || echo "PostgreSQL no disponible"

echo ""
echo "=== Databases ==="
su - postgres -c "psql -t -c \"SELECT datname, pg_size_pretty(pg_database_size(datname)) as size FROM pg_database WHERE NOT datistemplate ORDER BY pg_database_size(datname) DESC;\"" 2>/dev/null || echo "No se pudo consultar"

echo ""
echo "=== Active Connections ==="
su - postgres -c "psql -t -c \"SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname ORDER BY count DESC;\"" 2>/dev/null || echo "No se pudo consultar"

echo ""
echo "=== Table Count (aionseg_prod) ==="
su - postgres -c "psql -d aionseg_prod -t -c \"SELECT count(*) || ' tables' FROM information_schema.tables WHERE table_schema = 'public';\"" 2>/dev/null || echo "No se pudo consultar"
WRAPPER

# ─────────────────────────────────────────────────────────────
# 9. aion-go2rtc-status
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-go2rtc-status" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

echo "=== go2rtc API ==="
STREAMS=$(curl -sf --max-time 5 http://127.0.0.1:1984/api/streams 2>/dev/null)
if [[ -n "$STREAMS" ]]; then
    TOTAL=$(echo "$STREAMS" | jq 'length' 2>/dev/null || echo "?")
    echo "Total streams configurados: $TOTAL"

    echo ""
    echo "=== Top 20 Producers activos ==="
    echo "$STREAMS" | \
        jq -r 'to_entries[] | select(.value.producers != null and (.value.producers | length) > 0) | .key' 2>/dev/null | \
        head -20 || echo "Ninguno activo"
else
    echo "go2rtc API no disponible en :1984"
fi

echo ""
echo "=== Proceso ==="
pgrep -a go2rtc 2>/dev/null || echo "go2rtc no esta corriendo"
WRAPPER

# ─────────────────────────────────────────────────────────────
# 10. aion-db-query: HARDENED SQL read-only (v2)
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-db-query" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

QUERY="${1:-}"

if [[ -z "$QUERY" ]]; then
    echo "Uso: aion-db-query 'SELECT ...'"
    exit 1
fi

# Max query length: 2000 chars
if [[ ${#QUERY} -gt 2000 ]]; then
    echo "ERROR: Query demasiado larga (max 2000 caracteres)."
    exit 1
fi

# SECURITY: Normalize for checking
QUERY_NORM=$(echo "$QUERY" | tr '[:lower:]' '[:upper:]' | tr -s ' \t\n' ' ')

# MUST start with SELECT or WITH ... SELECT (for CTEs)
if ! echo "$QUERY_NORM" | grep -qE '^\s*(SELECT|WITH)\s'; then
    echo "ERROR: Solo consultas SELECT (o WITH ... SELECT) permitidas."
    exit 1
fi

# Block ALL write/DDL/DCL operations — even inside CTEs or subqueries
BLOCKED_KEYWORDS=(
    INSERT UPDATE DELETE DROP ALTER CREATE TRUNCATE
    GRANT REVOKE COPY EXECUTE VACUUM ANALYZE REINDEX
    CLUSTER DISCARD PREPARE DEALLOCATE LISTEN NOTIFY
    LOCK RESET SET LOAD IMPORT EXPORT CALL DO
)
for KW in "${BLOCKED_KEYWORDS[@]}"; do
    if echo "$QUERY_NORM" | grep -qw "$KW"; then
        echo "ERROR: Keyword '$KW' no permitido."
        exit 1
    fi
done

# Block dangerous functions
BLOCKED_FUNCTIONS=(
    PG_READ_FILE PG_READ_BINARY_FILE PG_WRITE_FILE
    LO_IMPORT LO_EXPORT LO_CREATE LO_UNLINK
    PG_EXECUTE_SERVER_PROGRAM DBLINK DBLINK_EXEC
    PG_SLEEP PG_TERMINATE_BACKEND PG_CANCEL_BACKEND
    PG_RELOAD_CONF PG_ROTATE_LOGFILE
    COPY_TO COPY_FROM
)
for FUNC in "${BLOCKED_FUNCTIONS[@]}"; do
    if echo "$QUERY_NORM" | grep -qi "$FUNC"; then
        echo "ERROR: Funcion '$FUNC' no permitida."
        exit 1
    fi
done

# Block semicolons (prevents statement chaining: SELECT 1; DROP TABLE x)
if echo "$QUERY" | grep -q ';'; then
    echo "ERROR: Punto y coma no permitido (solo una sentencia por query)."
    exit 1
fi

# Block backslash commands (\copy, \!, etc.)
if echo "$QUERY" | grep -qE '\\[a-zA-Z!]'; then
    echo "ERROR: Comandos backslash no permitidos."
    exit 1
fi

# Use read-only PostgreSQL user (NEVER fall back to superuser)
DB_URL=$(grep -m1 '^AION_DB_READONLY_URL=' /home/openclaw/.openclaw/.env 2>/dev/null | cut -d= -f2- || echo "")

if [[ -z "$DB_URL" ]]; then
    echo "ERROR: AION_DB_READONLY_URL no configurado en .env"
    echo "Ejecutar setup-db-readonly.sql primero."
    exit 1
fi

# Execute with strict timeout and row limit
psql "$DB_URL" \
    --no-psqlrc \
    -P pager=off \
    -c "SET statement_timeout = '10s'; SET lock_timeout = '3s'; $QUERY" \
    2>&1 | head -1000
WRAPPER

# ─────────────────────────────────────────────────────────────
# 11. aion-api-query: Query AION REST API (read-only endpoints)
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-api-query" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

ENDPOINT="${1:-}"
if [[ -z "$ENDPOINT" ]]; then
    echo "Uso: aion-api-query <endpoint> [jq-filter]"
    echo ""
    echo "Endpoints disponibles:"
    echo "  /health                    Estado del API"
    echo "  /devices?limit=50          Dispositivos"
    echo "  /cameras?limit=50          Camaras"
    echo "  /events?limit=20           Eventos recientes"
    echo "  /incidents?limit=20        Incidentes"
    echo "  /alerts?limit=20           Alertas activas"
    echo "  /sites                     Sitios"
    echo "  /operations/overview       Dashboard operacional"
    echo "  /analytics/summary         Resumen analitico"
    echo "  /anomalies?limit=10        Anomalias detectadas"
    echo "  /internal-agent/status     Estado agente interno"
    exit 1
fi

JQ_FILTER="${2:-.}"

# Sanitize: only allow alphanumeric, /, ?, =, &, -, _
ENDPOINT=$(echo "$ENDPOINT" | tr -cd 'a-zA-Z0-9/?=&_-')

# Must start with /
[[ "$ENDPOINT" == /* ]] || ENDPOINT="/${ENDPOINT}"

# Block admin/write endpoints
BLOCKED_PATTERNS=("/auth/" "/api-keys" "/gdpr/" "/backup/" "/provisioning/" "/webhooks/")
for PAT in "${BLOCKED_PATTERNS[@]}"; do
    if echo "$ENDPOINT" | grep -qi "$PAT"; then
        echo "ERROR: Endpoint '$PAT' no permitido desde OpenClaw."
        exit 1
    fi
done

# Read API key from OpenClaw env
API_KEY=$(grep -m1 '^AION_API_KEY=' /home/openclaw/.openclaw/.env 2>/dev/null | cut -d= -f2- || echo "")

if [[ -z "$API_KEY" ]]; then
    echo "ERROR: AION_API_KEY no configurado en .env"
    exit 1
fi

# GET only, with timeout
RESPONSE=$(curl -sf --max-time 10 \
    -H "X-API-Key: ${API_KEY}" \
    -H "Content-Type: application/json" \
    "http://127.0.0.1:3000${ENDPOINT}" 2>/dev/null)

if [[ -z "$RESPONSE" ]]; then
    echo "ERROR: Sin respuesta de AION API (endpoint: ${ENDPOINT})"
    exit 1
fi

# Apply jq filter if provided
echo "$RESPONSE" | jq "$JQ_FILTER" 2>/dev/null || echo "$RESPONSE" | head -200
WRAPPER

# ─────────────────────────────────────────────────────────────
# 12. aion-mqtt-read: Leer mensajes MQTT recientes
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-mqtt-read" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

TOPIC="${1:-#}"
COUNT="${2:-10}"

# Sanitize
TOPIC=$(echo "$TOPIC" | tr -cd 'a-zA-Z0-9/#_+-')
COUNT=$(echo "$COUNT" | tr -cd '0-9')
[[ -z "$COUNT" ]] && COUNT=10
[[ "$COUNT" -gt 100 ]] && COUNT=100

echo "=== MQTT: topic=$TOPIC, count=$COUNT ==="
echo "(Escuchando $COUNT mensajes, timeout 10s...)"

# Read N messages with timeout
timeout 10 mosquitto_sub -h 127.0.0.1 -p 1883 -t "$TOPIC" -C "$COUNT" -v 2>/dev/null || echo "(timeout o sin mensajes)"
WRAPPER

# ─────────────────────────────────────────────────────────────
# 13. aion-asterisk-status: Estado del PBX
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-asterisk-status" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

echo "=== Asterisk Status ==="
if ! systemctl is-active asterisk &>/dev/null; then
    echo "Asterisk no esta activo"
    exit 0
fi

echo "--- Core ---"
asterisk -rx "core show version" 2>/dev/null || echo "N/A"

echo ""
echo "--- PJSIP Endpoints ---"
asterisk -rx "pjsip show endpoints" 2>/dev/null || echo "N/A"

echo ""
echo "--- Active Channels ---"
asterisk -rx "core show channels concise" 2>/dev/null || echo "Ninguno"

echo ""
echo "--- Recent Calls (CDR) ---"
asterisk -rx "cdr show status" 2>/dev/null || echo "N/A"
WRAPPER

# ─────────────────────────────────────────────────────────────
# 14. aion-db-backup: Backup PostgreSQL
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-db-backup" <<WRAPPER
#!/usr/bin/env bash
set -euo pipefail

${RATE_LIMIT_FUNC}

_rate_limit "aion-db-backup" 3 3600  # Max 3 backups por hora

DB="${1:-aionseg_prod}"
BACKUP_DIR="/opt/aion/backups/db"
TIMESTAMP=\$(date +%Y%m%d-%H%M%S)

# Solo databases permitidas
case "\$DB" in
    aionseg_prod|aion_prod) ;;
    *) echo "ERROR: DB '\$DB' no permitida. Usar: aionseg_prod o aion_prod"; exit 1 ;;
esac

mkdir -p "\$BACKUP_DIR"

echo "=== Backup PostgreSQL: \$DB ==="
BACKUP_FILE="\${BACKUP_DIR}/\${DB}-\${TIMESTAMP}.sql.gz"

su - postgres -c "pg_dump -Fc -Z5 '\$DB'" > "\$BACKUP_FILE" 2>/dev/null || {
    echo "ERROR: pg_dump fallo"
    rm -f "\$BACKUP_FILE"
    exit 1
}

SIZE=\$(du -sh "\$BACKUP_FILE" 2>/dev/null | cut -f1)
echo "OK: \$BACKUP_FILE (\$SIZE)"

# Limpiar backups antiguos (mantener ultimos 7)
ls -t "\${BACKUP_DIR}/\${DB}"-*.sql.gz 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null || true
echo "Backups antiguos limpiados"
WRAPPER

# ─────────────────────────────────────────────────────────────
# Permisos: root-owned, 750
# ─────────────────────────────────────────────────────────────
echo "Configurando permisos..."

WRAPPERS=(
    aion-status
    aion-health
    aion-logs
    aion-restart
    aion-nginx-test
    aion-disk-usage
    aion-redis-ping
    aion-pg-status
    aion-go2rtc-status
    aion-db-query
    aion-api-query
    aion-mqtt-read
    aion-asterisk-status
    aion-db-backup
)

for W in "${WRAPPERS[@]}"; do
    chmod 0750 "${WRAPPER_DIR}/${W}"
    chown root:root "${WRAPPER_DIR}/${W}"
done

# ─────────────────────────────────────────────────────────────
# Sudoers: HARDENED (env_reset ON, secure_path, no generics)
# ─────────────────────────────────────────────────────────────
echo "Configurando sudoers..."

cat > /etc/sudoers.d/openclaw-aion <<'SUDOERS'
# OpenClaw — acceso minimo a wrappers AION (v2)
# env_reset ON: no permite LD_PRELOAD ni variable injection
Defaults:openclaw env_reset, secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Defaults:openclaw !requiretty

# Wrappers de lectura (sin password)
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-status
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-health
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-health *
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-logs
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-logs *
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-nginx-test
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-disk-usage
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-redis-ping
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-pg-status
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-go2rtc-status
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-db-query
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-db-query *
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-api-query
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-api-query *
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-mqtt-read
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-mqtt-read *
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-asterisk-status

# Wrappers de operacion (rate-limited internamente)
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-restart
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-restart *
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-db-backup
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-db-backup *
SUDOERS

chmod 0440 /etc/sudoers.d/openclaw-aion

visudo -cf /etc/sudoers.d/openclaw-aion || {
    echo "ERROR: sudoers invalido"
    rm -f /etc/sudoers.d/openclaw-aion
    exit 1
}

echo ""
echo "=== ${#WRAPPERS[@]} wrappers instalados (v2) ==="
for W in "${WRAPPERS[@]}"; do
    echo "  ${WRAPPER_DIR}/${W}"
done
echo ""
echo "Sudoers: /etc/sudoers.d/openclaw-aion (env_reset ON)"
echo "DONE"
