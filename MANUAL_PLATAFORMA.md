# Manual de la Plataforma — AION Vision Hub (Clave Seguridad)

**Version:** 1.0 | **Fecha:** 2026-04-07 | **Dominio:** aionseg.co

---

## 1. Descripcion General

AION Vision Hub es una plataforma VMS (Video Management System) empresarial multi-tenant que unifica videovigilancia, control de acceso, automatizacion IoT, inteligencia artificial y gestion operativa en una sola interfaz.

**Stack tecnologico:**
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- Backend: Fastify 5 + Node 20 + Drizzle ORM
- Base de datos: PostgreSQL 16 + Redis
- Video: go2rtc + HLS.js + ffmpeg (H.264)
- IA: OpenAI GPT-4o + Anthropic Claude + ElevenLabs TTS
- Automatizacion: Motor interno + n8n (60 workflows)

---

## 2. Arquitectura del Sistema

```
[Dispositivos DVR/NVR/Camaras]
        |
        v
[go2rtc + MediaMTX] ──> [HLS.js Frontend]
        |
        v
[Fastify Backend API] ──> [PostgreSQL 16]
   |    |    |                    |
   |    |    └── [Redis Cache/PubSub]
   |    |
   |    └── [MCP Bridge: 79 tools]
   |              |
   |              v
   |         [AI Bridge] ──> OpenAI / Anthropic
   |              |
   |              v
   |         [Tool Calling Loop]
   |
   └── [Automation Engine] ──> [n8n 60 workflows]
              |
              v
         [Notifications: Email/WhatsApp/Push/Telegram]
```

---

## 3. Modulos del Sistema

### 3.1 Videovigilancia

| Funcion | Ruta Frontend | Endpoint Backend |
|---------|---------------|------------------|
| Vista en vivo (mosaico 1/4/9/16) | `/live-view` | `GET /streams`, go2rtc API |
| Reproduccion grabaciones | `/playback` | `GET /playback-requests` |
| Snapshots | `/cameras` | go2rtc `/api/frame.jpeg` |
| Estado de camaras | `/camera-health` | `GET /cameras` + health check |
| Clips de video | `/clips` | `GET /clips` |

**Mejores practicas:**
- Asegurar que todos los DVR/NVR tengan substream en H.264 (no H.265)
- go2rtc corre en puerto 1984 del VPS
- Streams se registran automaticamente via stream-bridge service

### 3.2 Control de Acceso

| Funcion | Ruta Frontend | Endpoint Backend |
|---------|---------------|------------------|
| Registro de residentes | `/access-control` | `GET/POST /access-control/people` |
| Registro de vehiculos | `/access-control` | `GET/POST /access-control/vehicles` |
| Logs de acceso | `/access-control` | `GET /access-control/logs` |
| Visitantes | `/visitors` | `GET/POST /visitors` |
| Pre-registro visitantes | `/visitors` | `GET/POST /pre-registrations` |

**Mejores practicas:**
- Siempre registrar documento de identidad y foto
- Verificar lista negra antes de permitir acceso
- Los logs de acceso se auditan automaticamente

### 3.3 Eventos e Incidentes

| Funcion | Ruta Frontend | Endpoint Backend |
|---------|---------------|------------------|
| Lista de eventos | `/events` | `GET /events` |
| Crear incidente | `/incidents` | `POST /incidents` |
| Timeline de incidente | `/incidents/:id` | `GET /incidents/:id` |
| Reconocer evento | - | MCP tool `acknowledge_event` |
| Cerrar incidente | - | MCP tool `close_incident` |

**Flujo de manejo de eventos:**
1. Evento llega (sensor, camara, n8n, manual)
2. Si es `critical` o `high` → automatizacion crea incidente
3. Operador recibe notificacion (push/WhatsApp/email)
4. Operador reconoce el evento
5. Investiga y documenta en timeline del incidente
6. Resuelve y cierra con notas de resolucion

