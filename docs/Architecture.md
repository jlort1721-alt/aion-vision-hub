# Clave Seguridad — Arquitectura del Sistema

> Documento de referencia definitivo de arquitectura.
> Ultima actualizacion: 2026-03-21

---

## Tabla de Contenidos

1. [Vision General del Sistema](#1-vision-general-del-sistema)
2. [Stack Tecnologico](#2-stack-tecnologico)
3. [Registro de Modulos Backend (API)](#3-registro-de-modulos-backend-api)
4. [Registro de Paginas Frontend](#4-registro-de-paginas-frontend)
5. [Mapa de Integraciones Externas](#5-mapa-de-integraciones-externas)
6. [Diagramas de Flujo de Datos](#6-diagramas-de-flujo-de-datos)
7. [Arquitectura de Seguridad](#7-arquitectura-de-seguridad)
8. [Arquitectura de Despliegue](#8-arquitectura-de-despliegue)

---

## 1. Vision General del Sistema

Clave Seguridad es una plataforma empresarial de gestion de videovigilancia (VMS), IoT y operaciones de seguridad fisica. Opera bajo un modelo multi-tenant con control de acceso basado en roles (RBAC), integrando camaras IP, dispositivos domoticos, intercomunicadores, alertas inteligentes y comunicaciones unificadas.

### 1.1 Diagrama de Componentes

```
                            +-----------------------+
                            |    NAVEGADOR / PWA    |
                            |  React 18 + Vite SPA  |
                            +----------+------------+
                                       |
                                       | HTTPS / WSS
                                       |
                            +----------v------------+
                            |       NGINX           |
                            |  Proxy inverso :8080  |
                            |  SPA + API + WS       |
                            +----+------+-----------+
                                 |      |
                  +--------------+      +---------------+
                  |  /api/*                             |  /ws
                  v                                     v
    +-------------+----------------+    +---------------+----------+
    |     FASTIFY BACKEND :3000    |    |   WebSocket Plugin       |
    |  JWT + RBAC + Multi-tenant   |    |   Eventos en tiempo real |
    +---+-----+------+-----+------+    +----+----------------------+
        |     |      |     |                |
        v     v      v     v                |
   +----++ +--+--+ +-+-+ +-+------+         |
   | PG | | Sub  | |MTX| |APIs   |         |
   |vec | | base | |   | |Extern.|         |
   +----+ +------+ +---+ +-------+         |
                                            |
  +-----+  +-----------+   +--------+   +---+--------+
  |EZVIZ|  |   IMOU    |   |eWeLink |   | ElevenLabs |
  |Cloud|  | Hik-Conn. |   | Sonoff |   |    TTS     |
  +-----+  +-----------+   +--------+   +------------+
```

### 1.2 Diagrama de Flujo de Datos Global

```
  Dispositivos IoT           Plataformas Cloud           Servicios Externos
  (Camaras, Sensores,        (EZVIZ, IMOU,               (WhatsApp, Email,
   Intercoms, Sonoff)         Hik-Connect)                ElevenLabs, Push)
        |                         |                            |
        | RTSP/ONVIF              | REST API                  | REST API
        v                         v                            v
  +-----------+           +---------------+           +----------------+
  | MediaMTX  |           |  Cloud Bridge |           |  Notificacion  |
  | Gateway   |           |  /cloud       |           |  Engine        |
  | :8554/89  |           |  /cloud-accts |           |  /whatsapp     |
  +-----+-----+           +-------+-------+           |  /email        |
        |                         |                    |  /voice        |
        | HLS/WebRTC              |                    |  /push         |
        v                         v                    +-------+--------+
  +-----+-------------------------+----------------------------+---------+
  |                      FASTIFY API CORE :3000                          |
  |  auth -> tenant -> audit -> [modulo de negocio] -> respuesta         |
  +----+------------------------+------------------------+---------------+
       |                        |                        |
       v                        v                        v
  +----+-----+           +------+-------+         +------+-------+
  | PostgreSQL|          | Supabase Auth|         | Redis (opc.) |
  | + pgvector|          | Verificacion |         | Rate Limit   |
  | :5432     |          | de tokens    |         | Cache        |
  +----------+           +--------------+         +--------------+
```

---

## 2. Stack Tecnologico

### 2.1 Frontend

| Componente          | Tecnologia                    | Version    |
|---------------------|-------------------------------|------------|
| Framework           | React                         | 18.3       |
| Bundler             | Vite                          | 5.4        |
| Lenguaje            | TypeScript                    | 5.8        |
| Estilos             | TailwindCSS                   | 3.4        |
| Componentes UI      | shadcn/ui (Radix primitives)  | --         |
| Estado servidor     | TanStack React Query          | 5.x        |
| Enrutamiento        | React Router DOM              | 6.30       |
| Formularios         | React Hook Form + Zod         | 7.x / 3.x |
| Graficos            | Recharts                      | 2.15       |
| 3D                  | Three.js + React Three Fiber  | 0.183      |
| Mapas               | Leaflet + MarkerCluster       | 1.9        |
| Streaming video     | hls.js                        | 1.6        |
| Vision IA           | MediaPipe Tasks Vision        | 0.10       |
| PWA                 | vite-plugin-pwa               | 1.2        |
| Animaciones         | Framer Motion                 | 12.x       |

### 2.2 Backend

| Componente          | Tecnologia                    | Version    |
|---------------------|-------------------------------|------------|
| Runtime             | Node.js                       | >= 20      |
| Framework HTTP      | Fastify                       | 5.x        |
| Validacion          | Zod + fastify-type-provider   | 3.x        |
| ORM                 | Drizzle ORM                   | --         |
| Base de datos       | PostgreSQL + pgvector          | 16+        |
| Autenticacion       | Supabase Auth + JWT HS256     | --         |
| Monorepo            | pnpm + Turborepo              | 9.15       |
| Documentacion API   | Swagger/OpenAPI (auto)        | 3.x        |
| Rate limiting       | @fastify/rate-limit            | --         |
| Seguridad headers   | @fastify/helmet                | --         |
| WebSockets          | @fastify/websocket             | --         |
| Metricas            | Prometheus (prom-client)       | --         |

### 2.3 Infraestructura

| Componente          | Tecnologia                    | Proposito              |
|---------------------|-------------------------------|------------------------|
| Contenedores        | Docker + docker-compose       | Orquestacion           |
| Proxy inverso       | NGINX                         | TLS, SPA, API proxy    |
| Streaming           | MediaMTX (bluenviron)         | RTSP/HLS/WebRTC        |
| Auth externo        | Supabase                      | Identidad, tokens      |
| Vectores            | pgvector                      | Busqueda biometrica    |
| Observabilidad      | Prometheus + OpenTelemetry    | Metricas, trazas       |
| Cache (opcional)    | Redis                         | Rate limit, sesiones   |

---

## 3. Registro de Modulos Backend (API)

Todos los modulos se registran en `backend/apps/backend-api/src/app.ts` con su prefijo de ruta.

### 3.1 Modulos Core

| #  | Modulo             | Prefijo                | Proposito                                            |
|----|--------------------|------------------------|------------------------------------------------------|
| 1  | health             | `/health`              | Readiness, liveness, metricas Prometheus             |
| 2  | auth               | `/auth`                | Login, refresh token, logout, sesion                 |
| 3  | tenants            | `/tenants`             | CRUD de inquilinos (multi-tenant)                    |
| 4  | users              | `/users`               | Gestion de perfiles de usuario                       |
| 5  | roles              | `/roles`               | Asignacion y gestion de roles RBAC                   |
| 6  | devices            | `/devices`             | Registro, estado y configuracion de dispositivos     |
| 7  | sites              | `/sites`               | Sedes, ubicaciones fisicas                           |
| 8  | streams            | `/streams`             | Configuracion de flujos de video (RTSP/HLS/WebRTC)   |
| 9  | events             | `/events`              | Captura y consulta de eventos del sistema            |
| 10 | incidents          | `/incidents`           | Gestion de incidentes de seguridad                   |

### 3.2 Modulos de Integracion

| #  | Modulo             | Prefijo                | Proposito                                            |
|----|--------------------|------------------------|------------------------------------------------------|
| 11 | integrations       | `/integrations`        | Conectores de integracion generica                   |
| 12 | ai-bridge          | `/ai`                  | Puente con proveedores de IA (OpenAI, Anthropic)     |
| 13 | mcp-bridge         | `/mcp`                 | Model Context Protocol — conectores MCP              |
| 14 | cloud-accounts     | `/cloud-accounts`      | Cuentas cloud (EZVIZ, IMOU, Hik-Connect)             |
| 15 | cloud-platforms    | `/cloud`               | Operaciones directas sobre plataformas cloud          |
| 16 | ewelink            | `/ewelink`             | Integracion eWeLink/Sonoff (IoT domotica)            |
| 17 | whatsapp           | `/whatsapp`            | WhatsApp Business API — mensajes, plantillas         |
| 18 | webhooks/whatsapp  | `/webhooks/whatsapp`   | Webhook publico para Meta (sin JWT)                  |
| 19 | voice              | `/voice`               | VoIP, llamadas SIP, sesiones de voz                  |
| 20 | email              | `/email`               | Envio de correos (Resend/SendGrid/SMTP)              |
| 21 | push               | `/push`                | Notificaciones push (VAPID/Web Push)                 |
| 22 | extensions         | `/extensions`          | Extensiones de voz TTS (ElevenLabs)                  |

### 3.3 Modulos Operacionales

| #  | Modulo             | Prefijo                | Proposito                                            |
|----|--------------------|------------------------|------------------------------------------------------|
| 23 | domotics           | `/domotics`            | Dispositivos domoticos, acciones automatizadas       |
| 24 | access-control     | `/access-control`      | Control de acceso (personas, vehiculos, logs)        |
| 25 | intercom           | `/intercom`            | Intercomunicadores (Fanvil, Grandstream)             |
| 26 | reboots            | `/reboots`             | Reinicios remotos de dispositivos                    |
| 27 | database-records   | `/database-records`    | Registros genericos de base de datos                 |
| 28 | alerts             | `/alerts`              | Reglas de alerta, politicas de escalamiento          |
| 29 | shifts             | `/shifts`              | Turnos y asignaciones de personal                    |
| 30 | sla                | `/sla`                 | Definiciones y seguimiento de SLA                    |
| 31 | emergency          | `/emergency`           | Protocolos y activaciones de emergencia              |
| 32 | patrols            | `/patrols`             | Rutas, checkpoints y bitacoras de patrulla           |
| 33 | scheduled-reports  | `/scheduled-reports`   | Reportes programados automaticamente                 |
| 34 | automation         | `/automation`          | Reglas y ejecuciones de automatizacion               |
| 35 | visitors           | `/visitors`            | Registro de visitantes y pases                       |
| 36 | analytics          | `/analytics`           | KPIs, snapshots analiticos                           |
| 37 | biomarkers         | `/analytics/biomarkers`| Busqueda biogenetica (pgvector)                      |
| 38 | operations         | `/operations`          | Dashboard operativo consolidado                      |

### 3.4 Modulos Administrativos

| #  | Modulo             | Prefijo                | Proposito                                            |
|----|--------------------|------------------------|------------------------------------------------------|
| 39 | reports            | `/reports`             | Generacion y consulta de reportes                    |
| 40 | audit              | `/audit`               | Registros de auditoria del sistema                   |
| 41 | contracts          | `/contracts`           | Contratos y facturacion de clientes                  |
| 42 | keys               | `/keys`                | Inventario y bitacora de llaves                      |
| 43 | compliance         | `/compliance`          | Plantillas de cumplimiento, retencion de datos       |
| 44 | training           | `/training`            | Programas de capacitacion y certificaciones          |
| 45 | backup             | `/backup`              | Gestion de respaldos de base de datos                |

---

## 4. Registro de Paginas Frontend

Todas las paginas usan lazy loading (code splitting) y estan protegidas por `ProtectedRoute` + `ModuleGuard` con RBAC.

| #  | Ruta                      | Pagina                    | Modulo RBAC          | Descripcion                              |
|----|---------------------------|---------------------------|----------------------|------------------------------------------|
| 1  | `/login`                  | LoginPage                 | (publica)            | Inicio de sesion                         |
| 2  | `/reset-password`         | ResetPasswordPage         | (publica)            | Restablecimiento de contrasena           |
| 3  | `/dashboard`              | DashboardPage             | dashboard            | Panel principal con metricas             |
| 4  | `/live-view`              | LiveViewPage              | live_view            | Visualizacion en vivo (grid WebRTC/HLS)  |
| 5  | `/immersive`              | Immersive3DPage           | live_view            | Vista inmersiva 3D (Three.js)            |
| 6  | `/biogenetic-search`      | BiogeneticSearchPage      | analytics            | Busqueda biogenetica (pgvector)          |
| 7  | `/predictive-criminology` | PredictiveCriminologyPage | analytics            | Criminologia predictiva                  |
| 8  | `/playback`               | PlaybackPage              | playback             | Reproduccion de grabaciones              |
| 9  | `/events`                 | EventsPage                | events               | Listado y filtrado de eventos            |
| 10 | `/incidents`              | IncidentsPage             | incidents            | Gestion de incidentes                    |
| 11 | `/devices`                | DevicesPage               | devices              | Administracion de dispositivos           |
| 12 | `/sites`                  | SitesPage                 | sites                | Gestion de sedes                         |
| 13 | `/domotics`               | DomoticsPage              | domotics             | Control domotico                         |
| 14 | `/access-control`         | AccessControlPage         | access_control       | Control de acceso                        |
| 15 | `/reboots`                | RebootsPage               | reboots              | Reinicios remotos                        |
| 16 | `/intercom`               | IntercomPage              | intercom             | Intercomunicadores                       |
| 17 | `/database`               | DatabasePage              | database             | Registros de base de datos               |
| 18 | `/ai-assistant`           | AIAssistantPage           | ai_assistant         | Asistente IA conversacional              |
| 19 | `/integrations`           | IntegrationsPage          | integrations         | Panel de integraciones                   |
| 20 | `/reports`                | ReportsPage               | reports              | Reportes                                 |
| 21 | `/audit`                  | AuditPage                 | audit                | Logs de auditoria                        |
| 22 | `/system`                 | SystemHealthPage          | system               | Salud del sistema                        |
| 23 | `/settings`               | SettingsPage              | settings             | Configuracion de usuario                 |
| 24 | `/admin`                  | AdminPage                 | admin                | Administracion de plataforma             |
| 25 | `/whatsapp`               | WhatsAppPage              | integrations         | Consola WhatsApp Business                |
| 26 | `/alerts`                 | AlertsPage                | alerts               | Reglas y escalamientos de alerta         |
| 27 | `/shifts`                 | ShiftsPage                | shifts               | Turnos de personal                       |
| 28 | `/sla`                    | SLAPage                   | sla                  | Niveles de servicio                      |
| 29 | `/emergency`              | EmergencyPage             | emergency            | Protocolos de emergencia                 |
| 30 | `/patrols`                | PatrolsPage               | patrols              | Rondas de patrulla                       |
| 31 | `/scheduled-reports`      | ScheduledReportsPage      | scheduled_reports    | Reportes programados                     |
| 32 | `/automation`             | AutomationPage            | automation           | Reglas de automatizacion                 |
| 33 | `/visitors`               | VisitorsPage              | visitors             | Registro de visitantes                   |
| 34 | `/analytics`              | AnalyticsPage             | analytics            | Analitica y KPIs                         |
| 35 | `/contracts`              | ContractsPage             | contracts            | Contratos y facturacion                  |
| 36 | `/keys`                   | KeysPage                  | keys                 | Inventario de llaves                     |
| 37 | `/compliance`             | CompliancePage            | compliance           | Cumplimiento normativo                   |
| 38 | `/training`               | TrainingPage              | training             | Capacitacion                             |
| 39 | `/notes`                  | NotesPage                 | (sin guard)          | Notas internas                           |
| 40 | `*`                       | NotFound                  | --                   | Pagina 404                               |

---

## 5. Mapa de Integraciones Externas

### 5.1 Tabla de Integraciones

| Servicio         | Tipo            | Modulo Backend     | Protocolo      | Variables de Entorno Clave                    | Proposito                                   |
|------------------|-----------------|--------------------|----------------|-----------------------------------------------|----------------------------------------------|
| **EZVIZ**        | Cloud VMS       | cloud-accounts     | REST HTTPS     | (credenciales en BD, cifradas)                | Importar camaras EZVIZ, control PTZ          |
| **IMOU / DMSS**  | Cloud VMS       | cloud-accounts     | REST HTTPS     | (credenciales en BD, cifradas)                | Importar camaras Dahua/IMOU                  |
| **Hik-Connect**  | Cloud VMS       | cloud-accounts     | REST HTTPS     | (credenciales en BD, cifradas)                | Importar camaras Hikvision                   |
| **eWeLink**      | IoT Cloud       | ewelink            | REST HTTPS     | `EWELINK_APP_ID`, `EWELINK_APP_SECRET`, `EWELINK_REGION` | Control Sonoff (reles, sensores)   |
| **ElevenLabs**   | TTS IA          | extensions         | REST HTTPS     | `ELEVENLABS_API_KEY`, `ELEVENLABS_DEFAULT_VOICE_ID`, `ELEVENLABS_MODEL_ID` | Sintesis de voz para extensiones |
| **Supabase**     | Auth / BaaS     | auth               | REST HTTPS     | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`   | Autenticacion de usuarios, verificacion JWT  |
| **MediaMTX**     | Streaming       | streams            | RTSP/HLS/WebRTC| `MEDIAMTX_API_URL` (http://mediamtx:9997/v3)  | Gateway de video: RTSP a HLS/WebRTC          |
| **WhatsApp**     | Mensajeria      | whatsapp           | REST HTTPS     | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET` | Notificaciones, plantillas |
| **Email**        | Correo          | email              | REST / SMTP    | `RESEND_API_KEY` o `SENDGRID_API_KEY` o `SMTP_*` | Envio de correos transaccionales          |
| **SIP / VoIP**   | Telefonia       | voice, intercom    | SIP UDP/TCP    | `SIP_HOST`, `SIP_PORT`, `SIP_ARI_*`          | Llamadas VoIP, ARI Asterisk                  |
| **Fanvil**       | Intercom HW     | intercom           | HTTP           | `FANVIL_ADMIN_USER`, `FANVIL_ADMIN_PASSWORD`  | Control de intercomunicadores Fanvil         |
| **OpenAI**       | IA Generativa   | ai-bridge          | REST HTTPS     | `OPENAI_API_KEY`                              | Asistente IA, analisis                       |
| **Anthropic**    | IA Generativa   | ai-bridge          | REST HTTPS     | `ANTHROPIC_API_KEY`                           | Asistente IA alternativo                     |
| **VAPID/Push**   | Push Notif.     | push               | Web Push       | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`       | Notificaciones push a navegador/PWA          |
| **Prometheus**   | Observabilidad  | health             | HTTP Scrape    | `PROMETHEUS_ENABLED`                          | Metricas del servidor                        |
| **OpenTelemetry**| Trazabilidad    | (core)             | OTLP gRPC      | `OTEL_EXPORTER_OTLP_ENDPOINT`                | Trazas distribuidas                          |

### 5.2 Diagrama de Integraciones

```
                        +---------------------+
                        |   Clave Seguridad   |
                        |    Backend :3000     |
                        +--+--+--+--+--+--+---+
                           |  |  |  |  |  |
          +----------------+  |  |  |  |  +------------------+
          |                   |  |  |  |                     |
          v                   v  |  v  v                     v
   +-----------+     +--------+  |  +--------+      +-------------+
   | EZVIZ     |     | IMOU / |  |  |eWeLink |      | ElevenLabs  |
   | Cloud API |     | Hik-Co |  |  |  API   |      |  TTS API    |
   +-----------+     +--------+  |  +--------+      +-------------+
                                 |
            +--------------------+--------------------+
            |                    |                    |
            v                    v                    v
     +-----------+        +-----------+        +-----------+
     | Supabase  |        | MediaMTX  |        | WhatsApp  |
     |   Auth    |        | RTSP/HLS  |        | Business  |
     +-----------+        | WebRTC    |        |   API     |
                          +-----------+        +-----------+
```

---

## 6. Diagramas de Flujo de Datos

### 6.1 Registro de Dispositivo -> Configuracion de Stream -> Vista en Vivo

```
  Operador                    Backend API                MediaMTX              Navegador
     |                            |                         |                      |
     |  POST /devices             |                         |                      |
     |  {ip, modelo, sitio,       |                         |                      |
     |   credenciales}            |                         |                      |
     +--------------------------->|                         |                      |
     |                            |  Cifrar credenciales    |                      |
     |                            |  INSERT devices         |                      |
     |                            |  INSERT streams         |                      |
     |                            |  (url_template RTSP)    |                      |
     |                            +------------------------>|                      |
     |                            |  POST /v3/config/paths  |                      |
     |                            |  (registrar path RTSP)  |                      |
     |                            |<------------------------+                      |
     |  201 Created               |                         |                      |
     |<---------------------------+                         |                      |
     |                            |                         |                      |
     |  GET /live-view            |                         |                      |
     +--------------------------->|                         |                      |
     |  GET /streams?device=X     |                         |                      |
     +--------------------------->|                         |                      |
     |  {webrtc_url, hls_url}     |                         |                      |
     |<---------------------------+                         |                      |
     |                            |                         |                      |
     |                            |                    +----+-----+                |
     |                            |                    | Negociar |                |
     |                            |                    | WebRTC   |<---------------+
     |                            |                    | SDP/ICE  +--------------->|
     |                            |                    +----------+   Video RTP    |
     |                            |                         +--------------------->|
     |                            |                         |      (o HLS .m3u8)   |
```

### 6.2 Login Cloud -> Importacion de Dispositivos -> Control

```
  Admin                   Backend API             Plataforma Cloud       Base de Datos
    |                         |                    (EZVIZ/IMOU/Hik)           |
    |  POST /cloud-accounts   |                         |                    |
    |  {provider, email,      |                         |                    |
    |   password}             |                         |                    |
    +------------------------>|                         |                    |
    |                         |  Cifrar password con    |                    |
    |                         |  CREDENTIAL_ENCRYPT_KEY |                    |
    |                         +------------------------------------------------>|
    |                         |  INSERT cloud_accounts  |                    |
    |  201 Created            |                         |                    |
    |<------------------------+                         |                    |
    |                         |                         |                    |
    |  POST /cloud/sync       |                         |                    |
    +------------------------>|                         |                    |
    |                         |  GET /api/devices       |                    |
    |                         +------------------------>|                    |
    |                         |  [{serial, name, ...}]  |                    |
    |                         |<------------------------+                    |
    |                         |                         |                    |
    |                         |  UPSERT devices (batch) |                    |
    |                         +------------------------------------------------>|
    |  {imported: 15}         |                         |                    |
    |<------------------------+                         |                    |
    |                         |                         |                    |
    |  POST /cloud/ptz        |                         |                    |
    |  {device, action: pan}  |                         |                    |
    +------------------------>|                         |                    |
    |                         |  POST /api/ptz/control  |                    |
    |                         +------------------------>|                    |
    |                         |  200 OK                 |                    |
    |                         |<------------------------+                    |
    |  200 OK                 |                         |                    |
    |<------------------------+                         |                    |
```

### 6.3 Regla de Alerta -> Evento -> Escalamiento -> Notificacion

```
  Sensor/Camara         Backend API          Motor de Alertas       Canales de Notif.
       |                    |                      |                       |
       |  POST /events      |                      |                       |
       |  {tipo, datos,     |                      |                       |
       |   dispositivo}     |                      |                       |
       +------------------>|                       |                       |
       |                    |  INSERT events       |                       |
       |                    |                      |                       |
       |                    |  Evaluar reglas:     |                       |
       |                    |  SELECT alert_rules  |                       |
       |                    |  WHERE condicion     |                       |
       |                    |  MATCHES evento      |                       |
       |                    +--------------------->|                       |
       |                    |                      |                       |
       |                    |  MATCH encontrado:   |                       |
       |                    |  INSERT alert_inst.  |                       |
       |                    |  severity: critical  |                       |
       |                    |<---------------------+                       |
       |                    |                      |                       |
       |                    |  Cargar escalation_  |                       |
       |                    |  policy (nivel 1)    |                       |
       |                    |                      |                       |
       |                    |  Nivel 1: WhatsApp   |                       |
       |                    +--------------------------------------------->|
       |                    |                POST /whatsapp/send            |
       |                    |                      |                       |
       |                    |  Nivel 1: Push       |                       |
       |                    +--------------------------------------------->|
       |                    |                POST /push/send                |
       |                    |                      |                       |
       |                    |  Si no ACK en T min: |                       |
       |                    |  Nivel 2: Email +    |                       |
       |                    |  llamada VoIP        |                       |
       |                    +--------------------------------------------->|
       |                    |           POST /email/send                    |
       |                    |           POST /voice/call                    |
       |                    |                      |                       |
       |                    |  INSERT notification_ |                       |
       |                    |  log (cada envio)    |                       |
       |                    |                      |                       |
       |                    |  WebSocket: alerta   |                       |
       |                    |  en tiempo real      |                       |
       |                    +----->  /ws  -------->  Navegador             |
```

### 6.4 Creacion de Extension -> Sintesis TTS -> Reproduccion Intercom

```
  Admin                  Backend API           ElevenLabs API        Intercom (Fanvil)
    |                        |                       |                      |
    |  POST /extensions      |                       |                      |
    |  {nombre, texto,       |                       |                      |
    |   voz, tipo:           |                       |                      |
    |   "greeting"}          |                       |                      |
    +----------------------->|                       |                      |
    |                        |                       |                      |
    |                        |  POST /v1/text-to-    |                      |
    |                        |  speech/{voice_id}    |                      |
    |                        |  Body: {text, model:  |                      |
    |                        |  eleven_multilingual  |                      |
    |                        |  _v2}                 |                      |
    |                        +---------------------->|                      |
    |                        |  audio/mpeg (buffer)  |                      |
    |                        |<----------------------+                      |
    |                        |                       |                      |
    |                        |  Almacenar audio      |                      |
    |                        |  (storage / BD)       |                      |
    |                        |  INSERT extensions    |                      |
    |  201 {id, audio_url}   |                       |                      |
    |<-----------------------+                       |                      |
    |                        |                       |                      |
    |  POST /intercom/play   |                       |                      |
    |  {extension_id,        |                       |                      |
    |   device_id}           |                       |                      |
    +----------------------->|                       |                      |
    |                        |  GET audio buffer     |                      |
    |                        |  de extension         |                      |
    |                        |                       |                      |
    |                        |  HTTP POST al Fanvil  |                      |
    |                        |  /cgi-bin/audio       |                      |
    |                        |  (o SIP INVITE con    |                      |
    |                        |   RTP audio)          |                      |
    |                        +------------------------------------->|       |
    |                        |                       |              | Play  |
    |                        |  200 OK               |              | Audio |
    |                        |<-------------------------------------+       |
    |  200 {status: played}  |                       |                      |
    |<-----------------------+                       |                      |
```

---

## 7. Arquitectura de Seguridad

### 7.1 Flujo de Autenticacion

```
  Usuario              Frontend (React)         Supabase Auth          Backend API
     |                      |                        |                      |
     |  email + password    |                        |                      |
     +--------------------->|                        |                      |
     |                      |  signInWithPassword()  |                      |
     |                      +----------------------->|                      |
     |                      |  {access_token, user}  |                      |
     |                      |<-----------------------+                      |
     |                      |                        |                      |
     |                      |  POST /auth/login      |                      |
     |                      |  Authorization: Bearer |                      |
     |                      |  <supabase_token>      |                      |
     |                      +----------------------------------------------->|
     |                      |                        |                      |
     |                      |                        |   verifySupabaseToken |
     |                      |                        |<---------------------+
     |                      |                        |   {id, email}        |
     |                      |                        +--------------------->|
     |                      |                        |                      |
     |                      |                        |   Buscar profile +   |
     |                      |                        |   role en PostgreSQL |
     |                      |                        |                      |
     |                      |                        |   Generar JWT local  |
     |                      |                        |   (HS256, tenant_id, |
     |                      |                        |    role, sub, email) |
     |                      |                        |                      |
     |                      |  {token, refreshToken, |                      |
     |                      |   user, expiresAt}     |                      |
     |                      |<-----------------------------------------------+
     |  Dashboard           |                        |                      |
     |<---------------------+                        |                      |
     |                      |                        |                      |
     |  (Subsecuentes)      |  Authorization: Bearer <jwt_local>           |
     |                      +----------------------------------------------->|
     |                      |                        |   jwtVerify() local  |
     |                      |                        |   (no llama Supabase)|
```

### 7.2 Modelo de Seguridad por Capas

```
  +================================================================+
  |  CAPA 1: TRANSPORTE                                            |
  |  - HTTPS/TLS obligatorio en produccion                        |
  |  - HSTS con max-age=31536000                                  |
  |  - Content-Security-Policy estricto                           |
  +================================================================+
  |  CAPA 2: PERIMETRO                                             |
  |  - NGINX proxy inverso con rate limiting                      |
  |  - CORS restringido a origenes configurados                   |
  |  - Helmet: X-Frame-Options, X-Content-Type-Options, etc.     |
  +================================================================+
  |  CAPA 3: AUTENTICACION                                         |
  |  - JWT HS256 con algoritmo explicito (anti alg:none)          |
  |  - Supabase como IdP primario                                 |
  |  - Refresh tokens con rotacion en BD                          |
  |  - Expiracion configurable (default 24h)                      |
  +================================================================+
  |  CAPA 4: AUTORIZACION (RBAC)                                   |
  |  - Roles: super_admin, admin, supervisor, operator, viewer    |
  |  - requireRole() middleware por ruta                           |
  |  - ModuleGuard en frontend por pagina                         |
  |  - role_module_permissions por tenant                          |
  +================================================================+
  |  CAPA 5: AISLAMIENTO MULTI-TENANT                              |
  |  - tenant_id inyectado automaticamente en cada request        |
  |  - Plugin tenant valida existencia del tenant                 |
  |  - Todas las queries filtradas por tenant_id                  |
  |  - Foreign keys con ON DELETE CASCADE                         |
  +================================================================+
  |  CAPA 6: AUDITORIA                                             |
  |  - Plugin audit registra todas las mutaciones                 |
  |  - audit_logs: usuario, accion, entidad, antes/despues, IP   |
  |  - Logs inmutables con timestamp                              |
  +================================================================+
  |  CAPA 7: CIFRADO DE DATOS                                      |
  |  - Credenciales cloud cifradas con CREDENTIAL_ENCRYPTION_KEY  |
  |  - Minimo 32 caracteres, obligatorio en produccion            |
  |  - Passwords nunca almacenadas en texto plano                 |
  +================================================================+
  |  CAPA 8: RATE LIMITING                                         |
  |  - @fastify/rate-limit global                                 |
  |  - Default: 100 req/min por IP                                |
  |  - Configurable: RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS         |
  +================================================================+
  |  CAPA 9: VALIDACION DE ENTRADA                                 |
  |  - Zod schemas en cada endpoint                               |
  |  - fastify-type-provider-zod para validacion automatica       |
  |  - Sanitizacion de inputs contra inyeccion                    |
  +================================================================+
```

### 7.3 Rutas Publicas (sin JWT)

Las siguientes rutas no requieren autenticacion:

| Ruta                    | Motivo                                          |
|-------------------------|-------------------------------------------------|
| `/health`               | Healthcheck para orquestadores                  |
| `/health/ready`         | Readiness probe                                 |
| `/health/metrics`       | Scraping Prometheus                              |
| `/auth/login`           | Endpoint de login (emite JWT)                    |
| `/webhooks/whatsapp`    | Webhook de Meta (verificado por HMAC)            |
| `/ws`                   | WebSocket (JWT via query param)                  |
| `/push/vapid-public-key`| Clave publica VAPID para suscripcion push        |

---

## 8. Arquitectura de Despliegue

### 8.1 Servicios Docker

El sistema se despliega mediante `docker-compose.yml` con 4 servicios:

```
  docker-compose.yml
  ==================

  +-----------------------------------------------------------+
  |                     clave_net (bridge)                     |
  |                                                           |
  |  +------------------+    +----------------------------+   |
  |  | clave-frontend   |    | clave-backend              |   |
  |  | Dockerfile.front |    | backend/Dockerfile         |   |
  |  | NGINX + React    |    | Fastify + Node 20          |   |
  |  | Puerto: 8080:80  |    | Puerto: 3000:3000          |   |
  |  | depends: backend |    | depends: postgres (healthy)|   |
  |  +------------------+    +----------------------------+   |
  |                                                           |
  |  +------------------+    +----------------------------+   |
  |  | clave-postgres   |    | clave-mediamtx             |   |
  |  | ankane/pgvector  |    | bluenviron/mediamtx        |   |
  |  | Puerto: 5432     |    | :latest-ffmpeg             |   |
  |  | Vol: clave_pgdata|    | Puertos:                   |   |
  |  | Healthcheck:     |    |   8554 (RTSP)              |   |
  |  |   pg_isready     |    |   8888 (HLS)               |   |
  |  +------------------+    |   8889 (WebRTC)            |   |
  |                          +----------------------------+   |
  +-----------------------------------------------------------+
```

### 8.2 Puertos del Sistema

| Puerto | Servicio         | Protocolo    | Descripcion                         |
|--------|------------------|--------------|-------------------------------------|
| 8080   | clave-frontend   | HTTP/HTTPS   | Aplicacion web (NGINX)              |
| 3000   | clave-backend    | HTTP         | API REST Fastify                    |
| 5432   | clave-postgres   | TCP          | PostgreSQL + pgvector               |
| 8554   | clave-mediamtx   | RTSP         | Ingesta/retransmision RTSP          |
| 8888   | clave-mediamtx   | HTTP         | Streaming HLS (.m3u8)              |
| 8889   | clave-mediamtx   | HTTP/UDP     | Streaming WebRTC (SDP + ICE)       |

### 8.3 Volumenes Persistentes

| Volumen        | Servicio       | Mount Point                     | Proposito                    |
|----------------|----------------|---------------------------------|------------------------------|
| clave_pgdata   | clave-postgres | /var/lib/postgresql/data        | Datos PostgreSQL persistentes|

### 8.4 Variables de Entorno Criticas

| Variable                    | Servicio  | Obligatoria | Descripcion                                |
|-----------------------------|-----------|-------------|--------------------------------------------|
| `DATABASE_URL`              | backend   | Si          | Conexion PostgreSQL                        |
| `JWT_SECRET`                | backend   | Si (32+)    | Clave de firma JWT HS256                   |
| `CORS_ORIGINS`              | backend   | Si          | Origenes permitidos (CSV)                  |
| `CREDENTIAL_ENCRYPTION_KEY` | backend   | Si (prod)   | Cifrado de credenciales cloud (32+ chars)  |
| `MEDIAMTX_API_URL`          | backend   | Si          | URL API MediaMTX (v3)                      |
| `DB_USER`                   | postgres  | Si          | Usuario PostgreSQL                         |
| `DB_PASSWORD`               | postgres  | Si          | Password PostgreSQL                        |
| `DB_NAME`                   | postgres  | Si          | Nombre de base de datos                    |
| `FRONTEND_PORT`             | frontend  | No (8080)   | Puerto expuesto del frontend               |
| `BACKEND_PORT`              | backend   | No (3000)   | Puerto expuesto del backend                |

### 8.5 Diagrama de Red

```
                  Internet
                     |
                     | HTTPS :443
                     v
            +--------+--------+
            |    Firewall /   |
            |    Load Balancer|
            +--------+--------+
                     |
          +----------+-----------+
          |                      |
          v                      v
  +-------+--------+    +-------+--------+
  | :8080 Frontend  |    | :8889 WebRTC   |
  | NGINX (SPA)     |    | MediaMTX       |
  +-------+---------+    +----------------+
          |
          | /api/* proxy_pass
          v
  +-------+--------+
  | :3000 Backend   |
  | Fastify API     |
  +--+------+------+
     |      |
     v      v
  +--+--+ +-+--------+
  |PG   | |MediaMTX  |
  |:5432| |API :9997  |
  +-----+ +----------+
```

### 8.6 Estrategia de Build Multi-Etapa

**Frontend (Dockerfile.frontend):**
1. Etapa `build`: Node 20, `npm ci`, `vite build`
2. Etapa `runtime`: NGINX Alpine, copia `dist/`, aplica `nginx.conf`

**Backend (backend/Dockerfile):**
1. Etapa `build`: Node 20, `pnpm install`, `turbo run build`
2. Etapa `runtime`: Node 20 slim, solo dependencias de produccion

---

## Apendice A: Modelo de Datos (Tablas Principales)

```
tenants
  +-- profiles (userId, tenantId)
  +-- user_roles (userId, role)
  +-- sites
  |     +-- devices
  |           +-- streams
  |           +-- device_groups
  +-- events
  +-- incidents
  +-- sections
  +-- domotic_devices / domotic_actions
  +-- access_people / access_vehicles / access_logs
  +-- reboot_tasks
  +-- intercom_devices / intercom_calls
  +-- call_sessions / voip_config
  +-- database_records
  +-- wa_conversations / wa_messages / wa_templates
  +-- alert_rules / escalation_policies / alert_instances
  +-- notification_channels / notification_log
  +-- shifts / shift_assignments
  +-- sla_definitions / sla_tracking
  +-- emergency_protocols / emergency_contacts / emergency_activations
  +-- patrol_routes / patrol_checkpoints / patrol_logs
  +-- scheduled_reports
  +-- automation_rules / automation_executions
  +-- visitors / visitor_passes
  +-- kpi_snapshots
  +-- push_subscriptions
  +-- contracts / invoices
  +-- key_inventory / key_logs
  +-- compliance_templates / data_retention_policies
  +-- training_programs / certifications
  +-- reports
  +-- biomarkers
  +-- audit_logs
  +-- integrations
  +-- mcp_connectors
  +-- ai_sessions
  +-- feature_flags
  +-- role_module_permissions
  +-- live_view_layouts
  +-- playback_requests
  +-- refresh_tokens
```

## Apendice B: Cadena de Plugins Fastify (Orden de Ejecucion)

El orden de registro de plugins es critico para el correcto funcionamiento:

```
1. Zod Validator/Serializer Compilers
2. Swagger + Swagger UI (/docs)
3. CORS (@fastify/cors)
4. Helmet (@fastify/helmet)
5. JWT (@fastify/jwt, HS256)
6. Error Handler (middleware)
7. Request ID (middleware)
8. Rate Limiter (middleware)
9. Metrics Hook (onResponse)
10. Auth Plugin (onRequest — JWT verify o Supabase fallback)
11. Tenant Plugin (onRequest — validar tenant activo)
12. Audit Plugin (onResponse — registrar mutaciones)
13. Modulos de rutas (45 modulos registrados con prefijo)
14. WebSocket Plugin (ultimo)
```

---

> **Documento generado para Clave Seguridad.**
> Referencia definitiva de arquitectura del sistema.
