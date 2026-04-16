# Reporte de Despliegue — Reverse-Connect v1.1.0

**Fecha:** 2026-04-12
**Ejecutor:** Claude Code (Opus 4.6)
**VPS:** 18.230.40.6 (AWS t3.xlarge, Sao Paulo)

---

## Resumen

Se integro exitosamente el paquete reverse-connect v1.1.0 al monorepo AION y se desplego en produccion. La integracion incluye:

1. **Schema Drizzle ORM** para las 5 tablas del schema `reverse` en PostgreSQL
2. **Backend API mejorado** con Drizzle ORM (antes raw SQL), paginacion, validacion extendida
3. **Frontend mejorado** con PTZ joystick, dialogo de aprobacion de dispositivos, tarjetas de sesion, KPIs
4. **Migracion de schema** en VPS (ALTER TABLE para agregar columnas faltantes)
5. **Go gateway** copiado al repo para compilacion futura
6. **Tests** actualizados y pasando (34/34)

---

## Estado Post-Deploy

| Metrica | Valor |
|---------|-------|
| Dispositivos registrados | 11 (9 Hikvision + 2 Dahua) |
| Dispositivos online | 11/11 (100%) |
| Sesiones activas | 5 |
| Streams activos | 0 (pendiente gateway Go) |
| API respondiendo | Si (health/ready: ok) |
| Frontend desplegado | Si (250 JS bundles) |
| aionseg.co | 200 OK |
| Tests pasando | 34/34 reverse, 879/916 total |

---

## Cambios Realizados

### Backend (6 archivos)

| Archivo | Accion | Detalle |
|---------|--------|---------|
| `db/schema/reverse.ts` | NUEVO | Drizzle ORM schema con 5 tablas (devices, sessions, streams, events, audit_log) |
| `db/schema/index.ts` | EDITADO | +7 lineas: export de las 5 tablas reverse |
| `modules/reverse/schemas.ts` | REEMPLAZADO | PTZ actions renombrados (pan_left, tilt_up, etc.), channel 1-256, speed 1-8, pagination, credentials |
| `modules/reverse/service.ts` | REEMPLAZADO | Raw SQL -> Drizzle ORM queries, paginacion con total/limit/offset |
| `modules/reverse/routes.ts` | REEMPLAZADO | Multi-format stream URLs (mp4/hls/webrtc), preset validation, go2rtc integration |
| `__tests__/reverse.test.ts` | ACTUALIZADO | 23 -> 34 tests, cubre nuevos schemas |

### Frontend (4 archivos)

| Archivo | Accion | Detalle |
|---------|--------|---------|
| `pages/ReverseFleetPage.tsx` | REEMPLAZADO | Tabs sessions/devices, KPIs, search, session detail panel |
| `components/reverse/SessionCard.tsx` | NUEVO | Tarjeta de sesion con heartbeat, vendor badge, estado |
| `components/reverse/PTZJoystick.tsx` | NUEVO | D-pad + zoom + focus + snapshot + speed slider |
| `components/reverse/DeviceApprovalDialog.tsx` | NUEVO | Dialogo con credenciales, ISUP key (Hikvision), canales |

### VPS (schema migration)

```sql
ALTER TABLE reverse.devices ADD COLUMN IF NOT EXISTS username_enc BYTEA;
ALTER TABLE reverse.devices ADD COLUMN IF NOT EXISTS password_enc BYTEA;
ALTER TABLE reverse.devices ADD COLUMN IF NOT EXISTS isup_key_enc BYTEA;
ALTER TABLE reverse.sessions ADD COLUMN IF NOT EXISTS sdk_version TEXT;
-- + 7 indices nuevos + 1 UNIQUE constraint
```

### Repo (Go gateway + docs)

| Directorio | Contenido |
|------------|-----------|
| `reverse-gateway/` | Gateway Go completo (44 archivos) |
| `ansible/` | Playbooks para provisioning de sitios |
| `docs/reverse-connect/` | Plan maestro, runbook, manual operador, guia provisioning |
| `.github/workflows/reverse-gateway.yml` | CI pipeline |

---

## Pendientes para v1.2

1. **Compilar Go gateway** con SDKs propietarios (Dahua NetSDK + Hikvision HCNetSDK)
2. **Desplegar gateway** como proceso PM2 independiente
3. **Activar SSE events** (requiere Redis pub/sub desde el gateway)
4. **Habilitar LiveGrid** (requiere streams rv_* en go2rtc desde el gateway)
5. **Provisionar 22 sitios** con Ansible (Auto Register / Platform Access)
6. **Canary rollout** con 1 sitio piloto primero

---

## Rollback

```bash
# Backend
cp -r /var/www/aionseg/backups/dist-pre-v110-*/. /var/www/aionseg/backend/apps/backend-api/dist/
pm2 restart aionseg-api

# Frontend
cp -r /var/www/aionseg/backups/frontend-pre-v110-*/. /var/www/aionseg/frontend/

# Schema (si necesario)
ALTER TABLE reverse.devices DROP COLUMN IF EXISTS username_enc;
ALTER TABLE reverse.devices DROP COLUMN IF EXISTS password_enc;
ALTER TABLE reverse.devices DROP COLUMN IF EXISTS isup_key_enc;
ALTER TABLE reverse.sessions DROP COLUMN IF EXISTS sdk_version;

# DB backup disponible en
# /tmp/pre-reverse-v110-20260412-1501.dump
```