### 3.4 Dispositivos e IoT

| Funcion | Ruta Frontend | Endpoint Backend |
|---------|---------------|------------------|
| Gestion de dispositivos | `/devices` | `GET/POST /devices` |
| Control domotico | `/domotics` | `GET/POST /domotics` |
| eWeLink (Sonoff) | `/domotics` | `GET/POST /ewelink` |
| Reboots remotos | - | `POST /reboots` |
| Control de relays | - | MCP tool `toggle_relay` |

**Tipos de dispositivos soportados:**
- Camaras IP (Hikvision, Dahua, ONVIF generico, IMOU)
- DVR/NVR (Hikvision, Dahua)
- Controles de acceso (ZKTeco, Hikvision)
- Dispositivos IoT (eWeLink/Sonoff: sirenas, relays, cerraduras)
- Intercomunicadores (SIP/Asterisk)

### 3.5 Alertas y Automatizaciones

| Funcion | Ruta Frontend | Endpoint Backend |
|---------|---------------|------------------|
| Reglas de alerta | `/alerts` | `GET/POST /alerts/rules` |
| Instancias de alerta | `/alerts` | `GET /alerts/instances` |
| Politicas de escalamiento | `/alerts` | `GET/POST /alerts/escalation-policies` |
| Reglas de automatizacion | `/automation` | `GET/POST /automation/rules` |
| Historial ejecuciones | `/automation` | `GET /automation/executions` |

**Tipos de trigger de automatizacion:**
- `event` — cuando llega un evento especifico
- `schedule` — programado (hora, dia de semana)
- `device_status` — cambio de estado de dispositivo
- `threshold` — umbral numerico superado

**Tipos de accion de automatizacion:**
- `send_alert` — email + push notification
- `create_incident` — crear incidente automatico
- `send_whatsapp` — mensaje WhatsApp
- `webhook` — POST a URL externa (n8n)
- `toggle_device` — control de dispositivo
- `activate_protocol` — activar protocolo de emergencia
- `execute_mcp_tool` — ejecutar cualquiera de los 79 MCP tools

### 3.6 Inteligencia Artificial

| Funcion | Ruta Frontend | Endpoint Backend |
|---------|---------------|------------------|
| Chat con IA | `/ai-assistant` | `POST /ai/chat/stream` |
| Asistente flotante | Todas las paginas | `POST /ai/chat/stream` |
| Skills operacionales | `/skills` | `GET/POST /skills` |
| Resumen de turno | - | `GET /ai/shift-summary` |

**Modos de contexto del asistente:**
1. General — asistente general
2. Camaras — videovigilancia
3. IoT — dispositivos inteligentes
4. Acceso — control de acceso
5. Residentes — gestion de residentes
6. Vehiculos — control vehicular
7. Incidentes — gestion de incidentes
8. Analiticas — reportes y analisis
9. Configuracion — configuracion del sistema

**Tool calling:** El AI puede ejecutar 79 MCP tools automaticamente (crear incidentes, enviar alertas, controlar dispositivos, consultar base de datos, etc.)

### 3.7 Voz

| Funcion | Ubicacion | Tecnologia |
|---------|-----------|------------|
| Entrada de voz (STT) | Asistente flotante | Web Speech API (es-CO) |
| Salida de voz (TTS) | Asistente flotante | ElevenLabs (backend) + browser fallback |
| IVR telefonico | Intercom | Asterisk + ElevenLabs/Edge-TTS |
| Llamadas SIP | `/phone-panel` | SIP.js + WebRTC |

**Flujo de voz en asistente:**
1. Clic en microfono → Web Speech API escucha
2. Transcripcion automatica a texto
3. Texto enviado a AI Bridge (streaming)
4. Respuesta de AI recibida
5. Si auto-speak ON: ElevenLabs sintetiza audio (o browser TTS como fallback)

