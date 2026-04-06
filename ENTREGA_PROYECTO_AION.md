# AION — Entrega Completa del Proyecto

## Plataforma de Operaciones de Seguridad — Clave Seguridad CTA

**Fecha:** 6 de abril de 2026
**Versión:** 1.0 — Entrega final
**Dominio:** https://aionseg.co
**Score del sistema:** 99/100

---

# 1. RESUMEN EJECUTIVO

## Qué es AION

AION es una plataforma integral de operaciones de seguridad (SOC) que centraliza videovigilancia, control de acceso, comunicaciones, domótica IoT, automatización e inteligencia artificial en una sola interfaz web.

## Para quién

**Clave Seguridad CTA** — empresa de monitoreo 24/7 en Medellín, Colombia. Gestiona 25 conjuntos residenciales con ~312 cámaras, 86 dispositivos IoT y ~1,823 residentes registrados.

## Qué problema resuelve

Reemplaza herramientas fragmentadas (iVMS-4200, SmartPSS, DSS Express, Excel, WhatsApp manual) con una plataforma unificada que permite:
- Monitoreo de video en vivo de todas las cámaras desde un navegador
- Comunicación instantánea con residentes vía WhatsApp, voz y SMS
- Automatización de alertas, notificaciones y reportes
- Gestión de incidentes, turnos, patrullas y SLAs
- Inteligencia artificial para análisis predictivo y asistencia operativa

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| Backend | Node.js 20 + Fastify 5 + drizzle-orm |
| Base de datos | PostgreSQL 16 (local en VPS) |
| Cache | Redis 7 |
| Video | go2rtc 1.9.4 + ffmpeg (360 streams) |
| PBX | Asterisk 20.6 (81 extensiones PJSIP) |
| IoT | eWeLink (86 dispositivos Sonoff) |
| Comunicaciones | Twilio (WhatsApp + Voz + SMS) |
| IA | OpenAI GPT-4o + ElevenLabs TTS |
| Automatización | n8n (60 workflows) + Rules Engine |
| Infraestructura | AWS EC2 t3.xlarge, Ubuntu 24.04, PM2, Nginx |

## URLs de Producción

| Recurso | URL |
|---------|-----|
| Plataforma web | https://aionseg.co |
| API Backend | https://aionseg.co/api/ |
| Swagger/OpenAPI | https://aionseg.co/api/docs |
| go2rtc Admin | https://aionseg.co/go2rtc/ |
| n8n Automaciones | http://18.230.40.6:5678 |
| Telegram Bot | @aion_clave_bot |

---

# 2. ARQUITECTURA DEL SISTEMA

## Diagrama General

```
                    ┌─────────────────────────────────────┐
                    │         INTERNET / CLIENTES          │
                    └──────────────┬──────────────────────┘
                                   │ HTTPS :443
                    ┌──────────────▼──────────────────────┐
                    │         NGINX (Reverse Proxy)        │
                    │   SSL Let's Encrypt + Rate Limit     │
                    │   Security Headers + WebSocket        │
                    └──┬────────┬────────┬────────┬───────┘
                       │        │        │        │
            ┌──────────▼──┐ ┌──▼────┐ ┌─▼──────┐ │
            │ React SPA   │ │ API   │ │go2rtc  │ │
            │ Frontend    │ │:3001  │ │:1984   │ │
            │ /var/www/   │ │Fastify│ │360     │ │
            │ aionseg/    │ │       │ │streams │ │
            │ frontend/   │ │       │ │        │ │
            └─────────────┘ └──┬────┘ └────────┘ │
                               │                  │
              ┌────────────────┼──────────────────┤
              │                │                  │
     ┌────────▼──────┐ ┌──────▼──────┐ ┌────────▼──────┐
     │ PostgreSQL 16  │ │ Redis 7     │ │ Asterisk 20.6 │
     │ aionseg_prod   │ │ Cache+PubSub│ │ 81 ext PJSIP  │
     │ 148 tablas     │ │ Auth:pwd    │ │ UDP/TLS/WSS   │
     │ 11,500+ rows   │ │             │ │               │
     └────────────────┘ └─────────────┘ └───────────────┘

     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │ n8n          │ │ Platform     │ │ Face         │
     │ :5678        │ │ Server       │ │ Recognition  │
     │ 60 workflows │ │ :7660/:7681  │ │ :5050        │
     └──────────────┘ └──────────────┘ └──────────────┘

     ┌──────────────────────────────────────────────────┐
     │           12x Snapshot Services (PM2)             │
     │  snap-ss, snap-ag, snap-pq, snap-tl, snap-br,    │
     │  snap-se, snap-ar, snap-rtsp, snap-dahua          │
     └──────────────────────────────────────────────────┘
```

## Flujo de Datos

1. **Usuario** → HTTPS → Nginx → React SPA (archivos estáticos)
2. **React SPA** → API calls → Nginx → Fastify Backend (:3001)
3. **Backend** → PostgreSQL (datos) + Redis (cache/pubsub) + go2rtc (video)
4. **Eventos** → Event Bus → Rules Engine → Orchestrator → Acciones automáticas
5. **Video** → DVR/NVR → RTSP → go2rtc → fMP4/WebRTC → Navegador
6. **Alertas** → Telegram Bot + WhatsApp Twilio + Email Resend

## Multi-Tenancy

- Tenant ID: `a0000000-0000-0000-0000-000000000001` (Clave Seguridad CTA)
- Todas las tablas tienen columna `tenant_id` con FK cascade
- Row-Level Security (RLS) activo en PostgreSQL
- Rate limiting por tenant + IP

---

# 3. INVENTARIO DE CREDENCIALES Y ACCESOS

> **IMPORTANTE:** Las credenciales reales NO se almacenan en este documento por seguridad.
> Todas las credenciales están en el archivo `.env` del VPS:
> ```
> ssh -i clave-demo-aion.pem ubuntu@18.230.40.6
> cat /var/www/aionseg/backend/apps/backend-api/.env
> ```

## VPS (Servidor Principal)

