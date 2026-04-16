# INFORME INTEGRAL — AION Vision Hub (aionseg.co)

**Fecha:** 2026-04-16T18:18Z
**VPS:** 18.230.40.6 (EC2 t3.xlarge, Ubuntu 24.04)
**Dominio:** aionseg.co
**Branch:** `remediation/2026-04-aion-full-audit` (HEAD: `72d5853`)

---

## 1. RESUMEN EJECUTIVO

La plataforma esta parcialmente operativa. La infraestructura VPS esta saludable (28 PM2, 129 streams, 42 endpoints SIP, SSL 75 dias) pero hay un **error critico en produccion** que causa HTTP 500 en el dashboard y multiples paginas. Ademas, hay 5 migraciones no aplicadas, 2 remotes desincronizados, 50 tablas vacias, y 3 componentes Live View Pro sin integrar.

### Score actual: 78/100

| Categoria | Score | Notas |
|---|---|---|
| Infraestructura VPS | 95/100 | 28 PM2, 10 Docker, SSL, firewall, cron |
| Base de datos | 75/100 | 162 tablas, RLS 98%, PERO 8 tablas sin tenant_id causan 500 |
| Backend API | 70/100 | 85 modulos, 15 workers, PERO error critico overallStats |
| Frontend | 85/100 | 72 paginas, 129 componentes, 0 TS errors, PERO lazy imports pueden fallar |
| Testing | 60/100 | 48 test files, 37 tool tests green, PERO 37 tests legacy rotos |
| Seguridad | 90/100 | Supabase 0%, RLS 98%, JWT local, PERO 3 tablas sin RLS |
| Documentacion | 95/100 | 12 docs en remediation, CLAUDE.md, memoria actualizada |
| Deploy/CI | 70/100 | SCP manual (no git en VPS), 2 remotes desincronizados |

---

## 2. ERRORES CRITICOS EN PRODUCCION (requieren fix inmediato)

### ERR-001 [CRITICO] — `column "tenant_id" does not exist` en `/api/operational-data/stats`

**Impacto:** HTTP 500 en el dashboard operativo y cualquier pagina que llame `/operational-data/stats`. Se repite cada 2 segundos cuando un usuario navega el panel.

**Causa raiz:** El endpoint `overallStats()` en `backend/apps/backend-api/src/modules/operational-data/service.ts:1114-1130` ejecuta un query con `WHERE tenant_id = $1` contra **8 tablas que NO tienen columna `tenant_id`**:

| Tabla | Tiene tenant_id | Filas |
|---|---|---|
| residents | SI | 1824 |
| vehicles | SI | 972 |
| biometric_records | SI | 1410 |
| consignas | SI | 12 |
| site_administrators | SI | 37 |
| **siren_tests** | **NO** | 16 |
| **equipment_restarts** | **NO** | 0 |
| **site_door_inventory** | **NO** | 36 |
| **elevator_info** | **NO** | 11 |
| **guard_schedules** | **NO** | 17 |
| **monitoring_credentials** | **NO** | 0 |
| **operator_trainings** | **NO** | 0 |
| **site_cctv_description** | **NO** | 0 |

**Fix:** Dos opciones:
1. **Rapido (recomendado):** Modificar `overallStats()` para omitir `WHERE tenant_id =` en las 8 tablas que no lo tienen. Usar `WHERE 1=1` o simplemente `count(*)` sin filtro.
2. **Completo:** Crear migracion que agregue `tenant_id` a las 8 tablas + backfill del tenant por defecto.

### ERR-002 [ALTO] — 186 HTTP 500 responses en nginx access log

Directamente causados por ERR-001. Se resuelven al corregir el query.

### ERR-003 [ALTO] — Migraciones 033-036 no aplicadas a produccion

Las migraciones existen en el repo local pero NUNCA se ejecutaron en el VPS:

| Migracion | Contenido | Estado prod |
|---|---|---|
| 033_device_capabilities.sql | ALTER TABLE devices ADD capabilities JSONB | NO APLICADA |
| 034_camera_links.sql | CREATE TABLE camera_links | NO APLICADA |
| 035_user_scenes.sql | CREATE TABLE user_scenes | NO APLICADA |
| 036_live_recordings.sql | CREATE TABLE live_recordings | NO APLICADA |