**Configuracion de voz:**
- `ELEVENLABS_API_KEY` — clave de ElevenLabs (opcional)
- `ELEVENLABS_DEFAULT_VOICE_ID` — voz por defecto (Rachel: 21m00Tcm4TlvDq8ikWAM)
- `OPENAI_API_KEY` — para Whisper STT en IVR

### 3.8 Reportes y Analiticas

| Funcion | Ruta Frontend | Endpoint Backend |
|---------|---------------|------------------|
| Reportes manuales | `/reports` | `GET/POST /reports` |
| Reportes programados | `/scheduled-reports` | `GET/POST /scheduled-reports` |
| Analiticas | `/analytics` | `GET /analytics` |
| KPIs | `/dashboard` | MCP tool `getKpis` |
| Mapa de calor | `/heat-map` | `GET /heat-mapping` |

### 3.9 n8n Automatizaciones

**URL:** aionseg.co/n8n (o IP directa del VPS)
**Workflows activos:** 60
**Webhooks:** 9 tipos en `/webhooks/n8n/{type}`

**Tipos de webhook:**
1. `event` — evento de seguridad
2. `incident` — incidente creado/actualizado
3. `device-status` — cambio de estado de dispositivo
4. `visitor` — registro de visitante
5. `door-request` — solicitud de apertura
6. `security-alert` — alerta de seguridad
7. `health-report` — reporte de salud
8. `patrol-checkpoint` — checkpoint de patrulla
9. `emergency-activate` — activacion de emergencia

**Enviar datos a AION desde n8n:**
```json
POST /webhooks/n8n/security-alert
Headers: { "x-webhook-secret": "<N8N_WEBHOOK_SECRET>" }
Body: {
  "severity": "critical",
  "description": "Intrusion detectada en zona norte"
}
```

### 3.10 MCP (Model Context Protocol)

**79 herramientas registradas en 22 categorias:**

| Categoria | Tools | Descripcion |
|-----------|:-----:|-------------|
| Database Read | 5 | Consultar eventos, incidentes, dispositivos, dashboards |
| Incident Management | 5 | Crear, actualizar, cerrar incidentes, timeline |
| Device Commands | 5 | Abrir puertas, reiniciar, toggle relay, estado |
| Notifications | 5 | Email, WhatsApp (Meta + Twilio), push, historial |
| Access Control | 3 | Buscar residentes, vehiculos, estadisticas |
| Visitors | 4 | Buscar, registrar, estadisticas, lista negra |
| Alerts | 2 | Consultar y reconocer alertas |
| Emergency | 3 | Protocolos, contactos, activacion |
| Operations | 3 | Turnos, patrullas, SLA |
| Automation | 3 | Reglas, toggle, ejecuciones |
| eWeLink | 4 | Listar, toggle, sirena, puerta |
| Hikvision ISAPI | 5 | Test, info, canales, HDD, PTZ |
| Camera Streams | 4 | Listar, estado go2rtc, resumen, snapshots |
| Reports | 3 | Generar, KPIs, analiticas |
| Knowledge Base | 2 | Buscar, agregar articulos |
| Compliance | 3 | Estado, certificaciones, vencimientos |
| Management | 6 | Contratos, llaves, asignacion, estadisticas |
| Anomaly Detection | 2 | Detectar anomalias, baseline |
| Event Actions | 3 | Reconocer, bulk ack, descartar |
| AI Summaries | 2 | Resumen de incidentes, resumen de turno |
| System Health | 3 | Health check, conteos DB, audit logs |
| Remote Access | 3 | Mapa de acceso, port forwarding, test conectividad |

---

## 4. Gestion de Errores

### 4.1 Frontend

**ErrorBoundary global:**
- `src/components/shared/AppErrorBoundary.tsx` envuelve todas las rutas
- Captura errores de JavaScript en el arbol de componentes
- Muestra UI de error con boton "Reintentar"
- Maximo 3 reintentos antes de sugerir contactar soporte