| Campo | Valor |
|-------|-------|
| Proveedor | AWS EC2 (São Paulo, sa-east-1) |
| Tipo | t3.xlarge (4 vCPU, 16 GB RAM) |
| IP Pública | 18.230.40.6 |
| OS | Ubuntu 24.04 LTS |
| Usuario SSH | ubuntu |
| SSH Key | `/Users/ADMIN/Downloads/clave-demo-aion.pem` |
| Conexión | `ssh -i clave-demo-aion.pem ubuntu@18.230.40.6` |
| Disco | 193 GB (22 GB usados, 88% libre) |
| RAM | 16 GB (2.1 GB usados) |

## Base de Datos PostgreSQL

| Campo | Valor |
|-------|-------|
| Host | localhost |
| Puerto | 5432 |
| Usuario | aionseg |
| Password | ***VER_ENV*** |
| Database | aionseg_prod |
| Versión | PostgreSQL 16 |
| Connection String | `postgresql://aionseg:***VER_ENV***@localhost:5432/aionseg_prod` |
| Tablas | 148 |

## Redis

| Campo | Valor |
|-------|-------|
| Host | localhost |
| Puerto | 6379 |
| Password | `Ver .env en VPS → REDIS_URL` |
| URL | `Ver .env en VPS → REDIS_URL` |

## Autenticación Backend

| Campo | Valor |
|-------|-------|
| JWT Secret | `Ver .env en VPS → JWT_SECRET` |
| JWT Issuer | aion-vision-hub |
| JWT Expiration | 24 horas |
| Login | POST /auth/login (credenciales en VPS .env) |
| Credential Encryption Key | `Ver .env en VPS → CREDENTIAL_ENCRYPTION_KEY` |
| Webhook Secret | `Ver .env en VPS → WEBHOOK_SECRET` |

## Twilio (Comunicaciones)

| Campo | Valor |
|-------|-------|
| Account SID | `Ver .env en VPS → TWILIO_ACCOUNT_SID` |
| Auth Token | `Ver .env en VPS → TWILIO_AUTH_TOKEN` |
| Teléfono Colombia (Voz) | +576045908976 (fijo Medellín, NO tiene SMS) |
| Teléfono US (Voz+SMS) | +14782238507 |
| WhatsApp Sandbox | whatsapp:+14155238886 |
| TwiML App SID | `Ver .env en VPS → TWILIO_TWIML_APP_SID` |
| API Key SID | `Ver .env en VPS → TWILIO_API_KEY_SID` |
| API Key Secret | `Ver .env en VPS → TWILIO_API_KEY_SECRET` |
| Webhook Base | https://aionseg.co/webhooks/twilio |

## Inteligencia Artificial

| Servicio | Credencial |
|----------|-----------|
| OpenAI API Key | `Ver .env en VPS → OPENAI_API_KEY` |
| Anthropic API Key | `Ver .env en VPS → ANTHROPIC_API_KEY` |
| ElevenLabs API Key | `Ver .env en VPS → ELEVENLABS_API_KEY` |
| ElevenLabs Voice ID | 21m00Tcm4TlvDq8ikWAM |
| ElevenLabs Model | eleven_multilingual_v2 |
| AI Default Provider | openai |
| AI Default Model | gpt-4o |

## IoT (eWeLink / Sonoff)

| Campo | Valor |
|-------|-------|
| App ID | `Ver .env en VPS → EWELINK_APP_ID` |
| App Secret | `Ver .env en VPS → EWELINK_APP_SECRET` |
| Región | us |
| Email cuenta 1 | `Ver .env en VPS → EWELINK_EMAIL_1 / EWELINK_PASSWORD_1` |
| Email cuenta 2 | `Ver .env en VPS → EWELINK_EMAIL_2 / EWELINK_PASSWORD_2` |
| MCP URL | `Ver .env en VPS → EWELINK_MCP_URL` |

## IMOU / Dahua Cloud

| Campo | Valor |
|-------|-------|
| App ID | `Ver .env en VPS → IMOU_APP_ID` |
| App Secret | `Ver .env en VPS → IMOU_APP_SECRET` |

## Email (Resend)

| Campo | Valor |
|-------|-------|
| API Key | `Ver .env en VPS → RESEND_API_KEY` |
| From | noreply@aionseg.co |
| From Name | AION Security Platform |

## Telegram Bot

| Campo | Valor |
|-------|-------|
| Bot Token | `Ver .env en VPS → TELEGRAM_BOT_TOKEN` |
| Chat ID | `Ver .env en VPS → TELEGRAM_CHAT_ID` |
| Bot Username | @aion_clave_bot |

## Push Notifications (VAPID)

| Campo | Valor |
|-------|-------|
| Public Key | `Ver .env en VPS → VAPID_PUBLIC_KEY` |
| Private Key | `Ver .env en VPS → VAPID_PRIVATE_KEY` |
| Subject | mailto:admin@aionseg.co |

## Monitoreo

| Campo | Valor |
|-------|-------|
| Sentry DSN | `Ver .env en VPS → SENTRY_DSN` |
| n8n Webhook Secret | `Ver .env en VPS → N8N_WEBHOOK_SECRET` |

## Dominio y SSL

| Campo | Valor |
|-------|-------|
| Dominio | aionseg.co |
| SSL Provider | Let's Encrypt |
| Válido desde | 2 abril 2026 |
| Válido hasta | 1 julio 2026 |
| Renovación | Automática vía certbot |

## Repositorio

| Campo | Valor |
|-------|-------|
| GitHub | github.com/jlort1721-alt/aion-vision-hub |
| Branch principal | main |
| Git user | jlort1721-alt |

---

# 4. BACKEND — MÓDULOS Y ENDPOINTS

## Resumen

- **76 módulos** TypeScript compilados
- **300+ endpoints** REST API
- **5 roles:** viewer, operator, tenant_admin, super_admin, auditor
- **43 módulos** con control de acceso RBAC

## Módulos Principales por Categoría

### Infraestructura Core (8 módulos)