**Impacto:** Funcionalidades Live View Pro (camera links, scenes, recordings) no funcionan en produccion aunque el frontend las carga.

### ERR-004 [MEDIO] — 2 remotes desincronizados

| Remote | Estado |
|---|---|
| origin (aion-vision-hub) | IN SYNC (`72d5853`) |
| aion (aion-platform) | DIVERGED (atras en `4bb5602`) |
| aionseg (aionseg-platform) | DIVERGED (atras en `a10d83a`) |

**Impacto:** Si alguien clona desde `aion` o `aionseg`, obtiene version vieja.

### ERR-005 [MEDIO] — 3 componentes Live View Pro sin integrar

| Componente | Refs en LiveViewPage/SmartCameraCell |
|---|---|
| IntercomPushToTalk | 0 — no renderizado en ningun lado |
| LiveViewEventsPanel | 0 — importado como lazy pero no renderizado |
| LiveViewOpsPanel | 0 — importado como lazy pero no renderizado |

---

## 3. INFRAESTRUCTURA VPS

### 3.1 Sistema

| Metrica | Valor |
|---|---|
| OS | Ubuntu 24.04.4 LTS |
| Kernel | 6.17.0-1010-aws |
| Hardware | EC2 t3.xlarge (4 vCPU, 16GB RAM) |
| Uptime | 1 dia 13 horas |
| Load avg | 0.51 0.75 0.86 |
| Disco | 21% usado (40/193GB) |
| RAM | 5.3/15GB usada (10GB disponible) |
| Swap | 12KB/2GB (minimo) |

### 3.2 Servicios PM2 (28 online, 0 errored)

- **API:** aionseg-api (270MB)
- **Workers (13):** detection-worker, hik-monitor, native-device-bridge, isapi-alerts, notification-dispatcher, backup-worker, retention-worker, automation-engine, reports-worker, health-check-worker, dvr-time-sync-worker, asterisk-call-logger, platform-server
- **Snapshots (12):** snap-ss-dvr, snap-ag-dvr1, snap-ag-dvr, snap-pq-nvr, snap-pq-dvr, snap-tl-dvr, snap-tl-nvr, snap-br-lpr1, snap-br-lpr2, snap-se-dvr1, snap-ar-dvr, snap-rtsp
- **Otros:** n8n-automations (390MB), face-recognition, pm2-logrotate, snap-dahua, imou-live-server, aion-vh-bridge, aion-vh-orchestrator, hik-heartbeat-bridge

### 3.3 Docker (10 containers)

aion-exporter, prometheus, postgres-exporter, pm2-exporter, blackbox, grafana, nginx-exporter, alertmanager, node-exporter, aion-zlm

### 3.4 Red

- **SSL:** aionseg.co (75 dias), stream.aionseg.co (76 dias)
- **Firewall:** 55 reglas UFW
- **Nginx:** 3 sites (aionseg.co, clave, stream.aionseg.co)
- **Cron:** 5 jobs activos (watchdog, qos-monitor, camera-status-sync, external-monitor, post-start)

### 3.5 Streams y comunicaciones

- **go2rtc:** 129 streams activos
- **Asterisk:** 42 PJSIP endpoints
- **n8n:** healthy

---

## 4. BASE DE DATOS

### 4.1 General

| Metrica | Valor |
|---|---|
| Version | PostgreSQL 16.13 |
| Base | aionseg_prod |
| Tamano | 128 MB |
| Tablas public | 162 |
| Conexiones | 25 |
| Migraciones | 8 (025-032) |
| RLS habilitado | 159/162 (98.1%) |
| Tablas vacias | 50 |
| Tablas deprecated | 3 |

### 4.2 Top 10 tablas por filas