**Patron de manejo por pagina:**
```tsx
const { data, isLoading, isError, refetch } = useQuery(...);
if (isLoading) return <Skeleton />;
if (isError) return <ErrorState onRetry={refetch} />;
if (!data?.length) return <EmptyState title="No hay datos" />;
```

**Errores de API:**
- 401: Token expirado → auto-refresh via apiClient
- 403: Sin permisos → mensaje al usuario
- 404: Recurso no encontrado → pagina 404
- 500: Error del servidor → retry automatico (3 intentos)

### 4.2 Backend

**Error handler centralizado:** `backend/apps/backend-api/src/middleware/error-handler.ts`
- Errores Zod → 422 con detalle de campos
- NotFoundError → 404
- Errores genericos → 500 (sin leak de info en produccion)

**Errores en workers:**
- Automation engine: error por regla no detiene el motor (aislamiento)
- Notification dispatcher: error por canal no detiene otros canales
- Backup worker: retry con backoff

**Errores en MCP tools:**
- Cada tool retorna `{ error: string }` en caso de fallo
- Tool execution logueada a audit_logs con status success/failed
- AI Bridge maneja errores de tools y continua la conversacion

### 4.3 Errores Comunes y Soluciones

| Error | Causa | Solucion |
|-------|-------|----------|
| "Token expirado" | JWT vencido | Se auto-renueva. Si persiste: re-login |
| "Error de conexion" | Backend caido | Verificar PM2: `pm2 status` |
| "Device offline" | Dispositivo sin red | Verificar red fisica, ping al dispositivo |
| "Stream no disponible" | go2rtc sin stream | Verificar `curl http://localhost:1984/api/streams` |
| "WhatsApp no enviado" | Token Meta/Twilio | Verificar tokens en .env del VPS |
| "Email no enviado" | Config Resend/SendGrid | Verificar API key y dominio verificado |
| "Automation failed" | Regla mal configurada | Revisar logs: `pm2 logs aionseg-api --lines 100` |
| "AI no responde" | API key invalida | Verificar OPENAI_API_KEY o ANTHROPIC_API_KEY |
| "Base de datos lenta" | Queries sin index | Verificar indices con `EXPLAIN ANALYZE` |

---

## 5. Operaciones Diarias

### 5.1 Monitoreo

**Verificar salud del sistema:**
```bash
# Desde cualquier lugar
curl -sf https://aionseg.co/api/health/ready

# En el VPS
pm2 status                    # Ver todos los servicios
pm2 logs aionseg-api --lines 50  # Ver logs recientes
```

**Dashboard de monitoreo:**
- Prometheus: metricas en `/health/metrics`
- 19 alertas configuradas (service down, error rate, latency, disk, memory, CPU, SSL, devices, DB, Redis, WebSocket)

### 5.2 Backup

**Backup automatico:**
- Worker `backup-worker.ts` ejecuta backups periodicos
- Retencion: diario (7 dias), semanal (4 semanas), mensual (12 meses)
- Pendiente: configurar AWS S3 para offsite

**Backup manual:**
```bash
ssh ubuntu@18.230.40.6
pg_dump aionseg_prod > backup_$(date +%Y%m%d).sql
```

### 5.3 Actualizacion de la plataforma

```bash
# En el VPS
cd /var/www/aionseg
git pull origin main
cd backend && pnpm install && pnpm build
pm2 restart all
```

### 5.4 Reinicio de servicios

```bash
# Reiniciar todo
pm2 restart all

# Reiniciar solo el backend API
pm2 restart aionseg-api

# Reiniciar go2rtc
pm2 restart go2rtc

# Ver logs de un servicio especifico
pm2 logs face-recognition --lines 50
```

---

## 6. Configuracion

### 6.1 Variables de Entorno Criticas