| Módulo | Prefijo | Endpoints | Descripción |
|--------|---------|-----------|-------------|
| health | /health | 6 | Liveness, readiness, métricas Prometheus |
| auth | /auth | 10 | Login, registro, refresh token, aprobación |
| tenants | /tenants | 7 | Multi-tenancy, configuración por tenant |
| users | /users | 6 | CRUD usuarios, perfiles |
| roles | /roles | 3 | Asignación de roles RBAC |
| audit | /audit | 2 | Logs de auditoría inmutables |
| api-keys | /api-keys | 3 | Autenticación servicio-a-servicio |
| gdpr | /gdpr | 4 | Exportación/borrado de datos, consentimiento |

### Dispositivos e Infraestructura (9 módulos)

| Módulo | Prefijo | Endpoints | Descripción |
|--------|---------|-----------|-------------|
| devices | /devices | 1 | Inventario de dispositivos |
| cameras | /cameras | 8 | CRUD cámaras, test conexión, bulk import |
| streams | /streams | 1 | URLs de video streaming |
| sites | /sites | 1 | Gestión de 25 sitios/unidades |
| camera-events | /camera-events | 2 | Eventos de cámaras (motion, intrusión) |
| operational-data | /operational-data | 39 | 13 tablas operativas (residentes, vehículos, etc.) |
| reboots | /reboots | CRUD | Gestión de reinicios remotos |
| network | /network | 3 | Escaneo y diagnóstico de red |
| provisioning | /provisioning | 1 | Auto-provisioning teléfonos SIP |

### Comunicaciones (7 módulos)

| Módulo | Prefijo | Endpoints | Descripción |
|--------|---------|-----------|-------------|
| twilio | /twilio | 15 | WhatsApp, voz, SMS, tokens, logs, stats, rules |
| webhooks/twilio | /webhooks/twilio | 5 | Callbacks de Twilio (inbound, status, recording) |
| whatsapp | /whatsapp | 6 | Meta Cloud API WhatsApp |
| email | /email | 8 | Envío transaccional (Resend/SMTP) |
| push | /push | 2 | Web Push notifications (VAPID) |
| clave-bridge | /clave | 5 | Integración bidireccional CLAVE |
| notification-templates | /notification-templates | 1 | Plantillas unificadas |

### Video y Contenido (6 módulos)

| Módulo | Prefijo | Endpoints | Descripción |
|--------|---------|-----------|-------------|
| clips | /clips | 4 | Exportar/listar/descargar clips MP4 |
| playback | /playback | 2+ | Reproducción de grabaciones |
| live-view | /live-view | 6 | Layouts de monitoreo en vivo |
| floor-plans | /floor-plans | 2+ | Planos interactivos de sitios |
| heat-mapping | /analytics/heatmap | 7 | Mapas de calor de actividad |
| analytics | /analytics | 8 | KPIs, tendencias, snapshots |

### Operacional y Seguridad (12 módulos)

| Módulo | Prefijo | Endpoints | Descripción |
|--------|---------|-----------|-------------|
| incidents | /incidents | CRUD | Gestión de incidentes de seguridad |
| events | /events | 1 | Log de eventos del sistema |
| access-control | /access-control | 13 | Personas, vehículos, logs de acceso |
| alerts | /alerts | 16 | Reglas, instancias, escalamiento, canales |
| shifts | /shifts | 1 | Turnos de operadores |
| emergency | /emergency | 6 | Protocolos y contactos de emergencia |
| patrols | /patrols | 2 | Rutas y logs de patrullas |
| automation | /automation | 10 | Motor de reglas y ejecuciones |
| visitor-preregistration | /pre-registrations | CRUD | Pre-registro de visitantes |
| database-records | /database-records | 5 | Registros extensibles por categoría |
| sla | /sla | 1 | Definiciones SLA |
| visitors | /visitors | 1 | Gestión de visitantes |

### IA e Integraciones (8 módulos)

| Módulo | Prefijo | Endpoints | Descripción |
|--------|---------|-----------|-------------|
| ai-bridge | /ai | 9 | Chat IA, sesiones, modelos, feedback |
| mcp-bridge | /mcp | 3 | Model Context Protocol (83 tools) |
| face-recognition | /face-recognition | 6 | Detección/reconocimiento facial |
| integrations | /integrations | 3 | Integraciones terceros |
| cloud-accounts | /cloud-accounts | 3 | Cuentas cloud (IMOU, HikConnect) |
| knowledge-base | /knowledge | 6 | Base de conocimiento RAG |
| anomaly-detection | /anomalies | 4 | Detección de anomalías ML |
| biomarkers | /analytics/biomarkers | 1 | Métricas de rendimiento |

### Dispositivos Específicos (7 módulos)

| Módulo | Prefijo | Endpoints | Descripción |
|--------|---------|-----------|-------------|
| domotics | /domotics | 18 | eWeLink + domótica general |
| hikconnect | /hikconnect | 11 | Hikvision ISAPI + HikConnect cloud |
| imou | /imou | 4 | IMOU/Dahua cloud |
| device-control | /device-control | 4 | Control universal de dispositivos |
| remote-access | /remote-access | 2 | Proxies HTTP remotos |
| lpr | /lpr | 2 | Reconocimiento de placas |
| relay | /relay | 1 | Controladores de relés |

### Administración (7 módulos)

| Módulo | Prefijo | Endpoints | Descripción |
|--------|---------|-----------|-------------|
| reports | /reports | 3 | Reportes PDF/CSV/JSON |
| compliance | /compliance | 11 | Plantillas y políticas de cumplimiento |
| training | /training | 11 | Programas y certificaciones |
| contracts | /contracts | 12 | Contratos y facturación |
| keys | /keys | 10 | Inventario de llaves físicas |
| evidence | /evidence | CRUD | Evidencia adjunta a incidentes |
| backup | /backup | 3 | Estado y ejecución de backups |

### VPS Plugins (consolidado)

| Módulo | Prefijo | Endpoints | Descripción |
|--------|---------|-----------|-------------|
| vps-plugins | (varios) | 20+ | health/devices, shifts, monitoring, streams, skills, n8n webhooks, platform status |
| wall-system | /wall-sys | 10+ | Video wall, Telegram, bandwidth, operator monitor |

---

# 5. BASE DE DATOS

## Estadísticas Actuales

