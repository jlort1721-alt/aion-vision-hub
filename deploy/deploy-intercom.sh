#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# AION — Deploy Intercom & Phone System
# Run on VPS: bash deploy/deploy-intercom.sh
# ═══════════════════════════════════════════════════════════
set -euo pipefail

echo "══════════════════════════════════════════"
echo "  AION — Intercom & Phone Deploy"
echo "══════════════════════════════════════════"

# ── Step 1: Verify Asterisk PBX ───────────────────────────
echo ""
echo "[1/5] Verificando Asterisk PBX..."
if command -v asterisk &>/dev/null; then
  if systemctl is-active --quiet asterisk; then
    echo "  ✓ Asterisk activo"
    # Show registered endpoints
    ENDPOINTS=$(asterisk -rx "pjsip show endpoints" 2>/dev/null | grep -cE "^[[:space:]]*(Endpoint|200|300)" || true)
    echo "  Endpoints PJSIP: $ENDPOINTS"
  else
    echo "  ⚠ Asterisk instalado pero no activo"
    echo "    sudo systemctl start asterisk"
  fi
else
  echo "  ✗ Asterisk NO instalado"
  echo "  Para instalar: sudo apt install asterisk"
  echo "  Guia: GUIA_CONFIGURACION_ASTERISK.md"
fi

# ── Step 2: Verify ARI (Asterisk REST Interface) ─────────
echo ""
echo "[2/5] Verificando ARI..."
ARI_URL="${SIP_ARI_URL:-http://localhost:8088/ari}"
ARI_USER="${SIP_ARI_USERNAME:-aion}"
ARI_PASS="${SIP_ARI_PASSWORD:-}"

if [ -n "$ARI_PASS" ]; then
  ARI_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -u "$ARI_USER:$ARI_PASS" "$ARI_URL/asterisk/info" 2>/dev/null || echo "000")
  if [ "$ARI_STATUS" = "200" ]; then
    echo "  ✓ ARI respondiendo en $ARI_URL"
  else
    echo "  ⚠ ARI retorno HTTP $ARI_STATUS"
    echo "    Verificar /etc/asterisk/ari.conf y http.conf"
  fi
else
  echo "  ⚠ SIP_ARI_PASSWORD no configurado en .env"
  echo "    Agregar al backend/.env:"
  echo "    SIP_ARI_URL=http://localhost:8088/ari"
  echo "    SIP_ARI_USERNAME=aion"
  echo "    SIP_ARI_PASSWORD=<tu-password>"
fi

# ── Step 3: Verify SIP port open ─────────────────────────
echo ""
echo "[3/5] Verificando puertos SIP..."
for PORT in 5060 5061 8089; do
  if ss -tlnp | grep -q ":$PORT " 2>/dev/null; then
    echo "  ✓ Puerto $PORT escuchando"
  else
    echo "  ⚠ Puerto $PORT NO escuchando"
  fi
done

# Check UFW
echo ""
echo "  Estado UFW:"
for PORT in 5060 5061 8089; do
  if sudo ufw status | grep -q "$PORT"; then
    echo "  ✓ Puerto $PORT abierto en UFW"
  else
    echo "  ⚠ Puerto $PORT NO abierto en UFW"
    echo "    sudo ufw allow $PORT/tcp comment 'SIP'"
    echo "    sudo ufw allow $PORT/udp comment 'SIP'"
  fi
done

# ── Step 4: Seed intercom devices in database ────────────
echo ""
echo "[4/5] Sembrando dispositivos intercom en BD..."
APP_DIR="/opt/aion/app"
if [ -d "$APP_DIR/backend" ]; then
  cd "$APP_DIR"
  npx tsx scripts/seed-intercom-devices.ts 2>&1 || echo "  ⚠ Seed fallo — ejecutar manualmente"
elif [ -d "/var/www/aion" ]; then
  cd /var/www/aion
  npx tsx scripts/seed-intercom-devices.ts 2>&1 || echo "  ⚠ Seed fallo"
else
  echo "  ⚠ Directorio app no encontrado"
  echo "  Ejecutar: cd backend && npx tsx ../scripts/seed-intercom-devices.ts"
fi

# ── Step 5: Restart backend to load provisioning routes ──
echo ""
echo "[5/5] Reiniciando backend..."
if pm2 list 2>/dev/null | grep -q "backend-api"; then
  pm2 restart backend-api
  sleep 3
  echo "  ✓ backend-api reiniciado"
else
  echo "  ⚠ backend-api no encontrado en PM2"
fi

# ── Summary ───────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  Deploy intercom completo!"
echo "══════════════════════════════════════════"
echo ""
echo "  Verificacion:"
echo "    curl http://localhost:3001/intercom/devices"
echo "    curl http://localhost:3001/intercom/voip/health"
echo "    curl http://localhost:3001/provisioning/status"
echo ""
echo "  Para configurar cada telefono Fanvil:"
echo "    1. Conectar a la red LAN"
echo "    2. Abrir http://{IP} (admin/admin)"
echo "    3. Line > SIP > Line 1:"
echo "       Server: 18.230.40.6"
echo "       Port: 5060"
echo "       User: {extension}"
echo "       Pass: ver pjsip_wizard.conf"
echo "    4. O usar Auto-Provision URL:"
echo "       https://aionseg.co/provisioning/fanvil/"
echo ""
echo "  Extensiones:"
echo "    099     = Central AION (web)"
echo "    100-112 = Operadores"
echo "    200-217 = Puestos de seguridad"
echo "    300-317 = Intercomunicadores"
echo "    199     = Ring group (todos operadores)"
echo ""