| Variable | Descripcion | Obligatoria |
|----------|-------------|:-----------:|
| `DATABASE_URL` | Conexion PostgreSQL | Si |
| `JWT_SECRET` | Secreto para tokens (min 32 chars) | Si |
| `CORS_ORIGINS` | Origenes permitidos (sin wildcard) | Si |
| `CREDENTIAL_ENCRYPTION_KEY` | AES-256-GCM para credenciales | Si (prod) |
| `OPENAI_API_KEY` | GPT-4o + Whisper STT | No |
| `ANTHROPIC_API_KEY` | Claude Sonnet 4 | No |
| `ELEVENLABS_API_KEY` | TTS de alta calidad | No |
| `RESEND_API_KEY` | Email transaccional | No |
| `TWILIO_ACCOUNT_SID` | SMS/Calls/WhatsApp | No |
| `TELEGRAM_BOT_TOKEN` | Alertas Telegram | No |
| `N8N_WEBHOOK_SECRET` | Autenticacion n8n | Si (si usa n8n) |

### 6.2 Configuracion de Automatizaciones

**Crear una regla de automatizacion:**
1. Ir a `/automation` en el frontend
2. Clic "Crear regla"
3. Configurar trigger (tipo de evento, severidad)
4. Agregar condiciones (filtros opcionales)
5. Agregar acciones (alerta, incidente, WhatsApp, webhook, MCP tool)
6. Activar la regla

**Ejemplo: Alerta critica → Crear incidente + WhatsApp + Sirena:**
```json
{
  "name": "Intrusion critica automatica",
  "trigger": { "type": "event", "eventType": "intrusion" },
  "conditions": [{ "field": "severity", "operator": "eq", "value": "critical" }],
  "actions": [
    { "type": "create_incident", "config": { "title": "Intrusion detectada", "priority": "critical" } },
    { "type": "send_whatsapp", "config": { "phones": ["+573001234567"], "message": "ALERTA: Intrusion detectada" } },
    { "type": "execute_mcp_tool", "config": { "toolName": "activate_siren", "params": { "duration": 30 } } }
  ],
  "cooldownMinutes": 5,
  "isActive": true
}
```

### 6.3 Configuracion de Voz

**ElevenLabs (TTS de alta calidad):**
1. Crear cuenta en elevenlabs.io
2. Obtener API key en Settings → API Keys
3. Agregar a `.env`: `ELEVENLABS_API_KEY=tu_key`
4. Reiniciar: `pm2 restart aionseg-api`

**Verificar que funciona:**
```bash
curl -sf https://aionseg.co/api/voice/health | jq
```

### 6.4 Configuracion de n8n

**Crear un workflow que envia datos a AION:**
1. Agregar nodo "Webhook" como trigger
2. Agregar nodo "HTTP Request" al final con:
   - URL: `https://aionseg.co/webhooks/n8n/security-alert`
   - Method: POST
   - Headers: `x-webhook-secret: <tu_secreto>`
   - Body: `{ "severity": "high", "description": "Descripcion del evento" }`

---

## 7. Seguridad

### 7.1 Autenticacion

- JWT con refresh tokens (scrypt hash, timing-safe compare)
- Password policy: min 12 chars, mayuscula, minuscula, digito, caracter especial
- API keys con role fijo (operator)
- WebSocket autenticado via JWT (query param o primer mensaje)

### 7.2 Autorizacion

- RBAC: super_admin, tenant_admin, operator, viewer
- `requireRole()` en todas las rutas protegidas
- Tenant isolation automatico (JWT contiene tenant_id)

### 7.3 Encriptacion

- Credenciales de dispositivos: AES-256-GCM
- Contraseñas: scrypt + salt aleatorio 32 bytes
- Comunicacion: HTTPS/TLS via Caddy/Nginx

### 7.4 Auditoria

- 179+ puntos de audit logging
- Registra: usuario, accion, entidad, IP, user-agent
- Indexado para consultas rapidas
- Accesible via `/audit` y MCP tool `get_recent_audit_logs`