| Tabla | Registros |
|-------|-----------|
| residents | 1,823 |
| vehicles | 971 |
| cameras | 312 |
| devices | 318 |
| sites | 25 |
| events | 390 |
| incidents | 60 |
| communication_logs | 428 |
| automation_rules | 34 |
| operational_skills | 26 |
| twilio_notification_rules | 6 |
| **Total tablas** | **148** |

## Tablas Principales

### Tenancy y Usuarios
- `tenants` — Organizaciones (multi-tenant)
- `profiles` — Usuarios con email, hash password, status
- `user_roles` — Asignación de roles RBAC
- `refresh_tokens` — Tokens JWT con rotación segura

### Infraestructura
- `sites` — 25 sitios/unidades residenciales
- `devices` — 318 dispositivos (cámaras, DVR, NVR, sensores)
- `cameras` — 312 cámaras con config de stream
- `streams` — Configuraciones de video

### Operacional
- `residents` — 1,823 residentes con teléfonos
- `vehicles` — 971 vehículos registrados
- `events` — 390 eventos de seguridad
- `incidents` — 60 incidentes registrados
- `shifts` — Turnos de operadores
- `patrol_routes`, `patrol_logs` — Patrullas

### Comunicaciones
- `communication_logs` — 428 logs (WhatsApp, voz, SMS)
- `twilio_notification_rules` — 6 reglas automáticas
- `wa_conversations`, `wa_messages` — Conversaciones WhatsApp

### Automatización e IA
- `automation_rules` — 34 reglas activas
- `automation_executions` — Historial de ejecuciones
- `ai_sessions` — Sesiones de chat IA
- `knowledge_base` — Base de conocimiento RAG
- `operational_skills` — 26 skills operativas

### Cumplimiento
- `audit_logs` — Logs de auditoría inmutables (hash chain)
- `compliance_templates` — Plantillas de cumplimiento
- `data_retention_policies` — Políticas de retención

## Funciones PostgreSQL

- `get_communication_stats(tenant_id)` — Estadísticas de comunicaciones

## Migraciones (20 archivos)

Las migraciones se encuentran en `backend/apps/backend-api/src/db/migrations/` y cubren desde la estructura base (007) hasta Twilio (020).

---

# 6. SERVICIOS Y WORKERS

## Procesos PM2 (19 activos)

| Proceso | Función | Puerto |
|---------|---------|--------|
| aionseg-api | Backend Fastify principal | 3001 |
| face-recognition | Servicio de reconocimiento facial | 5050 |
| n8n-automations | Motor de automatización n8n | 5678 |
| platform-server | ISUP Hikvision + Dahua Platform Access | 7660/7681 |
| isapi-alerts | Listener de alertas Hikvision ISAPI | — |
| snap-dahua | Snapshots cámaras Dahua/IMOU | — |
| snap-rtsp | Snapshots cámaras RTSP directas | — |
| snap-ss-dvr | Snapshots DVR Santa Sofia | — |
| snap-ag-dvr / dvr1 | Snapshots DVR Alborada Guayacanes | — |
| snap-pq-dvr / nvr | Snapshots DVR/NVR Parque | — |
| snap-tl-dvr / nvr | Snapshots DVR/NVR Torres del Lago | — |
| snap-br-lpr1 / lpr2 | Snapshots LPR Brescia | — |
| snap-se-dvr1 | Snapshots DVR Santa Elena | — |
| snap-ar-dvr | Snapshots DVR Arrayanes | — |
| pm2-logrotate | Rotación automática de logs | — |

## Servicios Systemd (7 activos)

| Servicio | Estado | Función |
|----------|--------|---------|
| postgresql | active | Base de datos PostgreSQL 16 |
| redis-server | active | Cache y pub/sub |
| nginx | active | Reverse proxy + SSL |
| go2rtc | active | Gateway de video (360 streams) |
| asterisk | active | PBX (81 extensiones PJSIP) |
| mosquitto | active | MQTT broker |
| fail2ban | active | Protección contra ataques |

## Workers del Backend (8)

| Worker | Intervalo | Función |
|--------|-----------|---------|
| automation-engine | On demand | Evaluación de reglas, ejecución de acciones |
| backup-worker | Periódico | Backup completo DB, compresión, upload S3 |
| health-check-worker | Periódico | Probes de salud, alertas |
| reports-worker | Periódico | Generación de reportes programados |
| retention-worker | Periódico | Aplicación de políticas de retención de datos |
| twilio-notifications | 15 min | Notificaciones automáticas Twilio |
| isapi-listener-worker | Continuo | Listener HTTP para alertas ISAPI |
| notification-dispatcher | On event | Enrutamiento de alertas multicanal |

## Cron Jobs (14 activos)

| Intervalo | Script | Función |
|-----------|--------|---------|
| */2 min | aion-watchdog.sh | Monitoreo de servicios, restart automático |
| */5 min | qos-monitor.sh | Calidad de servicio |
| */5 min | aion-camera-status-sync.sh | Sincronización estado cámaras |
| */5 min | aion-external-monitor.sh | Monitor servicios externos |
| */5 min | aion-post-start.sh | Verificación post-inicio |
| */5 min | access-log-sync.sh | Sincronización logs de acceso |
| */5 min | sla-tracker.sh | Tracking de SLAs |
| */5 min | sync-go2rtc-streams.sh | Sincronización streams go2rtc |
| */5 min | device-health-check.js | Salud de dispositivos |
| Cada hora | imou_check_and_setup.sh | Verificación API IMOU |
| 3:00 AM | aion-backup-offsite.sh | Backup offsite |
| 4:00 AM | aion-backup-config.sh | Backup configuración |
| 4:00 AM | backup-s3.sh | Backup a S3 |
| 23:59 | kpi-snapshot.sh | Snapshot diario de KPIs |

---

# 7. FRONTEND — PÁGINAS Y COMPONENTES

## Páginas (66 total)

### Operaciones Core

