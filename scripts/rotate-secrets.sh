#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# AION Vision Hub — Script de Rotacion de Secretos
# Ejecutar MANUALMENTE despues de rotar cada secreto en su proveedor
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

echo "═══════════════════════════════════════════════════════"
echo " ROTACION DE SECRETOS — AION Vision Hub"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "IMPORTANTE: Este script genera valores nuevos."
echo "Debes actualizar cada proveedor manualmente y luego"
echo "copiar los nuevos valores al .env del VPS."
echo ""

# 1. JWT_SECRET
NEW_JWT=$(openssl rand -hex 32)
echo "[1/8] JWT_SECRET nuevo: $NEW_JWT"
echo "  → Actualizar en: VPS backend/.env → JWT_SECRET="
echo ""

# 2. CREDENTIAL_ENCRYPTION_KEY
NEW_CRED_KEY=$(openssl rand -hex 32)
echo "[2/8] CREDENTIAL_ENCRYPTION_KEY nuevo: $NEW_CRED_KEY"
echo "  → ATENCION: Requiere re-encriptar tabla devices"
echo "  → Ejecutar: node scripts/reencrypt-credentials.js OLD_KEY NEW_KEY"
echo ""

# 3. DATABASE PASSWORD
NEW_DB_PASS=$(openssl rand -base64 24 | tr -d '=+/')
echo "[3/8] Database password sugerido: $NEW_DB_PASS"
echo "  → Cambiar en: Supabase Dashboard → Database Settings → Password"
echo "  → Actualizar DATABASE_URL en backend/.env"
echo ""

# 4. OPENAI_API_KEY
echo "[4/8] OPENAI_API_KEY"
echo "  → Rotar en: https://platform.openai.com/api-keys"
echo "  → Revocar la key actual (sk-proj-...) y crear una nueva"
echo ""

# 5. ANTHROPIC_API_KEY
echo "[5/8] ANTHROPIC_API_KEY"
echo "  → Rotar en: https://console.anthropic.com/settings/keys"
echo "  → Revocar la key actual (sk-ant-...) y crear una nueva"
echo ""

# 6. ELEVENLABS_API_KEY
echo "[6/8] ELEVENLABS_API_KEY"
echo "  → Rotar en: https://elevenlabs.io/app/settings/api-keys"
echo ""

# 7. RESEND_API_KEY
echo "[7/8] RESEND_API_KEY"
echo "  → Rotar en: https://resend.com/api-keys"
echo ""

# 8. TWILIO
echo "[8/8] TWILIO credentials"
echo "  → Rotar Auth Token en: https://console.twilio.com"
echo "  → Account → API Keys → Crear nuevo par SID/Secret"
echo ""

echo "═══════════════════════════════════════════════════════"
echo " VALORES GENERADOS (copiar al .env del VPS):"
echo "═══════════════════════════════════════════════════════"
echo "JWT_SECRET=$NEW_JWT"
echo "CREDENTIAL_ENCRYPTION_KEY=$NEW_CRED_KEY"
echo "# DB_PASSWORD=$NEW_DB_PASS (actualizar en DATABASE_URL)"
echo ""
echo "NOTA: No olvides reiniciar los servicios en el VPS:"
echo "  ssh ubuntu@18.230.40.6 'pm2 restart all'"