---

## 8. Integracion de los 7 Repositorios (Claude Code)

### 8.1 Herramientas Instaladas

| Herramienta | Tipo | Cantidad | Uso |
|-------------|------|:--------:|-----|
| Context7 | MCP Server | 1 | Documentacion de librerias en tiempo real |
| Superpowers | Skills | 10 | TDD, debugging, brainstorming, code review |
| UI/UX Pro Max | Skills | 2 | 50+ estilos, 97 paletas, 99 UX guidelines |
| Everything Claude Code | Agentes+Skills+Comandos | 10+11+15 | Framework completo de desarrollo |
| Claude-Mem | MCP Server | 1 | Memoria persistente entre sesiones |
| n8n-MCP | MCP Server | 1 | Gestion de workflows n8n |
| Obsidian Skills | Skills | 5 | Documentacion, JSON Canvas |

### 8.2 Comandos Disponibles

- `/build-fix` — diagnosticar y arreglar errores de build
- `/code-review` — revision de codigo
- `/tdd` — desarrollo guiado por tests
- `/verify` — verificacion completa del sistema
- `/plan` — crear plan de implementacion
- `/checkpoint` — guardar punto de control
- `/test-coverage` — analizar cobertura de tests
- `/update-docs` — actualizar documentacion

### 8.3 Workflow Recomendado

1. **Antes de codificar:** `/plan` para crear plan
2. **Durante desarrollo:** `/tdd` para escribir tests primero
3. **Despues de cambios:** `/verify` para validar todo
4. **Antes de commit:** `/code-review` para revision

---

## 9. Troubleshooting

### 9.1 El dashboard no carga datos
1. Verificar que el backend esta corriendo: `pm2 status`
2. Verificar conexion a DB: `curl https://aionseg.co/api/health/ready`
3. Verificar logs: `pm2 logs aionseg-api --lines 50`

### 9.2 Las camaras no muestran video
1. Verificar go2rtc: `curl http://localhost:1984/api/streams`
2. Verificar que el stream esta registrado
3. Verificar codec (debe ser H.264, no H.265)
4. Verificar red: `ping <ip_dispositivo>`

### 9.3 Las notificaciones no llegan
1. Email: verificar `RESEND_API_KEY` en .env
2. WhatsApp: verificar tokens de Twilio/Meta
3. Push: verificar `VAPID_PUBLIC_KEY` y subscripciones
4. Telegram: verificar `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`

### 9.4 La automatizacion no se dispara
1. Verificar que la regla esta activa: `/automation`
2. Verificar cooldown (puede estar en periodo de enfriamiento)
3. Verificar condiciones: el evento debe coincidir con el trigger
4. Ver logs: `pm2 logs aionseg-api --lines 100 | grep automation`

### 9.5 El asistente AI no responde
1. Verificar que `OPENAI_API_KEY` o `ANTHROPIC_API_KEY` estan en .env
2. Verificar creditos/cuota en el dashboard del proveedor
3. Verificar logs: `pm2 logs aionseg-api --lines 50 | grep ai-bridge`

### 9.6 La voz no funciona
1. **Entrada de voz:** Verificar permisos del microfono en el navegador
2. **Salida de voz (ElevenLabs):** `curl https://aionseg.co/api/voice/health`
3. **Salida de voz (browser):** Verificar que el navegador soporta SpeechSynthesis
4. **SIP/Llamadas:** Verificar conexion Asterisk: `asterisk -rvvv`

---

## 10. Contacto y Soporte

- **VPS:** 18.230.40.6 (SSH: `ssh -i clave-demo-aion.pem ubuntu@18.230.40.6`)
- **Dominio:** aionseg.co (Cloudflare DNS)
- **Repositorio:** open-view-hub-main
- **PM2 Services:** 19 servicios activos
- **Base de datos:** 143 tablas, 11,500+ registros