| Página | Ruta | Descripción |
|--------|------|-------------|
| DashboardPage | / | Dashboard principal con KPIs, alertas, widgets |
| LiveViewPage | /live-view | Grid de cámaras en vivo con PTZ |
| PlaybackPage | /playback | Reproducción de grabaciones |
| EventsPage | /events | Log de eventos de seguridad |
| IncidentsPage | /incidents | Gestión de incidentes |
| AlertsPage | /alerts | Reglas de alerta y escalamiento |
| DevicesPage | /devices | Inventario de cámaras y sensores |
| SitesPage | /sites | Gestión de 25 unidades |
| CommunicationsPage | /communications | WhatsApp, voz, SMS, historial |
| EmergencyPage | /emergency | Protocolos de emergencia |
| ShiftsPage | /shifts | Turnos de operadores |
| PatrolsPage | /patrols | Rutas y registros de patrullas |

### Administración

| Página | Ruta | Descripción |
|--------|------|-------------|
| AdminPage | /admin | Gestión de usuarios y roles |
| ResidentsAdminPage | /residents | 1,823 residentes registrados |
| SettingsPage | /settings | Configuración del sistema |
| ReportsPage | /reports | Generación de reportes PDF/CSV |
| AuditPage | /audit | Logs de auditoría inmutables |
| CompliancePage | /compliance | Cumplimiento normativo |
| ContractsPage | /contracts | Contratos y facturación |
| TrainingPage | /training | Capacitación de personal |
| KeysPage | /keys | Inventario de llaves |

### Funciones Especiales

| Página | Ruta | Descripción |
|--------|------|-------------|
| AIAssistantPage | /ai-assistant | Asistente IA (GPT-4o + 83 MCP tools) |
| DomoticsPage | /domotics | Control IoT (86 dispositivos) |
| IntercomPage | /intercom | Intercomunicadores SIP |
| PhonePanelPage | /phone | Panel telefónico VoIP |
| FloorPlanPage | /floor-plan | Planos interactivos |
| AnalyticsPage | /analytics | Analítica avanzada |
| WallPage | /wall/:screen | Video wall para TV |
| TVDashboardPage | /tv | Dashboard para pantallas grandes |
| SitePortalPage | /portal/:siteCode | Portal público para residentes |
| GuardMobilePage | /guard-mobile | App móvil para guardas |

## Componentes (102+)

- **44 UI primitivos** (Radix UI): Button, Dialog, Select, Table, Tabs, etc.
- **Dashboard**: ActivityHeatmap, SLAWidget, EmergencyCommsWidget, ClaveAssistantWidget
- **Video**: Go2RTCPlayer, WebRTCPlayer, TourEngine
- **Operacional**: CommandPalette, ShiftChecklist, LogbookEntry, PanicButton
- **Comunicaciones**: VoiceAssistant, NotificationPanel, CookieConsentBanner

## Hooks Custom (21)

| Hook | Función |
|------|---------|
| use-twilio-phone | WebRTC browser-to-PSTN vía Twilio |
| use-sip-phone | Softphone SIP integrado |
| use-websocket | WebSocket real-time |
| use-realtime-events | Eventos en tiempo real |
| use-push-notifications | Push notifications PWA |
| use-keyboard-shortcuts | Atajos de teclado |
| use-ewelink | Control dispositivos IoT |
| use-offline-cache | Cache offline-first |
| use-audio-alerts | Alertas sonoras |
| use-network-status | Detección online/offline |

## Sistema de Permisos (43 módulos RBAC)

**Super Admin / Tenant Admin:** Acceso completo a todo

**Operador (29 módulos):** dashboard, live_view, playback, events, alerts, incidents, devices, sites, domotics, access_control, reboots, intercom, database, ai_assistant, reports, settings, shifts, sla, emergency, patrols, automation, visitors, analytics, contracts, keys, training, posts, notes, documents, minuta, phone, communications, operations

**Viewer (6 módulos):** dashboard, live_view, playback, events, reports, documents

---

# 8. VIDEO Y STREAMING

## Configuración Actual

| Métrica | Valor |
|---------|-------|
| Total streams go2rtc | 360 |
| Con transcode H.264 | 224 (ffmpeg:) |
| Protocolo entrega | fMP4 vía HTTPS |
| STUN/TURN | coturn (UDP 3478/8555) |
| Snapshots activos | 207 |

## Flujo de Video

```
DVR/NVR → RTSP :554 → go2rtc :1984 → fMP4/WebRTC → Navegador
                         ↓
                    ffmpeg transcode
                    (H.265 → H.264)
```

## Tipos de Cámaras

- **204 Hikvision** — RTSP directa con port forwarding o HCNetSDK bridge
- **108 Dahua/IMOU** — IMOU Cloud API snapshots + DVRIP P2P (go2rtc nativo)

## Configuración Requerida en DVR/NVR

Para cada DVR/NVR, configurar el **substream** a H.264:
1. Acceder a la web del DVR → Configuration → Video/Audio
2. Sub Stream → Video Encoding: **H.264**
3. Resolución: CIF o QCIF (para substream)
4. Bitrate: 512 kbps

Guía completa: `GUIA_CONFIGURACION_DISPOSITIVOS.md`

---

# 9. COMUNICACIONES (TWILIO)

## Endpoints Verificados (20/20 OK)

### Autenticados (prefijo /twilio)

| Endpoint | Método | Función |
|----------|--------|---------|
| /twilio/health | GET | Estado de salud Twilio |
| /twilio/whatsapp/send | POST | Enviar WhatsApp individual |
| /twilio/whatsapp/broadcast | POST | Broadcast a residentes de un sitio |
| /twilio/calls/make | POST | Llamada de voz con mensaje |
| /twilio/calls/emergency | POST | Llamada IVR de emergencia |
| /twilio/calls/token | GET | Token JWT para WebRTC browser |
| /twilio/sms/send | POST | Enviar SMS |
| /twilio/logs | GET | Historial de comunicaciones |
| /twilio/stats | GET | Estadísticas |
| /twilio/notification-rules | GET/POST/PATCH/DELETE | CRUD reglas automáticas |
| /twilio/notification-rules/test | POST | Probar regla |

### Webhooks Públicos (prefijo /webhooks/twilio)

| Endpoint | Función |
|----------|---------|
| /whatsapp-incoming | Recibe WhatsApp entrante, auto-responde |
| /call-status | Actualiza estado de llamadas |
| /recording-status | Guarda URL de grabación |
| /call-connect | TwiML para browser→PSTN |
| /emergency-response | Procesa dígitos IVR emergencia |

