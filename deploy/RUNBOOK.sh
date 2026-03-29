#!/bin/bash
set -euo pipefail
# ═══════════════════════════════════════════════════════════════
# AION — RUNBOOK MAESTRO DE PRODUCCIÓN
# Ejecutar desde el VPS: bash deploy/RUNBOOK.sh
# ═══════════════════════════════════════════════════════════════

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
PROJECT_DIR="/var/www/aionseg"

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          AION — RUNBOOK DE PRODUCCIÓN                    ║"
echo "║          aionseg.co — Clave Seguridad CTA                ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

prompt_continue() {
  echo ""
  echo -e "${YELLOW}¿Continuar con la siguiente sección? (s/n)${NC}"
  read -r resp
  [ "$resp" != "s" ] && echo "Abortado." && exit 0
}

# ─── SECCIÓN 0: DIAGNÓSTICO ────────────────────────────────────
echo -e "${CYAN}=== SECCIÓN 0: DIAGNÓSTICO DEL ESTADO ACTUAL ===${NC}"

echo "Directorio: $PROJECT_DIR"
[ -d "$PROJECT_DIR" ] && echo -e "${GREEN}  ✅ Directorio existe${NC}" || { echo -e "${RED}  ❌ Directorio no existe${NC}"; exit 1; }

echo "Servicios:"
pm2 list 2>/dev/null | grep -E "aionseg|go2rtc" || echo "  ⚠️ PM2 no accesible o sin procesos AION"
redis-cli ping 2>/dev/null | grep -q PONG && echo -e "${GREEN}  ✅ Redis${NC}" || echo -e "${YELLOW}  ⚠️ Redis sin auth o no accesible${NC}"
curl -s http://localhost:1984/api/streams >/dev/null 2>&1 && echo -e "${GREEN}  ✅ go2rtc${NC}" || echo -e "${YELLOW}  ⚠️ go2rtc no accesible${NC}"

echo ""
echo "Base de datos:"
if [ -n "${DATABASE_URL:-}" ]; then
  psql "$DATABASE_URL" -t -c "SELECT 'sites: ' || count(*) FROM sites UNION ALL SELECT 'devices: ' || count(*) FROM devices UNION ALL SELECT 'residents: ' || count(*) FROM residents;" 2>/dev/null || echo "  ⚠️ No se pudo consultar la DB"
else
  echo "  ⚠️ DATABASE_URL no configurada"
fi

echo ""
echo "Git:"
cd "$PROJECT_DIR" 2>/dev/null && git log --oneline -3 2>/dev/null || echo "  ⚠️ Git no accesible"

prompt_continue

# ─── SECCIÓN 1: DEPLOY (código + migrations + build) ──────────
echo -e "${CYAN}=== SECCIÓN 1: DEPLOY ===${NC}"

cd "$PROJECT_DIR"

echo "1.1 — git pull"
git pull origin main

echo ""
echo "1.2 — Install dependencies"
cd backend
if command -v pnpm &>/dev/null; then
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
else
  npm install
fi