| Tabla | Filas |
|---|---|
| visual_patrol_logs | 31,603 |
| camera_detections | 4,109 |
| automation_executions | 3,292 |
| residents | 1,824 |
| access_people | 1,823 |
| biometric_records | 1,410 |
| audit_logs | 1,282 |
| access_vehicles | 972 |
| vehicles | 971 |
| refresh_tokens | 852 |

### 4.3 Tablas sin RLS (3)

- `audit_log_deprecated_20260416` (deprecated, OK)
- `schema_migrations` (admin, OK)
- `feature_flags` (nueva, necesita RLS?)

### 4.4 NOTIFY triggers instalados

- events_notify_trigger → events
- incidents_notify_trigger → incidents
- alert_instances_notify_trigger → alert_instances

---

## 5. BACKEND

### 5.1 Resumen

| Metrica | Valor |
|---|---|
| Modulos | 85 |
| Workers | 15 |
| Schema files | 34 |
| Migrations | 31 (locales) / 8 (aplicadas en prod) |
| Services | 44 |
| Plugins | 6 |
| Test files | 48 |
| Tests passing | 37/37 (tool handlers) |

### 5.2 Migraciones pendientes de aplicar

| # | Archivo | Contenido |
|---|---|---|
| 033 | device_capabilities.sql | ALTER TABLE devices ADD capabilities JSONB |
| 034 | camera_links.sql | CREATE TABLE camera_links (mapping camara-dispositivo) |
| 035 | user_scenes.sql | CREATE TABLE user_scenes (layouts personalizados) |
| 036 | live_recordings.sql | CREATE TABLE live_recordings (grabacion on-demand) |

---

## 6. FRONTEND

### 6.1 Resumen

| Metrica | Valor |
|---|---|
| Paginas | 72 |
| Componentes | 129 |
| TypeScript errors | 0 |
| I18N ES | 1,657 keys |
| I18N EN | 1,580 keys |
| Supabase refs | 0 |
| Live View Pro components | 13 (10 integrados, 3 sin integrar) |
| Build hash en prod | index-BWm7JjjI.js |

### 6.2 Componentes Live View Pro

| Componente | Integrado | Notas |
|---|---|---|
| CameraGrid | SI | LiveViewPage |
| CameraContextPanel | SI | LiveViewPage |
| LiveViewToolbar | SI (import only) | No renderizado activamente |
| DetectionOverlay | SI | SmartCameraCell (FF gated) |
| AiCopilotBanner | SI | SmartCameraCell (FF gated) |
| PtzInlineControl | SI | SmartCameraCell (FF gated) |
| EventTimelineSparkline | SI | SmartCameraCell (FF gated) |
| FloorPlanView | SI | LiveViewPage tab "Mapa" (FF gated) |
| SceneComposer | SI | LiveViewPage tab "Escenas" (FF gated) |
| TourEngine | SI (import only) | No renderizado en JSX |
| **IntercomPushToTalk** | **NO** | Debe ir en CameraContextPanel tab Citofonia |
| **LiveViewEventsPanel** | **NO** | Debe ir como tab en panel lateral |
| **LiveViewOpsPanel** | **NO** | Debe ir como tab en panel lateral |

---

## 7. PLAN DE CORRECCION (ordenado por impacto)

### URGENTE (hacer ahora)

**7.1 Fix ERR-001: overallStats query**
- Archivo: `backend/apps/backend-api/src/modules/operational-data/service.ts:1114-1130`
- Cambiar: quitar `WHERE tenant_id =` de las 8 tablas que no lo tienen
- Rebuild backend en VPS + pm2 restart
- Verificar: `/api/operational-data/stats` devuelve 200

**7.2 Aplicar migraciones 033-036**
```bash
for m in 033 034 035 036; do
  scp migrations/${m}_*.sql aion-vps:/tmp/
  ssh aion-vps "sudo -u postgres psql aionseg_prod -f /tmp/${m}_*.sql"
done
```

**7.3 Sync remotes**
```bash
git push aion remediation/2026-04-aion-full-audit
git push aionseg remediation/2026-04-aion-full-audit
```

### ALTO (hacer esta semana)