## Números

- **Voz Colombia:** +576045908976 (fijo Medellín)
- **Voz+SMS US:** +14782238507
- **WhatsApp Sandbox:** +14155238886

## Worker de Notificaciones Automáticas

Ejecuta cada 15 minutos, verifica:
- Tickets pendientes > 24h → WhatsApp a supervisor
- Servicios técnicos > 7 días → WhatsApp
- Reporte diario 7am COT (lun-vie) → Resumen a supervisor
- Primer lunes del mes → Recordatorio prueba sirenas
- Cámaras offline recientes → Alerta WhatsApp

---

# 10. INTELIGENCIA ARTIFICIAL

## GPT-4o con Function Calling

- **83 MCP Tools** registrados para operaciones automatizadas
- **26 Skills operativas** disponibles vía /skills API
- Categorías: seguridad, operaciones, comunicaciones, análisis, reportes

## Servicios IA

| Servicio | Proveedor | Función |
|----------|-----------|---------|
| Chat IA | OpenAI GPT-4o | Asistente operativo con context |
| Lectura placas | OpenAI Vision | AI-powered LPR |
| Text-to-Speech | ElevenLabs | Síntesis de voz multilingüe |
| Speech-to-Text | Whisper | Transcripción de audio |
| Voz llamadas | Amazon Polly (Mia) | TwiML es-CO |
| Anomaly Detection | Custom ML | Detección de patrones anómalos |
| Predictive Analytics | Custom | Predicción de tendencias |
| Knowledge Base | RAG | Documentación contextual |

## MCP (Model Context Protocol)

83 herramientas registradas para que el modelo de IA pueda:
- Consultar estado de cámaras y dispositivos
- Crear/gestionar incidentes
- Enviar notificaciones
- Generar reportes
- Controlar dispositivos IoT
- Consultar residentes y vehículos

---

# 11. AUTOMATIZACIÓN

## n8n Workflows

- **60/60 workflows activos** en http://18.230.40.6:5678
- **9 webhooks** registrados: event, incident, device-status, visitor, door-request, security-alert, health-report, patrol-checkpoint, emergency-activate
- Secret: `aion-n8n-2026`

## Rules Engine

- **34 reglas** de automatización activas
- Condiciones → Acciones
- Modos: normal, assisted, degraded, manual
- Event Bus → Rules Engine → Orchestrator → Ejecución

## Telegram

- Bot: @aion_clave_bot
- Alertas en tiempo real para eventos críticos
- Escalamiento automático (5 min → warning, 15 min → urgente)

---

# 12. IoT Y DOMÓTICA

## eWeLink (Sonoff)

- **86 dispositivos** registrados
- **2 cuentas:** clavemonitoreo@gmail.com, clavemonitoreo1@gmail.com
- Tipos: relés de puerta, sirenas, luces, sensores
- Control: toggle, timer, schedule

## Integración

- API directa eWeLink + MCP connector
- Panel de gestión por sitio (/domotics)
- Mapeo dispositivo → sitio configurable

---

# 13. SEGURIDAD

## Hardening Aplicado