echo ""
echo "1.3 — Database migrations"
if [ -n "${DATABASE_URL:-}" ]; then
  for mig in "$PROJECT_DIR"/deploy/migrations/*.sql; do
    echo "  Running: $(basename "$mig")"
    psql "$DATABASE_URL" -f "$mig" 2>/dev/null && echo -e "  ${GREEN}✅ OK${NC}" || echo -e "  ${YELLOW}⚠️ Already exists or error${NC}"
  done
else
  echo -e "  ${YELLOW}⚠️ DATABASE_URL not set — run migrations manually${NC}"
fi

echo ""
echo "1.4 — Build backend"
npx turbo build && echo -e "${GREEN}  ✅ Backend build OK${NC}" || { echo -e "${RED}  ❌ Backend build FAILED${NC}"; exit 1; }

echo ""
echo "1.5 — Build frontend"
cd "$PROJECT_DIR"
if [ -d "frontend" ]; then
  cd frontend
  if command -v pnpm &>/dev/null; then
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  else
    npm install
  fi
  npx vite build && echo -e "${GREEN}  ✅ Frontend build OK${NC}" || { echo -e "${RED}  ❌ Frontend build FAILED${NC}"; exit 1; }
else
  # Monorepo — frontend is at root
  npx vite build && echo -e "${GREEN}  ✅ Frontend build OK${NC}" || echo -e "${YELLOW}  ⚠️ Frontend build issue${NC}"
fi

echo ""
echo "1.6 — Deploy go2rtc config"
if [ -f "$PROJECT_DIR/deploy/go2rtc-hikvision.yaml" ]; then
  # Try common go2rtc config locations
  for dest in /etc/go2rtc/go2rtc.yaml /opt/go2rtc/go2rtc.yaml ~/go2rtc.yaml; do
    if [ -d "$(dirname "$dest")" ]; then
      cp "$PROJECT_DIR/deploy/go2rtc-hikvision.yaml" "$dest" 2>/dev/null && echo "  Copied to $dest" && break
    fi
  done
  # Restart go2rtc
  systemctl restart go2rtc 2>/dev/null || pm2 restart go2rtc 2>/dev/null || echo -e "  ${YELLOW}⚠️ Restart go2rtc manually${NC}"
fi

echo ""
echo "1.7 — Nginx go2rtc proxy"
if ! grep -rq "go2rtc\|1984" /etc/nginx/sites-available/ 2>/dev/null; then
  echo -e "${YELLOW}  ⚠️ go2rtc proxy not in nginx config. Add to /etc/nginx/sites-available/aionseg.co:${NC}"
  echo ""
  echo "    location /go2rtc/ {"
  echo "        proxy_pass http://127.0.0.1:1984/;"
  echo "        proxy_http_version 1.1;"
  echo "        proxy_set_header Upgrade \$http_upgrade;"
  echo "        proxy_set_header Connection \"upgrade\";"
  echo "        proxy_buffering off;"
  echo "        proxy_read_timeout 86400s;"
  echo "    }"
  echo ""
  echo "  Then: sudo nginx -t && sudo systemctl reload nginx"
else
  echo -e "${GREEN}  ✅ go2rtc proxy already in nginx${NC}"
fi

echo ""
echo "1.8 — Restart API"
pm2 restart aionseg-api 2>/dev/null && echo -e "${GREEN}  ✅ PM2 restarted${NC}" || echo -e "${YELLOW}  ⚠️ PM2 restart issue${NC}"
pm2 save 2>/dev/null

echo ""
echo "1.9 — Health checks"
sleep 5
curl -sf https://aionseg.co/api/health >/dev/null && echo -e "${GREEN}  ✅ API healthy${NC}" || echo -e "${RED}  ❌ API not responding${NC}"
curl -sf https://aionseg.co >/dev/null && echo -e "${GREEN}  ✅ Frontend serving${NC}" || echo -e "${RED}  ❌ Frontend not responding${NC}"
STREAMS=$(curl -s http://localhost:1984/api/streams 2>/dev/null | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
echo "  📊 go2rtc streams: $STREAMS"

prompt_continue

# ─── SECCIÓN 2: TEST DE DISPOSITIVOS ─────────────────────────
echo -e "${CYAN}=== SECCIÓN 2: TEST DE DISPOSITIVOS HIKVISION ===${NC}"

test_isapi() {
  local NAME=$1 IP=$2 PORT=$3 PASS=$4
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --digest -u "admin:$PASS" --connect-timeout 5 "http://$IP:$PORT/ISAPI/System/deviceInfo" 2>/dev/null)
  [ "$CODE" = "200" ] && echo -e "  ${GREEN}✅ $NAME ($IP:$PORT)${NC}" || echo -e "  ${RED}❌ $NAME ($IP:$PORT) → HTTP $CODE${NC}"
}

echo "DVR/NVR:"
test_isapi "Torre Lucia DVR"    "181.205.215.210" "8010" "seg12345"
test_isapi "Torre Lucia NVR"    "181.205.215.210" "8020" "seg12345"
test_isapi "San Nicolas NVR"    "181.143.16.170"  "8000" "Clave.seg2023"
test_isapi "San Nicolas LPR"    "181.143.16.170"  "8081" "Clave.seg2023"
test_isapi "Pisquines NVR"      "181.205.202.122" "8010" "Clave.seg2023"
test_isapi "Pisquines DVR"      "181.205.202.122" "8020" "Clave.seg2023"
test_isapi "San Sebastian DVR"  "186.97.106.252"  "8000" "Clave.seg2023"
test_isapi "Portalegre NVR"     "200.58.214.114"  "8000" "Clave.seg2023"
test_isapi "Portalegre DVR"     "200.58.214.114"  "8040" "Clave.seg2023"
test_isapi "Altagracia DVR"     "181.205.175.18"  "8030" "Clave.seg2023"
test_isapi "Altagracia LPR"     "181.205.175.18"  "8010" "Clave.seg2023"
test_isapi "Portal Plaza NVR"   "181.205.175.19"  "8020" "Clave.seg2023"
test_isapi "Brescia LPR1"       "186.97.104.202"  "8030" "Clave.seg2023"
test_isapi "Brescia LPR2"       "186.97.104.202"  "8020" "Clave.seg2023"
test_isapi "Senderos DVR1"      "38.9.217.12"     "8030" "Clave.seg2023"
test_isapi "Senderos DVR2"      "38.9.217.12"     "8020" "Clave.seg2023"
test_isapi "Altos Rosario DVR"  "190.159.37.188"  "8010" "Clave.seg2023"
test_isapi "La Palencia DVR"    "181.205.249.130" "8000" "Clave.seg2023"

echo ""
echo "Access Controllers:"
test_isapi "TL SUR"             "181.205.215.210" "8060" "Seg12345"
test_isapi "TL NORTE"           "181.205.215.210" "8081" "Seg12345"
test_isapi "TL TER"             "181.205.215.210" "8070" "Seg12345"
test_isapi "TL GYM"             "181.205.215.210" "8040" "Clave.seg2023"
test_isapi "San Nicolas AC"     "181.143.16.170"  "8050" "seg12345"
test_isapi "Pisquines AC"       "181.205.202.122" "8000" "Seg12345"
test_isapi "San Sebastian AC"   "186.97.106.252"  "8080" "seg12345"
test_isapi "Portalegre AC"      "200.58.214.114"  "8010" "Seg12345"
test_isapi "Altagracia AC"      "181.205.175.18"  "8050" "Clave.seg2023"
test_isapi "Brescia AC"         "186.97.104.202"  "8050" "Clave.seg2023"

prompt_continue

# ─── SECCIÓN 3: VALIDACIÓN FINAL ─────────────────────────────
echo -e "${CYAN}=== SECCIÓN 3: VALIDACIÓN FINAL ===${NC}"

PASS=0; FAIL=0
check() {
  if [ "$1" = "ok" ]; then echo -e "  ${GREEN}✅ $2${NC}"; ((PASS++)); else echo -e "  ${RED}❌ $2 ($1)${NC}"; ((FAIL++)); fi
}

# Auth
echo "Autenticación:"
TOKEN=$(curl -s -X POST https://aionseg.co/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"jlort1721@gmail.com\",\"password\":\"${AION_ADMIN_PASSWORD:-Jml1413031.}\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
[ -n "$TOKEN" ] && check "ok" "Login API" || check "fail" "Login API"

echo ""
echo "Servicios:"
redis-cli ping 2>/dev/null | grep -q PONG && check "ok" "Redis" || check "fail" "Redis"
curl -s http://localhost:1984/api/streams >/dev/null 2>&1 && check "ok" "go2rtc" || check "fail" "go2rtc"
pm2 list 2>/dev/null | grep -q online && check "ok" "PM2" || check "fail" "PM2"

echo ""
echo "API Endpoints:"
for ep in health cameras cameras/by-site devices sites domotics/devices hikconnect/isapi/test-all camera-events/recent knowledge-base; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "https://aionseg.co/api/$ep" 2>/dev/null)
  [ "$CODE" = "200" ] && check "ok" "/api/$ep" || check "$CODE" "/api/$ep"
done

echo ""
echo "Frontend:"
CODE=$(curl -s -o /dev/null -w "%{http_code}" https://aionseg.co)
[ "$CODE" = "200" ] && check "ok" "HTTPS Frontend" || check "$CODE" "HTTPS Frontend"

for page in privacy terms cookies; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://aionseg.co/$page")
  [ "$CODE" = "200" ] && check "ok" "/$page" || check "$CODE" "/$page"
done

echo ""
echo "go2rtc Streams:"
STREAMS=$(curl -s http://localhost:1984/api/streams 2>/dev/null | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
echo "  📊 Configurados: $STREAMS"

echo ""
echo "Base de datos:"
if [ -n "${DATABASE_URL:-}" ]; then
  psql "$DATABASE_URL" -t -c "
    SELECT '  sites: ' || count(*) FROM sites
    UNION ALL SELECT '  residents: ' || count(*) FROM residents
    UNION ALL SELECT '  vehicles: ' || count(*) FROM vehicles
    UNION ALL SELECT '  devices: ' || count(*) FROM devices
    UNION ALL SELECT '  cameras: ' || count(*) FROM cameras;" 2>/dev/null || echo "  ⚠️ DB query failed"
fi

echo ""
echo "Git:"
echo "  Último commit: $(git log -1 --format='%h %s' 2>/dev/null)"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "  Resultado: ${GREEN}$PASS PASS${NC} / ${RED}$FAIL FAIL${NC}"
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}🎉 AION ESTÁ LISTO PARA PRODUCCIÓN${NC}"
else
  echo -e "  ${YELLOW}⚠️  Corregir los $FAIL fallos antes de producción${NC}"
fi
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