**7.4 Integrar 3 componentes faltantes**
- IntercomPushToTalk → CameraContextPanel tab "Citofonia"
- LiveViewEventsPanel → LiveViewPage panel lateral
- LiveViewOpsPanel → LiveViewPage panel lateral

**7.5 Agregar tenant_id a las 8 tablas**
- Crear migracion 037 que haga `ALTER TABLE ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id)`
- Backfill con el tenant por defecto
- Habilitar RLS en `feature_flags`

**7.6 Fix 37 tests legacy rotos**
- Reescribir mocks de `@/integrations/supabase/client` en 11 test files
- Meta: 0 tests failing

### MEDIO (hacer este mes)

**7.7 I18N completar**
- 77 keys de diferencia entre ES (1657) y EN (1580)
- Strings hardcoded en espanol en las paginas que no fueron migradas

**7.8 CI/CD pipeline**
- Implementar deploy via GitHub Actions (no SCP manual)
- `deploy-production.yml` con: build → test → scp → pm2 reload

**7.9 DVR time sync via VPN**
- Configurar WireGuard site-to-site para alcanzar DVRs en LANs remotas

**7.10 50 tablas vacias — evaluar**
- Verificar cuales son features activas vs abandonadas
- Documentar el proposito de cada una

### BAJO (backlog)

**7.11 Test coverage meta 80%**
- Actualmente: 37 tests en tools, 48 test files total
- Meta: cubrir los 45 tool handlers + modulos criticos

**7.12 Deprecated tables cleanup**
- 3 tablas `_deprecated_20260416` — DROP despues de 30 dias sin incidentes

**7.13 Performance**
- DB 128MB — saludable, no requiere accion
- RAM 5.3/15GB — amplio margen
- Load 0.5 — bajo

---

## 8. INVENTARIO COMPLETO

### 8.1 Backups disponibles

| Timestamp | Contenido | Ubicacion |
|---|---|---|
| 20260415-205328 | postgres + var-www + opt-aion + nginx + asterisk + pm2 (422MB) | /var/backups/aion/ |
| 20260416-031258 | postgres + var-www (178MB) | /var/backups/aion/ |
| 20260416-050132 | pre-deploy dump (7.1MB) | /var/backups/aion/ |

### 8.2 Tags git

- `pre-remediation-20260415-155113` — snapshot antes de remediacion
- `pre-deploy-fase9-20260416-000057` — snapshot antes de deploy
- `release/aion-v2026.04.16` — release tag
- `release/aion-v2026.04.16-final` — release final tag

### 8.3 PR

- PR #61: MERGED (remediation/2026-04-aion-full-audit → main)

---

## 9. METRICAS COMPARATIVAS

| Metrica | 2026-04-15 (antes) | 2026-04-16 (ahora) | Cambio |
|---|---|---|---|
| Supabase refs | 88 | 0 | -100% |
| FX pendientes | 30 | 0 | -100% |
| Tablas | 158 | 162 | +4 |
| Migraciones prod | 029 | 032 | +3 |
| PM2 servicios | 26 | 28 | +2 |
| Tests tool handlers | 0 | 37 | +37 |
| I18N keys ES | 1,058 | 1,657 | +599 |
| Live View Pro | 3/13 integrados | 10/13 integrados | +7 |
| Errores API | 0 | 186 x 500 | REGRESION (ERR-001) |

---

## 10. CONCLUSIONES

La plataforma tiene una base solida (28 servicios, 129 streams, 162 tablas, SSL, monitoreo Grafana/Prometheus) pero necesita **1 fix critico inmediato** (overallStats query) que causa todos los HTTP 500 visibles. Las migraciones 033-036 deben aplicarse para habilitar Live View Pro completo. Los 3 componentes faltantes son trabajo frontend menor. El plan de 7 pasos urgentes resolveria todos los problemas visibles.

---

*Informe generado: 2026-04-16T18:40Z*
*Auditor: Claude Code CLI (Opus 4.6)*
*Tiempo de auditoria: 22 minutos*
*Datos verificados contra: VPS runtime, DB queries, nginx logs, PM2 logs, git repos, source code*