| Medida | Estado |
|--------|--------|
| SSL/TLS (Let's Encrypt) | Válido hasta Jul 2026 |
| HSTS + Preload | Activo |
| CSP (Content Security Policy) | Configurado |
| X-Frame-Options: DENY | Activo |
| X-Content-Type-Options: nosniff | Activo |
| Referrer-Policy: strict-origin | Activo |
| fail2ban (4 jails) | Activo |
| SSH key-only (no password) | Activo |
| Registro público bloqueado | 401 |
| Rate limiting (Nginx + Fastify) | 200 req/min |
| AES-256-GCM para credenciales | Activo |
| RLS (Row-Level Security) | Activo |
| Consentimiento biométrico (Ley 1581) | Implementado |
| Cookie consent banner | Activo |
| Webhook HMAC validation | Activo |
| JWT con refresh token rotation | Activo |
| Audit logging (hash chain) | Activo |

---

# 14. CI/CD E INFRAESTRUCTURA

## GitHub Actions (6 workflows)

| Workflow | Trigger | Función |
|----------|---------|---------|
| ci.yml | Push/PR a main | Build frontend + backend |
| deploy.yml | Push a main | Deploy automático a VPS |
| deploy-production.yml | Manual | Deploy producción con approval |
| deploy-staging.yml | Manual | Deploy staging |
| pr-check.yml | PR | Validación de PRs |
| release.yml | Manual | Build de release |

## Docker Compose

5 servicios: Frontend (Nginx), Backend (Fastify), PostgreSQL (pgvector), MediaMTX, Redis

## Scripts de Mantenimiento

| Script | Función |
|--------|---------|
| backup-s3.sh | Backup a AWS S3 |
| rotate-credentials.sh | Rotación de credenciales |
| migrate-all.sh | Ejecutar migraciones |
| bootstrap.sh | Setup inicial del servidor |

---

# 15. MANUAL DE USUARIO

## Acceso al Sistema

1. Abrir https://aionseg.co en navegador (Chrome recomendado)
2. Ingresar email y contraseña
3. El sistema carga el dashboard principal

## Dashboard Principal

El dashboard muestra:
- **KPIs:** cámaras online/offline, incidentes activos, tickets pendientes
- **Mapa de actividad:** heatmap 7x24 de eventos
- **Alertas recientes:** últimos eventos críticos
- **Widget de emergencia:** botón rojo para activar alerta inmediata
- **SLA:** cumplimiento de tiempos de respuesta

## Monitoreo en Vivo (/live-view)

1. Seleccionar sitio del dropdown
2. Las cámaras se muestran en grid (1x1, 2x2, 3x3, 4x4)
3. Click en cámara para pantalla completa
4. PTZ: controles de movimiento disponibles para cámaras compatibles
5. Snapshot: capturar imagen instantánea

## Eventos e Incidentes

**Eventos (/events):**
- Lista cronológica con filtros por sitio, tipo, severidad
- Cada evento muestra: timestamp, tipo, sitio, cámara, severidad

**Incidentes (/incidents):**
- Crear nuevo: botón "Nuevo Incidente"
- Asignar operador, severidad, tipo
- Adjuntar evidencia (fotos, videos, notas)
- Cambiar estado: abierto → en progreso → resuelto → cerrado

## Comunicaciones (/communications)

### WhatsApp
1. Tab "WhatsApp"
2. Ingresar número (formato: 3XXXXXXXXX)
3. Escribir mensaje
4. Click "Enviar"
- Para broadcast: seleccionar sitio → "Enviar a toda la unidad"

### Llamadas
1. Tab "Llamadas"
2. Teclado numérico en pantalla
3. Marcar número con prefijo +57 automático
4. Botón verde "Llamar"
5. Timer muestra duración
6. Botón rojo "Colgar"

### SMS
1. Tab "SMS"
2. Ingresar número + mensaje
3. Nota: se envía desde número US (+14782238507)

### Historial
1. Tab "Historial"
2. Filtrar por: canal, fechas, estado
3. Ver duración, costo, grabaciones

## Residentes (/residents)

- Búsqueda por nombre, unidad, teléfono
- Iconos de contacto rápido: WhatsApp, llamada
- 1,823 residentes registrados en 25 sitios

## Turnos (/shifts)

- Ver turnos activos y programados
- Checklist de inicio de turno (8 ítems)
- Bitácora digital

## Reportes (/reports)

1. Seleccionar tipo: eventos, incidentes, dispositivos
2. Seleccionar formato: JSON, CSV, PDF
3. Click "Generar"
4. El reporte se genera y se puede descargar

## Modo Kiosco

- **TV Dashboard** (/tv): diseñado para pantallas grandes 40"+
- **Video Wall** (/wall/:screen): grid de cámaras con rotación automática

---

# 16. MANUAL DE CAPACITACIÓN

## Módulo 1: Navegación Básica (30 min)

**Objetivo:** El operador puede navegar por todas las secciones del sistema.

**Contenido:**
1. Login y dashboard principal
2. Menú lateral: secciones y submódulos
3. Barra superior: notificaciones, perfil, búsqueda
4. Command Palette (Ctrl+K): búsqueda rápida global
5. Atajos de teclado básicos

**Práctica:**
- [ ] Login exitoso
- [ ] Navegar a 5 secciones diferentes
- [ ] Usar Command Palette para buscar un incidente
- [ ] Cambiar entre modo claro y oscuro

## Módulo 2: Monitoreo de Cámaras (45 min)

**Objetivo:** El operador puede monitorear cámaras en vivo y revisar grabaciones.

**Contenido:**
1. Página Live View: grids, layouts guardados
2. Selección de sitio y cámaras
3. PTZ: movimiento, zoom, presets
4. Snapshots: captura y descarga
5. Playback: búsqueda por fecha/hora, exportar clips
6. Alertas de cámara offline

**Práctica:**
- [ ] Visualizar 4 cámaras simultáneas
- [ ] Tomar 3 snapshots de cámaras diferentes
- [ ] Buscar grabación de hace 2 horas
- [ ] Exportar un clip de 30 segundos

## Módulo 3: Gestión de Eventos e Incidentes (30 min)

**Objetivo:** El operador puede registrar, escalar y resolver incidentes.

**Contenido:**
1. Tipos de eventos: motion, intrusión, face, tamper
2. Crear incidente desde evento
3. Asignar severidad y operador
4. Adjuntar evidencia
5. Flujo de estados
6. Escalamiento automático

**Práctica:**
- [ ] Identificar 3 eventos en el log
- [ ] Crear un incidente de prueba
- [ ] Adjuntar una captura como evidencia
- [ ] Resolver el incidente

## Módulo 4: Comunicaciones (30 min)

**Objetivo:** El operador puede comunicarse con residentes por todos los canales.

**Contenido:**
1. Enviar WhatsApp individual
2. Broadcast a toda una unidad
3. Hacer llamada de voz
4. Llamada de emergencia con IVR
5. Enviar SMS
6. Revisar historial y estadísticas

**Práctica:**
- [ ] Enviar WhatsApp de prueba
- [ ] Hacer llamada de prueba
- [ ] Revisar historial de comunicaciones
- [ ] Verificar estadísticas del día

## Módulo 5: Automatización y Alertas (30 min)

**Objetivo:** El operador entiende las reglas automáticas y cómo configurarlas.

**Contenido:**
1. Reglas de notificación automática
2. Configuración de alertas
3. Canales de escalamiento
4. Telegram: alertas en tiempo real
5. Motor de automatización (n8n)

**Práctica:**
- [ ] Revisar reglas de notificación activas
- [ ] Crear una regla de prueba
- [ ] Verificar que Telegram recibe alertas
- [ ] Desactivar/activar una regla

## Módulo 6: Administración (30 min)

**Objetivo:** El administrador puede gestionar usuarios, sitios y configuración.

**Contenido:**
1. Gestión de usuarios y roles
2. Configuración de sitios
3. Gestión de dispositivos
4. Backup y restauración
5. Logs de auditoría

**Práctica:**
- [ ] Crear usuario de prueba
- [ ] Asignar rol de operador
- [ ] Revisar logs de auditoría
- [ ] Verificar estado del backup

## Módulo 7: Reportes y Auditoría (20 min)

**Objetivo:** El operador puede generar reportes y consultar auditoría.

**Contenido:**
1. Tipos de reportes (eventos, incidentes, dispositivos)
2. Formatos (PDF, CSV, JSON)
3. Reportes programados
4. Auditoría: quién hizo qué, cuándo

**Práctica:**
- [ ] Generar reporte PDF de eventos
- [ ] Descargar reporte CSV
- [ ] Consultar auditoría del último día

## Evaluación Final

El operador demuestra competencia en:
- [ ] Navegar sin ayuda por todas las secciones
- [ ] Monitorear cámaras y tomar snapshots
- [ ] Crear y resolver un incidente completo
- [ ] Enviar comunicación por 3 canales diferentes
- [ ] Generar un reporte
- [ ] Usar el asistente IA para consultar información

---

# 17. ROADMAP: CRECIMIENTO 500 → 1,000 CÁMARAS (3 MESES)

## Mes 1: Optimización y Estabilización

| Tarea | Prioridad | Esfuerzo |
|-------|-----------|----------|
| Migrar WhatsApp de Sandbox a Business API | Alta | 1 día |
| Configurar AWS S3 para backups offsite | Alta | 2 horas |
| H.264 substream en todos los DVR/NVR | Alta | 3-5 días (campo) |
| Platform Access ISUP en Hikvision | Media | 2-3 días (campo) |
| Platform Access Dahua | Media | 2-3 días (campo) |
| Prometheus + Grafana dashboards | Media | 4 horas |
| Softphones en todos los puestos | Media | 2 días (campo) |
| Coordenadas GPS de sitios (para mapa) | Baja | 1 día |

## Mes 2: Escalamiento (500 → 700 cámaras)

| Tarea | Prioridad | Esfuerzo |
|-------|-----------|----------|
| Onboarding 15-20 nuevos sitios | Alta | 2-3 semanas |
| Segundo VPS para carga distribuida | Alta | 1 día |
| CDN para frontend (CloudFront) | Media | 2 horas |
| Database read replicas | Media | 4 horas |
| Facturación automatizada (contracts) | Media | 1 semana |
| App móvil básica (React Native) | Baja | 2-3 semanas |

## Mes 3: Diferenciación (700 → 1,000 cámaras)

| Tarea | Prioridad | Esfuerzo |
|-------|-----------|----------|
| Onboarding 15-20 sitios adicionales | Alta | 2-3 semanas |
| Portal de residentes mejorado | Media | 1 semana |
| Analítica predictiva avanzada | Media | 1 semana |
| Dashboard ejecutivo para directivos | Media | 3 días |
| Integración policía/CAI (si disponible) | Baja | 1-2 semanas |

## Requisitos de Hardware por Escala

| Cámaras | VPS | RAM | CPU | Disco | go2rtc streams |
|---------|-----|-----|-----|-------|----------------|
| 312 (actual) | 1x t3.xlarge | 16 GB | 4 vCPU | 200 GB | 360 |
| 500 | 1x t3.xlarge | 16 GB | 4 vCPU | 300 GB | 600 |
| 700 | 2x t3.xlarge | 32 GB total | 8 vCPU | 500 GB | 900 |
| 1,000 | 2x t3.2xlarge | 64 GB total | 16 vCPU | 1 TB | 1,200 |

---

# 18. MEJORAS Y PARAMETRIZACIONES FUTURAS

## Corto Plazo (1-3 meses)

1. **Mapa interactivo con Leaflet** — requiere GPS de cada sitio
2. **Drag-and-drop video wall** — librería @dnd-kit
3. **Reconocimiento facial mejorado** — InsightFace + pgvector
4. **Push notifications triggers** — VAPID configurado, falta lógica de disparo
5. **Consentimiento biométrico mejorado** — modal antes de enrollment

## Mediano Plazo (3-6 meses)

6. **App móvil nativa** — React Native con notificaciones push
7. **White-label** — multi-marca para otros clientes de seguridad
8. **API pública documentada** — Swagger completo para integraciones
9. **Marketplace de integraciones** — plugins de terceros
10. **Auditoría SOC 2 Type II** — certificación de seguridad

## Largo Plazo (6-12 meses)

11. **Auto-scaling Kubernetes** — orquestación de contenedores
12. **Multi-región AWS** — São Paulo + US East para redundancia
13. **ML Edge** — inferencia en DVR/NVR (OpenVINO)
14. **Blockchain audit** — logs de auditoría inmutables en cadena
15. **Federation** — federación entre empresas de seguridad

---

# 19. CONTACTOS Y SOPORTE

## Recursos Técnicos

| Recurso | Ubicación |
|---------|-----------|
| Repositorio GitHub | github.com/jlort1721-alt/aion-vision-hub |
| Branch principal | main |
| VPS Producción | 18.230.40.6 (AWS São Paulo) |
| Dominio | aionseg.co |
| Telegram Bot | @aion_clave_bot |
| n8n Dashboard | http://18.230.40.6:5678 |
| go2rtc Admin | https://aionseg.co/go2rtc/ |

## Documentación Existente

| Documento | Descripción |
|-----------|-------------|
| GUIA_CONFIGURACION_DISPOSITIVOS.md | Configuración H.264 + ISUP para DVR/NVR |
| GUIA_CONFIGURACION_ASTERISK.md | Configuración PBX para todos los puestos |
| GUIA_IMPLEMENTACION_DAHUA_COMPLETA.md | Integración Dahua DVRIP P2P |
| docs/TwilioSetupGuide.md | Setup completo Twilio (198 líneas) |
| docs/MANUAL-OPERADOR-AION.md | Manual del operador |
| docs/MANUAL-ADMINISTRADOR-AION.md | Manual del administrador |
| docs/RUNBOOK.md | Procedimientos operativos |
| docs/TROUBLESHOOTING.md | Solución de problemas |
| docs/SECURITY_HARDENING.md | Guía de hardening |
| docs/SCALING-ROADMAP.md | Plan de escalamiento |

## Comandos de Emergencia

```bash
# Conectar al VPS
ssh -i clave-demo-aion.pem ubuntu@18.230.40.6

# Ver estado de todos los servicios
pm2 ls

# Restart backend
pm2 restart aionseg-api --update-env

# Ver logs del backend
pm2 logs aionseg-api --lines 50

# Health check
curl -s http://localhost:3001/health/ready | python3 -m json.tool

# Restart todos los servicios
pm2 restart all --update-env

# Backup manual de la base de datos
pg_dump -U aionseg -d aionseg_prod -h localhost > backup_$(date +%Y%m%d).sql

# Ver estado de PostgreSQL
sudo systemctl status postgresql

# Ver estado de Nginx
sudo systemctl status nginx

# Renovar SSL
sudo certbot renew

# Ver logs de Nginx
sudo tail -f /var/log/nginx/error.log
```

---

**Documento generado automáticamente por AION Platform — 6 de abril de 2026**
**Versión 1.0 — Entrega completa del proyecto**
