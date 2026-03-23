# Clave Seguridad — Manual Completo de Integración y Parametrización

> Versión 1.0 — Marzo 2026
> Plataforma centralizada de monitoreo, control de acceso, videovigilancia y operaciones de seguridad

---

## Tabla de Contenidos

1. [Arquitectura General](#1-arquitectura-general)
2. [Requisitos Previos](#2-requisitos-previos)
3. [Configuración Inicial del Sistema](#3-configuración-inicial-del-sistema)
4. [Integración de Base de Datos](#4-integración-de-base-de-datos)
5. [Autenticación y Seguridad](#5-autenticación-y-seguridad)
6. [Multi-Tenancy (Multi-Empresa)](#6-multi-tenancy-multi-empresa)
7. [Integración de Dispositivos de Video](#7-integración-de-dispositivos-de-video)
8. [Integración de Streaming (MediaMTX)](#8-integración-de-streaming-mediamtx)
9. [Integración de Citofonía IP y VoIP](#9-integración-de-citofonía-ip-y-voip)
10. [Integración de WhatsApp Business](#10-integración-de-whatsapp-business)
11. [Integración de Email](#11-integración-de-email)
12. [Integración de Domótica (eWeLink/Sonoff)](#12-integración-de-domótica-ewelinksonoff)
13. [Integración de IA (OpenAI / Anthropic)](#13-integración-de-ia-openai--anthropic)
14. [Integración de Voz (ElevenLabs TTS)](#14-integración-de-voz-elevenlabs-tts)
15. [Notificaciones Push (Web Push)](#15-notificaciones-push-web-push)
16. [Sistema de Alertas y Escalamiento](#16-sistema-de-alertas-y-escalamiento)
17. [Automatización de Reglas](#17-automatización-de-reglas)
18. [Gestión de Reportes Programados](#18-gestión-de-reportes-programados)
19. [Backups y Restauración](#19-backups-y-restauración)
20. [Monitoreo y Observabilidad](#20-monitoreo-y-observabilidad)
21. [Despliegue en Producción](#21-despliegue-en-producción)
22. [Parametrización por Módulo](#22-parametrización-por-módulo)
23. [Referencia Completa de Variables de Entorno](#23-referencia-completa-de-variables-de-entorno)
24. [API Reference Rápida](#24-api-reference-rápida)
25. [Solución de Problemas](#25-solución-de-problemas)

---

## 1. Arquitectura General

```
┌────────────────────────────────────────────────────────────────┐
│                    USUARIOS / OPERADORES                       │
│              (Navegador Web / PWA Móvil)                       │
└─────────────────────────┬──────────────────────────────────────┘
                          │ HTTPS / WSS
┌─────────────────────────▼──────────────────────────────────────┐
│                    NGINX (Reverse Proxy)                        │
│              Puerto 80/443 — SSL/TLS Termination               │
├────────────────────┬───────────────────────────────────────────┤
│  /           →     │  Frontend React (SPA estática)            │
│  /api/*      →     │  Backend Fastify API                      │
│  /ws         →     │  WebSocket (eventos en tiempo real)       │
└────────────────────┴───────────────────────────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────────────┐
│                  BACKEND API (Fastify 5)                        │
│                  Puerto 3000                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │   Auth   │  │ Devices  │  │  Events  │  │  Alerts  │      │
│  │   JWT    │  │  CRUD    │  │  Queue   │  │Escalation│      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Intercom │  │ WhatsApp │  │  Email   │  │ eWeLink  │      │
│  │   SIP    │  │  Cloud   │  │  SMTP    │  │  Sonoff  │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │    AI    │  │  Voice   │  │Automation│  │  Audit   │      │
│  │ Bridge   │  │   TTS    │  │  Engine  │  │  Trail   │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
└───────┬────────────┬───────────────┬───────────┬──────────────┘
        │            │               │           │
┌───────▼──┐  ┌──────▼───┐  ┌───────▼──┐  ┌────▼─────┐
│PostgreSQL│  │ MediaMTX │  │  Redis   │  │ Servicios│
│ pgvector │  │RTSP/HLS/ │  │  Cache   │  │ Externos │
│  :5432   │  │  WebRTC  │  │  :6379   │  │          │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
                  │
        ┌─────────┴──────────┐
        │  Cámaras / NVR     │
        │  Hikvision, Dahua  │
        │  ONVIF genérico    │
        └────────────────────┘
```

### Componentes del Sistema

| Componente | Tecnología | Puerto | Función |
|------------|-----------|--------|---------|
| Frontend | React 18 + Vite + TailwindCSS | 8080 | Interfaz de operador |
| Backend API | Fastify 5 + TypeScript | 3000 | API REST + WebSocket |
| Base de Datos | PostgreSQL + pgvector | 5432 | Almacenamiento principal |
| Streaming | MediaMTX | 8554/8888/8889 | Gateway RTSP/HLS/WebRTC |
| Cache | Redis (opcional) | 6379 | Caché y pub/sub |
| Proxy | NGINX | 80/443 | Reverse proxy + SSL |

---

## 2. Requisitos Previos

### Hardware Mínimo (Servidor)
- CPU: 4 cores
- RAM: 8 GB
- Disco: 100 GB SSD
- Red: 100 Mbps simétrico

### Software
- Docker 24+ y Docker Compose v2
- Node.js 20+ (solo para desarrollo local)
- Git

### Accesos Necesarios
- Servidor VPS con acceso SSH y sudo
- Dominio con acceso DNS (para producción)
- Credenciales de red de cámaras/NVR
- (Opcional) Cuenta Meta Business para WhatsApp
- (Opcional) Cuenta SMTP o Resend para email
- (Opcional) API key de OpenAI o Anthropic

---

## 3. Configuración Inicial del Sistema

### 3.1 Clonar y Preparar

```bash
git clone <REPO_URL> clave-seguridad
cd clave-seguridad
```

### 3.2 Configurar Variables de Entorno

```bash
# Docker
cp .env.docker.example .env.docker

# Backend
cp backend/.env.example backend/.env

# Frontend
cp .env.example .env
```

### 3.3 Generar Secretos

```bash
# JWT Secret (obligatorio)
openssl rand -base64 48

# Clave de encriptación de credenciales (obligatorio en producción)
openssl rand -hex 16
```

### 3.4 Editar `.env.docker`

```env
DB_USER=clave
DB_PASSWORD=<CONTRASEÑA_SEGURA_GENERADA>
DB_NAME=clave_db
DB_PORT=5432
JWT_SECRET=<JWT_SECRET_GENERADO>
FRONTEND_PORT=8080
BACKEND_PORT=3000
CORS_ORIGINS=http://localhost:8080
```

### 3.5 Iniciar el Sistema

```bash
docker compose --env-file .env.docker up -d --build
```

### 3.6 Verificar Servicios

```bash
# Estado de contenedores
docker compose ps

# Salud del backend
curl http://localhost:3000/health

# Documentación API
# Abrir: http://localhost:3000/docs
```

---

## 4. Integración de Base de Datos

### 4.1 Conexión PostgreSQL

La variable `DATABASE_URL` define la conexión:

```env
DATABASE_URL=postgres://clave:PASSWORD@clave-postgres:5432/clave_db
```

### 4.2 Migraciones

Las migraciones están en `backend/apps/backend-api/src/db/migrations/`. Se aplican automáticamente al iniciar el backend, o manualmente:

```bash
cd backend
pnpm --filter @aion/backend-api db:migrate
```

### 4.3 Estructura de la Base de Datos

La base de datos contiene 50+ tablas organizadas en dominios:

| Dominio | Tablas Principales |
|---------|-------------------|
| Core | tenants, profiles, user_roles, refresh_tokens, audit_logs |
| Dispositivos | sites, devices, device_groups, streams |
| Monitoreo | events, incidents, alerts, alert_instances, escalation_policies |
| Comunicaciones | intercom_devices, call_sessions, voip_config, wa_conversations, wa_messages |
| Operaciones | shifts, shift_assignments, patrol_routes, patrol_checkpoints, patrol_logs |
| Acceso | access_people, access_vehicles, access_logs |
| Automatización | automation_rules, automation_executions, domotics_devices |
| Gestión | contracts, invoices, key_inventory, compliance_templates, training_programs |
| IA | ai_sessions, biomarkers, kpi_snapshots |

### 4.4 Extensiones PostgreSQL

- **pgvector**: Para búsquedas de similitud vectorial (búsqueda biogenética)
- Se activa automáticamente con la imagen `ankane/pgvector`

### 4.5 Retención de Datos

Configurable desde **Configuración → Avanzado** en la interfaz:

| Dato | Opciones |
|------|----------|
| Eventos | 30, 90, 365 días, ilimitado |
| Logs de auditoría | 30, 90, 365 días, ilimitado |

---

## 5. Autenticación y Seguridad

### 5.1 Flujo de Autenticación

```
Cliente → Supabase Auth → Token Supabase
Token Supabase → POST /auth/login → JWT Clave Seguridad
JWT → Authorization: Bearer <token> → Todas las rutas protegidas
```

### 5.2 Configuración de Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Obtener URL del proyecto y anon key
3. Configurar en `.env` del frontend:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

4. Crear tablas de auth en Supabase (profiles, user_roles)

### 5.3 JWT Backend

```env
JWT_SECRET=<mínimo 32 caracteres>
JWT_ISSUER=clave-seguridad
```

- Algoritmo: HS256 (hardcoded, no acepta "none")
- Expiración: 24 horas
- Refresh token: 30 días con rotación por familia

### 5.4 Roles del Sistema

| Rol | Permisos |
|-----|----------|
| `super_admin` | Acceso total, gestión de plataforma |
| `tenant_admin` | Administración del tenant, usuarios, configuración |
| `operator` | Operaciones diarias, eventos, dispositivos, incidentes |
| `viewer` | Solo lectura en módulos asignados |
| `auditor` | Acceso a auditoría y reportes |

### 5.5 Permisos por Módulo

Desde **Administración → Permisos por Módulo**, el admin puede habilitar/deshabilitar módulos por rol:

- Los roles `super_admin` y `tenant_admin` tienen acceso completo (no editable)
- Los roles `operator`, `viewer` y `auditor` son configurables
- Cada módulo se puede habilitar o deshabilitar individualmente

### 5.6 Encriptación de Credenciales

Las credenciales de dispositivos se almacenan encriptadas con AES-256:

```env
CREDENTIAL_ENCRYPTION_KEY=<32 caracteres hexadecimales>
```

---

## 6. Multi-Tenancy (Multi-Empresa)

### 6.1 Concepto

Cada empresa/cliente opera en un tenant aislado. Los datos nunca se mezclan entre tenants.

### 6.2 Configuración de un Tenant

Desde **Configuración → General**:

| Campo | Descripción |
|-------|-------------|
| Nombre de la Organización | Nombre visible del tenant |
| Zona Horaria | Zona horaria para reportes y timestamps |
| Logo | URL del logo del tenant |
| Idioma | Español o Inglés |

### 6.3 Configuraciones por Tenant (JSONB)

El campo `settings` del tenant almacena configuraciones dinámicas:

```json
{
  "language": "es",
  "darkMode": true,
  "compactMode": false,
  "notifications": {
    "critical_events": true,
    "device_offline": true
  },
  "security": {
    "twoFactor": false,
    "sessionTimeout": "60",
    "strongPasswords": false
  },
  "ai": {
    "defaultProvider": "lovable",
    "fallbackProvider": "openai"
  },
  "retention": {
    "events": "90",
    "audit": "365"
  }
}
```

### 6.4 Branding por Tenant

Cada tenant puede personalizar:
- Nombre de organización
- Logo (URL)
- Zona horaria
- Idioma predeterminado
- Preferencias de notificación

---

## 7. Integración de Dispositivos de Video

### 7.1 Marcas Soportadas

| Marca | Protocolo | Funciones |
|-------|-----------|-----------|
| Hikvision | RTSP + ISAPI | Video, PTZ, eventos, acceso |
| Dahua | RTSP + CGI/RPC | Video, PTZ, eventos |
| ONVIF genérico | ONVIF Profile S/T | Video, descubrimiento |
| Cualquier RTSP | RTSP directo | Video |

### 7.2 Agregar un Dispositivo

**Desde la interfaz: Dispositivos → Agregar Dispositivo**

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| Nombre | Nombre descriptivo | "Cámara Lobby Principal" |
| Marca | Fabricante | Hikvision, Dahua, ONVIF |
| Modelo | Modelo del equipo | DS-2CD2143G2-I |
| Dirección IP | IP LAN del dispositivo | 192.168.1.100 |
| Puerto RTSP | Puerto de streaming | 554 |
| Puerto ONVIF | Puerto de servicio ONVIF | 80 |
| Usuario | Credencial de acceso | admin |
| Contraseña | Contraseña del dispositivo | (encriptada en BD) |
| Firmware | Versión de firmware | V5.7.21 |
| Canales | Número de canales (NVR) | 16 |
| Capacidades | Funciones del dispositivo | ptz, audio, analytics |
| Tags | Etiquetas de clasificación | exterior, lobby, alta-res |
| Notas | Notas operativas | "Requiere reinicio semanal" |
| Sitio | Sitio asignado | Sede Central |

### 7.3 URL RTSP Típicas

```
# Hikvision
rtsp://usuario:contraseña@IP:554/Streaming/Channels/101

# Dahua
rtsp://usuario:contraseña@IP:554/cam/realmonitor?channel=1&subtype=0

# ONVIF genérico
rtsp://usuario:contraseña@IP:554/stream1
```

### 7.4 Verificar Conectividad

1. Después de agregar, clic en **Probar Conexión**
2. El sistema realiza un TCP health check al puerto especificado
3. Estado resultante: `online` (verde), `offline` (rojo), `unknown` (gris)

### 7.5 Descubrimiento de Red

```env
DISCOVERY_NETWORK_RANGE=192.168.1.0/24
```

El backend puede escanear la red para encontrar dispositivos ONVIF automáticamente.

### 7.6 API de Dispositivos

```bash
# Listar dispositivos
GET /api/v1/devices?status=online&brand=hikvision&page=1&limit=20

# Crear dispositivo
POST /api/v1/devices
{
  "name": "Cámara Lobby",
  "brand": "hikvision",
  "model": "DS-2CD2143G2-I",
  "ipAddress": "192.168.1.100",
  "rtspPort": 554,
  "siteId": "uuid-del-sitio"
}

# Health check
GET /api/v1/devices/:id/health

# Test de conectividad
POST /api/v1/devices/:id/test
```

---

## 8. Integración de Streaming (MediaMTX)

### 8.1 ¿Qué es MediaMTX?

MediaMTX es el gateway de video que convierte streams RTSP de las cámaras a formatos consumibles por el navegador:
- **RTSP → HLS**: Para reproducción estándar
- **RTSP → WebRTC**: Para latencia ultra-baja

### 8.2 Configuración

MediaMTX corre como contenedor Docker con los puertos:

| Puerto | Protocolo | Uso |
|--------|-----------|-----|
| 8554 | RTSP | Entrada de streams de cámaras |
| 8888 | HLS | Reproducción de video en navegador |
| 8889 | WebRTC | Latencia baja para vista en vivo |
| 9997 | HTTP | API de administración de MediaMTX |

### 8.3 Agregar Stream Dinámicamente

```bash
# Via API del Edge Gateway
POST /api/v1/streams/add
{
  "streamId": "cam-lobby-01",
  "sourceUrl": "rtsp://admin:pass@192.168.1.100:554/Streaming/Channels/101"
}
```

### 8.4 Consumir Stream en el Navegador

```
# HLS (compatible universal)
http://servidor:8888/cam-lobby-01/

# WebRTC (latencia baja)
http://servidor:8889/cam-lobby-01/
```

### 8.5 Vista en Vivo

Desde **Vista en Vivo** en la interfaz:
1. Seleccionar tamaño de grilla (1x1 hasta 6x6)
2. Arrastrar cámaras desde la barra lateral a las posiciones
3. Cada celda muestra el stream vía WebRTC
4. Controles por cámara: maximizar, captura, volumen, actualizar
5. Guardar/cargar layouts personalizados
6. Filtrar por sitio

---

## 9. Integración de Citofonía IP y VoIP

### 9.1 Arquitectura VoIP

```
Citófono Fanvil/Hikvision → SIP → PBX (Asterisk/FreePBX) → Clave Seguridad
                                                              ↕
                                                        ElevenLabs TTS
                                                        (Voz automática)
```

### 9.2 Configuración SIP/PBX

```env
SIP_HOST=192.168.1.100        # IP del PBX
SIP_PORT=5060                  # Puerto SIP
SIP_TRANSPORT=udp              # udp, tcp, tls, wss
SIP_DOMAIN=pbx.midominio.com   # Dominio SIP
SIP_ARI_URL=http://192.168.1.100:8088/ari  # Asterisk REST Interface
SIP_ARI_USERNAME=clave         # Usuario ARI
SIP_ARI_PASSWORD=secreto       # Contraseña ARI
```

### 9.3 Marcas Soportadas

| Marca | Modelos | Funciones |
|-------|---------|-----------|
| Fanvil | X3, X5, X7 | Llamada, apertura de puerta, video |
| Hikvision | DS-KD series | Llamada, apertura, video, lector |
| Grandstream | GDS37xx | Llamada, apertura, RFID |
| SIP Genérico | Cualquier | Llamada básica |

### 9.4 Agregar Citófono

Desde **Citofonía IP → Dispositivos → Agregar Dispositivo**:

| Campo | Descripción |
|-------|-------------|
| Nombre | "Citófono Portería Norte" |
| Sección | Sección asignada |
| Marca | Fanvil / Hikvision / otro |
| Modelo | X5U / DS-KD8003 |
| IP | 192.168.1.50 |
| URI SIP | sip:100@192.168.1.100 |

### 9.5 Flujo de Llamada Entrante

1. Visitante presiona botón del citófono
2. PBX envía INVITE SIP
3. Backend registra la llamada (`POST /intercom/sessions/inbound`)
4. Si modo **IA**: ElevenLabs genera saludo automático
5. Si modo **Humano**: Notificación al operador
6. Si modo **Mixto**: IA atiende primero, escala a humano si necesario
7. Operador puede abrir puerta vía relay
8. Llamada finaliza (`POST /intercom/sessions/:id/end`)

### 9.6 Modos de Atención

Configurables desde **Citofonía IP → Voz IA**:

| Modo | Descripción |
|------|-------------|
| Operador Humano | El operador atiende todas las llamadas |
| Agente IA | IA atiende con saludo y validación automática |
| Modo Mixto | IA atiende primero, escala a humano cuando necesario |

### 9.7 Plantillas de Saludo

4 plantillas predefinidas configurables:
1. **Saludo por defecto**: "Bienvenido, ¿a quién visita?"
2. **Fuera de horario**: "Estamos fuera de horario..."
3. **Emergencia**: "Si es una emergencia..."
4. **Mantenimiento**: "El acceso está temporalmente restringido..."

---

## 10. Integración de WhatsApp Business

### 10.1 Requisitos

1. Cuenta de Meta Business verificada
2. App creada en Meta for Developers
3. Número de WhatsApp Business registrado
4. Access Token permanente generado

### 10.2 Obtener Credenciales

1. Ir a [developers.facebook.com](https://developers.facebook.com)
2. Crear o seleccionar tu app de tipo "Business"
3. En **WhatsApp → Configuración de API**:
   - Copiar **Phone Number ID**
   - Copiar **WhatsApp Business Account ID**
4. En **Configuración → Tokens**: Generar token permanente

### 10.3 Configuración

**Opción A: Variables de entorno**
```env
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxx...
WHATSAPP_BUSINESS_ACCOUNT_ID=9876543210
WHATSAPP_VERIFY_TOKEN=mi_token_de_verificacion
WHATSAPP_APP_SECRET=abc123def456...
```

**Opción B: Desde la interfaz**
Ir a **WhatsApp → Configuración** y llenar los campos.

### 10.4 Configurar Webhook en Meta

1. En Meta for Developers → WhatsApp → Configuración
2. URL del Webhook: `https://tu-dominio.com/api/v1/webhooks/whatsapp`
3. Token de verificación: el mismo de `WHATSAPP_VERIFY_TOKEN`
4. Suscripciones: messages, message_status

### 10.5 Funcionalidades

| Función | Descripción |
|---------|-------------|
| Enviar mensaje | Texto, imagen, documento |
| Respuesta rápida | Plantillas con botones |
| Conversaciones | Hilos con historial completo |
| Handoff | Escalar a operador humano |
| Plantillas | Sincronización con Meta |
| Deduplicación | Protección contra mensajes duplicados |
| Replay protection | Protección contra ataques de replay |

### 10.6 API de WhatsApp

```bash
# Enviar mensaje
POST /api/v1/whatsapp/messages
{
  "to": "573001234567",
  "type": "text",
  "text": "Alerta: Puerta forzada en Sede Norte"
}

# Sincronizar plantillas de Meta
POST /api/v1/whatsapp/templates/sync
```

---

## 11. Integración de Email

### 11.1 Proveedores Soportados

| Proveedor | Variable | Notas |
|-----------|----------|-------|
| Resend | `RESEND_API_KEY` | Recomendado, más simple |
| SendGrid | `SENDGRID_API_KEY` | Enterprise |
| SMTP | `SMTP_HOST/PORT/USER/PASS` | Cualquier servidor SMTP |

### 11.2 Configuración SMTP

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alertas@miempresa.com
SMTP_PASS=contraseña_de_aplicacion
EMAIL_FROM_ADDRESS=alertas@miempresa.com
EMAIL_FROM_NAME=Clave Seguridad
```

### 11.3 Configuración Resend

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxx
EMAIL_FROM_ADDRESS=alertas@midominio.com
EMAIL_FROM_NAME=Clave Seguridad
```

### 11.4 Tipos de Email Automáticos

| Tipo | Endpoint | Uso |
|------|----------|-----|
| Alerta de evento | `POST /email/event-alert` | Evento crítico detectado |
| Reporte de incidente | `POST /email/incident-report` | Resumen de incidente |
| Reporte periódico | `POST /email/periodic-report` | Reporte programado |
| Paquete de evidencia | `POST /email/evidence-package` | Evidencia adjunta |
| Email genérico | `POST /email/send` | Cualquier propósito |

### 11.5 Verificar Configuración

```bash
POST /api/v1/email/test
{
  "to": "admin@miempresa.com",
  "subject": "Prueba de configuración",
  "body": "Email de prueba desde Clave Seguridad"
}
```

---

## 12. Integración de Domótica (eWeLink/Sonoff)

### 12.1 ¿Qué es eWeLink?

eWeLink es la plataforma cloud de los dispositivos Sonoff (interruptores WiFi, enchufes inteligentes, relés). Clave Seguridad se integra directamente con la API de eWeLink.

### 12.2 Obtener Credenciales de Desarrollador

1. Ir a [dev.ewelink.cc](https://dev.ewelink.cc)
2. Registrarse como desarrollador
3. Crear una aplicación
4. Obtener App ID y App Secret

### 12.3 Configuración

```env
EWELINK_APP_ID=tu_app_id
EWELINK_APP_SECRET=tu_app_secret
EWELINK_REGION=us    # us, eu, as, cn
```

### 12.4 Autenticación

Desde **Domóticos** en la interfaz:
1. Clic en el botón de eWeLink (icono)
2. Ingresar email y contraseña de la cuenta eWeLink del usuario
3. El sistema autentica y carga los dispositivos vinculados

### 12.5 Acciones Disponibles

| Acción | Descripción |
|--------|-------------|
| Toggle | Encender/apagar dispositivo |
| Batch Control | Control múltiple simultáneo |
| Sync | Sincronizar lista de dispositivos |
| Estado | Consultar estado actual on/off |
| Health | Verificar conectividad |

### 12.6 Dispositivos Soportados

- Interruptores Sonoff Basic/Mini/TX
- Enchufes inteligentes S26/S31
- Relés de 1, 2 y 4 canales
- Tiras LED controlables
- Sensores de temperatura/humedad (lectura)

---

## 13. Integración de IA (OpenAI / Anthropic)

### 13.1 Proveedores Soportados

| Proveedor | Modelos | Variable |
|-----------|---------|----------|
| OpenAI | GPT-4o, GPT-4, GPT-3.5 | `OPENAI_API_KEY` |
| Anthropic | Claude 3.5 Sonnet, Opus | `ANTHROPIC_API_KEY` |
| Lovable | Proxy gateway | Incluido por defecto |

### 13.2 Configuración

```env
# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
```

### 13.3 Configuración desde la Interfaz

**Configuración → Config. IA**:
- Proveedor principal: seleccionar OpenAI, Anthropic o Lovable
- Proveedor de respaldo: seleccionar fallback

### 13.4 Funciones del Asistente IA

| Función | Descripción |
|---------|-------------|
| Chat operativo | Preguntas sobre estado del sistema |
| Resumen de alertas | Consolidación automática de alertas activas |
| Estado de dispositivos | Diagnóstico de dispositivos problemáticos |
| Borrador de reportes | Generación automática de reportes |
| Generación de SOPs | Procedimientos operativos estándar |
| Resumen de turno | Briefing operativo para cambio de guardia |

### 13.5 Contexto Automático

El asistente IA recibe automáticamente:
- Estadísticas de eventos en tiempo real
- Estado de dispositivos (online/offline)
- Información del turno actual
- Incidentes activos

### 13.6 API del Asistente

```bash
# Chat de una sola respuesta
POST /api/v1/ai/chat
{
  "message": "Resume las alertas activas",
  "provider": "openai"
}

# Streaming (Server-Sent Events)
POST /api/v1/ai/chat/stream
{
  "message": "¿Qué dispositivos necesitan atención?",
  "stream": true
}

# Resumen de turno
GET /api/v1/ai/shift-summary
```

---

## 14. Integración de Voz (ElevenLabs TTS)

### 14.1 Configuración

```env
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxx
ELEVENLABS_DEFAULT_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

### 14.2 Funciones

| Función | Uso |
|---------|-----|
| Síntesis de voz | Convertir texto a audio para intercomunicación |
| Saludos automáticos | Mensajes de bienvenida en citofonía |
| Notificaciones de voz | Alertas habladas al operador |
| Selección de voz | Múltiples voces por idioma/género |

### 14.3 Configuración desde la Interfaz

**Citofonía IP → Voz IA**:
1. Verificar estado de conexión (indicador verde)
2. Seleccionar voz predeterminada del dropdown
3. Probar reproducción con botón "Test"
4. Configurar plantillas de saludo

### 14.4 API de Voz

```bash
# Sintetizar texto a audio
POST /api/v1/voice/synthesize
{
  "text": "Bienvenido, ¿a quién visita?",
  "voiceId": "21m00Tcm4TlvDq8ikWAM"
}

# Generar saludo por plantilla
POST /api/v1/voice/greetings/generate
{
  "template": "default",
  "visitorName": "Juan Pérez"
}
```

---

## 15. Notificaciones Push (Web Push)

### 15.1 Generar Claves VAPID

```bash
npx web-push generate-vapid-keys
```

### 15.2 Configuración

```env
VAPID_PUBLIC_KEY=BNxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
VAPID_SUBJECT=mailto:admin@midominio.com
```

### 15.3 Activación por Usuario

Desde **Configuración → Notificaciones**:
1. Clic en "Habilitar Notificaciones Push"
2. Aceptar permiso del navegador
3. Seleccionar qué eventos notificar:
   - Eventos críticos
   - Alertas de alta severidad
   - Dispositivo fuera de línea
   - Cambios de salud del sistema
   - Actualizaciones de incidentes

### 15.4 Dashboard: Notificaciones

En el Dashboard principal, el botón de notificaciones permite activar/desactivar push rápidamente.

---

## 16. Sistema de Alertas y Escalamiento

### 16.1 Crear Regla de Alerta

**Alertas → Reglas → Nueva Regla**:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| Nombre | Descripción de la regla | "Dispositivo offline > 5 min" |
| Severidad | critical / high / medium / low | critical |
| Trigger | Condición de activación | device_offline |
| Dispositivos | Dispositivos afectados | Todos, o específicos |
| Sitio | Sitio afectado | Sede Norte |

### 16.2 Crear Política de Escalamiento

**Alertas → Escalamiento → Nueva Política**:

Cada política tiene niveles de escalamiento:

| Nivel | Notifica a | Timeout |
|-------|-----------|---------|
| 1 | Operador de turno | 5 minutos |
| 2 | Supervisor | 15 minutos |
| 3 | Gerente de seguridad | 30 minutos |
| 4 | Director | 60 minutos |

### 16.3 Configurar Canales de Notificación

**Alertas → Canales → Nuevo Canal**:

| Tipo | Configuración |
|------|---------------|
| Email | Dirección de correo |
| WhatsApp | Número de teléfono |
| Webhook | URL del endpoint |
| Push | Automático por usuario |
| Slack | URL del webhook |
| Teams | URL del webhook |

### 16.4 Flujo de Escalamiento

```
Evento detectado
  → ¿Coincide con alguna regla?
    → Sí → Crear instancia de alerta
      → Enviar notificación (Nivel 1)
        → ¿Reconocida en el timeout?
          → Sí → Fin
          → No → Escalar a Nivel 2
            → Repetir...
```

---

## 17. Automatización de Reglas

### 17.1 Crear Regla de Automatización

**Automatización → Reglas → Nueva Regla**:

| Campo | Descripción |
|-------|-------------|
| Nombre | "Auto-cerrar puertas a las 22:00" |
| Trigger | event, schedule, manual |
| Condiciones | AND/OR de expresiones |
| Acciones | Secuencia de acciones a ejecutar |
| Prioridad | high, medium, low |

### 17.2 Tipos de Trigger

| Tipo | Descripción |
|------|-------------|
| Evento | Se activa cuando ocurre un evento específico |
| Horario | Se ejecuta en hora/día programado |
| Manual | Se activa manualmente |
| Umbral | Se activa cuando una métrica supera un valor |

### 17.3 Tipos de Acciones

| Acción | Descripción |
|--------|-------------|
| Controlar dispositivo | Toggle domótico, relay, cerradura |
| Enviar notificación | Email, WhatsApp, push |
| Crear incidente | Generar incidente automáticamente |
| Ejecutar webhook | Llamar URL externa |

### 17.4 Historial de Ejecuciones

Cada ejecución se registra con:
- Fecha y hora
- Estado: success / partial / failed
- Tiempo de ejecución (ms)
- Detalle de errores si aplica

---

## 18. Gestión de Reportes Programados

### 18.1 Crear Reporte Programado

**Reportes Programados → Nuevo**:

| Campo | Descripción |
|-------|-------------|
| Tipo | events, incidents, sla, patrol, devices |
| Frecuencia | Diario, semanal, mensual |
| Destinatarios | Lista de emails |
| Filtros | Severidad, sitio, tipo de evento |
| Formato | PDF o CSV |

### 18.2 Tipos de Reporte

| Reporte | Contenido |
|---------|-----------|
| Resumen de eventos | Eventos por tipo, severidad, período |
| Reporte de incidentes | Incidentes abiertos y resueltos |
| Salud de dispositivos | Estado online/offline |
| Cumplimiento SLA | Respuestas dentro/fuera de SLA |
| Patrullas | Rutas completadas, checkpoints |
| Uso de IA | Sesiones, tokens consumidos |

### 18.3 Entrega

Los reportes se entregan automáticamente por email en la frecuencia configurada. También se pueden descargar manualmente desde **Reportes**.

---

## 19. Backups y Restauración

### 19.1 Backup Manual

```bash
# Desde el contenedor PostgreSQL
docker exec clave-postgres pg_dump -U clave clave_db > backup_$(date +%Y%m%d).sql
```

### 19.2 Backup desde la API

```bash
# Ver estado de backups
GET /api/v1/backup/status

# Ejecutar backup manual
POST /api/v1/backup/trigger

# Listar backups disponibles
GET /api/v1/backup/list
```

### 19.3 Restauración

```bash
# Restaurar desde archivo
cat backup_20260321.sql | docker exec -i clave-postgres psql -U clave clave_db
```

### 19.4 Backups Automáticos

El worker de backup se ejecuta periódicamente (configurable). Estado visible en **Salud del Sistema**.

---

## 20. Monitoreo y Observabilidad

### 20.1 Health Endpoint

```bash
GET /health
# Respuesta:
{
  "status": "healthy",
  "checks": [
    {"component": "database", "status": "healthy", "latency_ms": 5},
    {"component": "redis", "status": "healthy", "latency_ms": 2},
    {"component": "mediamtx", "status": "healthy"}
  ]
}
```

### 20.2 Métricas Prometheus

Disponibles en `/metrics` (Prometheus format):
- `http_request_duration_seconds` — Latencia de requests
- `http_requests_total` — Conteo de requests
- `db_pool_size` — Pool de conexiones
- `active_websocket_connections` — WebSockets activos
- `events_processed_total` — Eventos procesados

### 20.3 Stack de Monitoreo (Opcional)

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    ports: ["9090:9090"]

  grafana:
    image: grafana/grafana
    ports: ["3001:3000"]
```

### 20.4 Logs

```bash
# Ver logs del backend
docker compose logs clave-backend -f

# Ver logs de PostgreSQL
docker compose logs clave-postgres -f

# Nivel de log configurable
LOG_LEVEL=debug  # debug, info, warn, error
```

### 20.5 OpenTelemetry

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318/v1/traces
```

Tracing distribuido para rastrear requests a través de todos los servicios.

---

## 21. Despliegue en Producción

### 21.1 Preparar Servidor

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo apt install docker-compose-plugin
```

### 21.2 Configurar Dominio

1. En tu proveedor DNS, crear registro A:
   ```
   A    tu-dominio.com    →    IP_DEL_SERVIDOR
   A    *.tu-dominio.com  →    IP_DEL_SERVIDOR
   ```

2. Esperar propagación DNS (hasta 48h, normalmente minutos)

### 21.3 SSL con Let's Encrypt

```bash
# Instalar certbot
sudo apt install certbot

# Obtener certificado
sudo certbot certonly --standalone -d tu-dominio.com -m tu@email.com --agree-tos
```

### 21.4 NGINX para Producción

Agregar configuración NGINX con SSL:

```nginx
server {
    listen 443 ssl http2;
    server_name tu-dominio.com;

    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    server_name tu-dominio.com;
    return 301 https://$host$request_uri;
}
```

### 21.5 Desplegar

```bash
# Configurar variables
cp .env.docker.example .env.docker
# Editar con credenciales de producción

# Levantar
docker compose --env-file .env.docker up -d --build

# Verificar
docker compose ps
curl https://tu-dominio.com/api/health
```

### 21.6 CI/CD (GitHub Actions)

El archivo `.github/workflows/deploy-production.yml` automatiza:
1. Build del frontend y backend
2. Push de imágenes Docker a GHCR
3. Deploy automático al servidor (con approval gate)

---

## 22. Parametrización por Módulo

### 22.1 Sitios

| Parámetro | Ubicación | Descripción |
|-----------|-----------|-------------|
| Nombre | UI: Sitios → Agregar | Nombre del sitio |
| Dirección | UI: Sitios → Agregar | Dirección física |
| Coordenadas | UI: Sitios → Agregar | Lat/Long para mapa |
| Zona horaria | UI: Sitios → Agregar | Zona horaria local |
| Estado | UI: Sitios → Editar | healthy/degraded/offline |

### 22.2 Control de Acceso

| Parámetro | Descripción |
|-----------|-------------|
| Personas | Nombre, unidad, teléfono, tipo, sección, documento |
| Vehículos | Placa, marca, modelo, color, tipo, propietario |
| Credenciales | RFID, NFC, PIN, biométrico |
| Bitácora | Dirección, método, sección, notas |

### 22.3 Turnos y Guardias

| Parámetro | Descripción |
|-----------|-------------|
| Nombre del turno | "Turno Día", "Turno Noche" |
| Horario | Hora inicio — hora fin |
| Días | Lun-Vie, Sáb-Dom, todos |
| Asignaciones | Operador → turno |

### 22.4 SLA

| Parámetro | Descripción |
|-----------|-------------|
| Severidad | critical / high / medium / low |
| Tiempo de respuesta | Minutos permitidos |
| Tiempo de resolución | Minutos permitidos |
| Escalamiento | Trigger de escalamiento automático |

### 22.5 Patrullas

| Parámetro | Descripción |
|-----------|-------------|
| Ruta | Nombre, sitio, tiempo estimado |
| Frecuencia | Cada X horas |
| Checkpoints | Puntos con coordenadas y descripción |
| Guardias | Operadores asignados |

### 22.6 Visitantes

| Parámetro | Descripción |
|-----------|-------------|
| Visitante | Nombre, empresa, documento, razón de visita |
| Pase | Tipo, validez (fecha inicio - fin), áreas |
| QR | Token único para validación |
| Check-in/out | Registro de entrada y salida |

### 22.7 Emergencias

| Parámetro | Descripción |
|-----------|-------------|
| Protocolo | Nombre, descripción, pasos |
| Contactos | Policía, bomberos, ambulancia, gerencia |
| Activación | Trigger manual o automático |
| Resolución | Registro de cierre |

### 22.8 Contratos

| Parámetro | Descripción |
|-----------|-------------|
| Contrato | Número, cliente, fechas, valor |
| Facturas | Items, montos, estado de pago |
| SLA contractual | Términos de servicio |

### 22.9 Llaves

| Parámetro | Descripción |
|-----------|-------------|
| Llave | Código, ubicación, categoría |
| Asignación | Persona, fecha entrega/devolución |
| Auditoría | Historial completo de tenedores |

### 22.10 Cumplimiento

| Parámetro | Descripción |
|-----------|-------------|
| Plantilla | Política, procedimiento, checklist |
| Versiones | Control de versiones |
| Retención | Períodos de retención por tipo de dato |

### 22.11 Capacitación

| Parámetro | Descripción |
|-----------|-------------|
| Programa | Nombre, descripción, requisitos |
| Certificación | Usuario, fecha, expiración |
| Alertas | Notificación de certificaciones por vencer |

---

## 23. Referencia Completa de Variables de Entorno

### Servidor

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `PORT` | No | 3000 | Puerto del servidor |
| `HOST` | No | 0.0.0.0 | Host de escucha |
| `NODE_ENV` | No | development | Entorno de ejecución |
| `LOG_LEVEL` | No | info | Nivel de log |

### Base de Datos

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DATABASE_URL` | Sí | URI PostgreSQL completa |

### Autenticación

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `JWT_SECRET` | Sí | Secreto JWT (min 32 chars) |
| `JWT_ISSUER` | No | Emisor del token |

### Seguridad

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `CORS_ORIGINS` | Sí | Orígenes CORS permitidos |
| `RATE_LIMIT_MAX` | No | Máx requests por ventana |
| `RATE_LIMIT_WINDOW_MS` | No | Ventana de rate limit (ms) |
| `CREDENTIAL_ENCRYPTION_KEY` | Prod | Clave AES para credenciales |

### Streaming

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `MEDIAMTX_API_URL` | No | API de MediaMTX |

### Red

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DISCOVERY_NETWORK_RANGE` | No | Rango para descubrimiento |

### IA

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `OPENAI_API_KEY` | No | Clave API OpenAI |
| `ANTHROPIC_API_KEY` | No | Clave API Anthropic |

### Voz

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `ELEVENLABS_API_KEY` | No | Clave API ElevenLabs |
| `ELEVENLABS_DEFAULT_VOICE_ID` | No | ID de voz predeterminada |
| `ELEVENLABS_MODEL_ID` | No | Modelo de síntesis |

### Email

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `RESEND_API_KEY` | No* | API key de Resend |
| `SENDGRID_API_KEY` | No* | API key de SendGrid |
| `SMTP_HOST` | No* | Host SMTP |
| `SMTP_PORT` | No* | Puerto SMTP |
| `SMTP_USER` | No* | Usuario SMTP |
| `SMTP_PASS` | No* | Contraseña SMTP |
| `EMAIL_FROM_ADDRESS` | No | Dirección remitente |
| `EMAIL_FROM_NAME` | No | Nombre remitente |

*Al menos un proveedor es necesario para funcionalidad de email.

### WhatsApp

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `WHATSAPP_PHONE_NUMBER_ID` | No | ID del número |
| `WHATSAPP_ACCESS_TOKEN` | No | Token de acceso |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | No | ID de cuenta Business |
| `WHATSAPP_VERIFY_TOKEN` | No | Token de verificación webhook |
| `WHATSAPP_APP_SECRET` | No | Secreto para validar firmas |

### VoIP/SIP

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `SIP_HOST` | No | IP del PBX |
| `SIP_PORT` | No | Puerto SIP |
| `SIP_TRANSPORT` | No | Transporte (udp/tcp/tls/wss) |
| `SIP_DOMAIN` | No | Dominio SIP |
| `SIP_ARI_URL` | No | URL Asterisk REST Interface |
| `SIP_ARI_USERNAME` | No | Usuario ARI |
| `SIP_ARI_PASSWORD` | No | Contraseña ARI |

### eWeLink/Sonoff

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `EWELINK_APP_ID` | No | App ID de desarrollador |
| `EWELINK_APP_SECRET` | No | App Secret |
| `EWELINK_REGION` | No | Región (us/eu/as/cn) |

### Push Notifications

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `VAPID_PUBLIC_KEY` | No | Clave pública VAPID |
| `VAPID_PRIVATE_KEY` | No | Clave privada VAPID |
| `VAPID_SUBJECT` | No | Email de contacto |

### Observabilidad

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | Endpoint OpenTelemetry |
| `PROMETHEUS_ENABLED` | No | Habilitar métricas |

---

## 24. API Reference Rápida

### Endpoints Principales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Estado del sistema |
| POST | `/api/v1/auth/login` | Autenticación |
| POST | `/api/v1/auth/refresh` | Renovar token |
| GET | `/api/v1/devices` | Listar dispositivos |
| POST | `/api/v1/devices` | Crear dispositivo |
| GET | `/api/v1/devices/:id/health` | Health check dispositivo |
| GET | `/api/v1/sites` | Listar sitios |
| POST | `/api/v1/sites` | Crear sitio |
| GET | `/api/v1/events` | Listar eventos |
| POST | `/api/v1/events` | Crear evento |
| GET | `/api/v1/incidents` | Listar incidentes |
| POST | `/api/v1/incidents` | Crear incidente |
| GET | `/api/v1/alerts/instances` | Alertas activas |
| PATCH | `/api/v1/alerts/instances/:id/acknowledge` | Reconocer alerta |
| GET | `/api/v1/intercom/sessions` | Sesiones de llamada |
| POST | `/api/v1/whatsapp/messages` | Enviar WhatsApp |
| POST | `/api/v1/email/send` | Enviar email |
| POST | `/api/v1/ai/chat` | Chat con IA |
| GET | `/api/v1/audit` | Logs de auditoría |
| GET | `/api/v1/backup/status` | Estado de backups |
| GET | `/api/v1/push/vapid-public-key` | Clave VAPID |

### Documentación Interactiva

Disponible en: `http://tu-servidor:3000/docs` (Swagger/OpenAPI)

---

## 25. Solución de Problemas

### El frontend no conecta con el backend

1. Verificar que `VITE_API_URL` apunte al backend correcto
2. Verificar que `CORS_ORIGINS` incluya el origen del frontend
3. Revisar logs: `docker compose logs clave-backend`

### Dispositivo muestra "offline"

1. Verificar conectividad de red al dispositivo (ping)
2. Verificar que el puerto RTSP (554) esté abierto
3. Verificar credenciales del dispositivo
4. Ejecutar test de conexión desde la interfaz

### WhatsApp no envía mensajes

1. Verificar que el token no haya expirado
2. Verificar que el número esté registrado en Meta Business
3. Verificar que el webhook esté configurado
4. Revisar logs: `docker compose logs clave-backend | grep whatsapp`

### Email no se envía

1. Ejecutar `POST /api/v1/email/test` para diagnosticar
2. Verificar credenciales SMTP
3. Verificar que el puerto SMTP no esté bloqueado por firewall
4. Para Gmail: usar contraseña de aplicación, no la contraseña normal

### La IA no responde

1. Verificar que la API key esté configurada
2. Verificar que el proveedor seleccionado tenga créditos
3. Revisar logs: `docker compose logs clave-backend | grep ai-bridge`

### MediaMTX no muestra video

1. Verificar que el contenedor esté corriendo: `docker compose ps`
2. Verificar la URL RTSP del dispositivo
3. Probar acceso directo: `http://localhost:8888/nombre-stream/`
4. Revisar logs: `docker compose logs clave-mediamtx`

### Base de datos no conecta

1. Verificar que el contenedor PostgreSQL esté healthy
2. Verificar `DATABASE_URL` en el `.env` del backend
3. Verificar que el puerto no esté en uso: `lsof -i :5432`

### Push notifications no llegan

1. Verificar que las claves VAPID estén configuradas
2. Verificar que el navegador haya dado permiso
3. Verificar que el service worker esté registrado
4. En iOS Safari: solo funciona agregando a pantalla de inicio

---

*Documento generado para Clave Seguridad v1.0 — Marzo 2026*
