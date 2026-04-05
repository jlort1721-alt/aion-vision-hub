#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Crear API key de AION dedicada para OpenClaw (read-only)
# Ejecutar en la VPS como ubuntu o root
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

echo "=== Creando API Key de AION para OpenClaw ==="

# 1. Login to get JWT
echo "Obteniendo JWT..."
LOGIN_RESPONSE=$(curl -sf --max-time 10 \
    -X POST http://127.0.0.1:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{
        "email": "jlort1721@gmail.com",
        "password": "REEMPLAZA_PASSWORD_ADMIN"
    }' 2>/dev/null)

if [[ -z "$LOGIN_RESPONSE" ]]; then
    echo "ERROR: No se pudo hacer login. Verificar credenciales."
    exit 1
fi

JWT=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken // .accessToken // empty' 2>/dev/null)
if [[ -z "$JWT" ]]; then
    echo "ERROR: No se pudo extraer JWT del response:"
    echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
    exit 1
fi

echo "JWT obtenido."

# 2. Create API key
echo "Creando API key..."
APIKEY_RESPONSE=$(curl -sf --max-time 10 \
    -X POST http://127.0.0.1:3000/api-keys \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${JWT}" \
    -d '{
        "name": "openclaw-reader",
        "description": "OpenClaw read-only access — solo GET endpoints",
        "permissions": ["read"],
        "expiresAt": null
    }' 2>/dev/null)

if [[ -z "$APIKEY_RESPONSE" ]]; then
    echo "ERROR: No se pudo crear API key."
    exit 1
fi

API_KEY=$(echo "$APIKEY_RESPONSE" | jq -r '.data.key // .key // empty' 2>/dev/null)
if [[ -z "$API_KEY" ]]; then
    echo "WARN: No se pudo extraer la key automaticamente."
    echo "Response completo:"
    echo "$APIKEY_RESPONSE" | jq '.' 2>/dev/null || echo "$APIKEY_RESPONSE"
    echo ""
    echo "Si la API key fue creada, copiala manualmente y ponla en:"
    echo "  /home/openclaw/.openclaw/.env → AION_API_KEY=..."
    exit 0
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  API Key creada exitosamente"
echo ""
echo "  Key: ${API_KEY}"
echo ""
echo "  Agregar a /home/openclaw/.openclaw/.env:"
echo "  AION_API_KEY=${API_KEY}"
echo "═══════════════════════════════════════════════════════════"

# 3. Optionally auto-insert into .env
if [[ -f /home/openclaw/.openclaw/.env ]]; then
    if grep -q "REEMPLAZA_CON_API_KEY_AION" /home/openclaw/.openclaw/.env; then
        sed -i "s/REEMPLAZA_CON_API_KEY_AION/${API_KEY}/" /home/openclaw/.openclaw/.env
        echo ""
        echo "Auto-inserted into /home/openclaw/.openclaw/.env"
    fi
fi
