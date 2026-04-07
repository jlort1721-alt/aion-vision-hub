# Guia de Migracion a Produccion — AION Vision Hub

**Fecha:** 2026-04-07
**Version:** Post Plan Maestro de Mejoras

---

## Pre-requisitos

- Acceso SSH al VPS (18.230.40.6)
- Acceso a dashboards de: Supabase, OpenAI, Anthropic, Twilio, ElevenLabs, Resend
- `git filter-repo` instalado (`pip install git-filter-repo`)

## Paso 1: Rotar Secretos (CRITICO)

```bash
# Desde tu maquina local
cd /Users/ADMIN/Documents/open-view-hub-main
bash scripts/rotate-secrets.sh
```

Seguir las instrucciones del script para cada proveedor. Guardar los nuevos valores.

## Paso 2: Purgar Historial Git

```bash
# BACKUP primero
git clone --mirror . ../open-view-hub-backup

# Purgar archivos con secretos
pip install git-filter-repo
git filter-repo --path backend/.env --invert-paths --force
git filter-repo --path deploy/backend.env.production --invert-paths --force
git filter-repo --path deploy/RUNBOOK.sh --invert-paths --force
git filter-repo --path deploy/go2rtc-complete.yaml --invert-paths --force
git filter-repo --path deploy/go2rtc-dahua-ready.yaml --invert-paths --force
git filter-repo --path deploy/go2rtc-hikvision.yaml --invert-paths --force

# Re-agregar remote y push
git remote add origin git@github.com:USUARIO/open-view-hub-main.git
git push --force --all
git push --force --tags
```

## Paso 3: Generar y Aplicar Migraciones DB

```bash
# Generar SQL de migracion (indexes + FK constraints)
cd backend/apps/backend-api
npx drizzle-kit generate

# Revisar el SQL generado en db/migrations/
# Aplicar en produccion
npx drizzle-kit push
```

### Cambios de schema incluidos:
- 5 indexes en `audit_logs` (tenant, user, action, entity_type, created_at)
- FK `live_view_layouts.user_id` → `profiles.id`
- FK `streams.device_id` → `devices.id`
- FK `playback_requests.device_id` → `devices.id`
- Unique index `(email, tenant_id)` en `profiles`

## Paso 4: Actualizar .env en VPS

```bash
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6

# Editar con los nuevos valores del Paso 1
nano /var/www/aionseg/backend/.env
```

## Paso 5: Rebuild y Deploy

```bash
# En el VPS
cd /var/www/aionseg
git pull origin main

# Backend
cd backend && pnpm install && pnpm build
pm2 restart all

# Frontend (si aplica)
cd .. && npm install && npm run build
```

## Paso 6: Verificacion Post-Deploy

```bash
# Health check
curl -sf https://aionseg.co/api/health/ready

# Verificar endpoints
curl -sf https://aionseg.co/api/health/metrics | head -5

# Verificar WebSocket
wscat -c "wss://aionseg.co/ws" -H "Authorization: Bearer <JWT>"
```

## Paso 7: Configurar MCP Servers (Claude Code)

Editar `.mcp.json` en el proyecto local:
1. Reemplazar `<URL_N8N_VPS>` con la URL real de n8n
2. Reemplazar `<TU_API_KEY_N8N>` con la API key de n8n
3. Reiniciar Claude Code

## Rollback

Si algo falla despues del deploy:
```bash
# En el VPS
cd /var/www/aionseg
git checkout HEAD~1
cd backend && pnpm build
pm2 restart all
```
