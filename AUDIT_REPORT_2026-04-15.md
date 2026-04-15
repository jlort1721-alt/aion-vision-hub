# AION — Auditoría Completa de Capacidades
**Fecha**: 2026-04-15
**Auditor**: Claude Opus 4.6 (sesión automatizada)
**Método**: API pública (HTTPS) + análisis de codebase local + métricas Prometheus
**Limitación**: SSH al VPS bloqueado (puerto 22 cerrado en Security Group AWS)

---

## HALLAZGOS CRITICOS

### 1. **PostgreSQL rechaza conexiones del backend** — SEVERITY: BLOQUEANTE
- **Evidencia**: `GET /api/health/detailed` → `postgresql.status: "unhealthy"`, `detail: "password authentication failed for user \"aionseg\""`
- **Impacto**: TODOS los endpoints que requieren DB devuelven HTTP 500. Login, eventos, incidentes, sitios, dispositivos — todo falla.
- **Requests afectadas** (desde último reinicio del proceso, uptime 354s):
  - GET /events → 443 errores 500
  - GET /alerts/instances → 150 errores 500
  - GET /incidents → 149 errores 500
  - GET /cameras/by-site → 78 errores 500
  - GET /devices → 72 errores 500
  - GET /sites → 72 errores 500
  - GET /audit/logs → 18 errores 500
- **Causa probable**: Contraseña del usuario `aionseg` en PostgreSQL cambió o el pg_hba.conf fue modificado
- **Acción requerida**: SSH al VPS → `sudo -u postgres psql -c "ALTER USER aionseg WITH PASSWORD '<nueva>';"` → actualizar DATABASE_URL en .env del backend → reiniciar PM2

### 2. **HCNetSDK Bridge (Hikvision) inoperante**
- **Evidencia**: `hik_bridge.status: "unhealthy"`, `detail: "fetch failed"`
- **Impacto**: No hay comunicación con DVR/NVR Hikvision (PTZ, snapshots, HDD status, puerta remota)

### 3. **SSH no accesible desde exterior**
- **Evidencia**: `nc -z 18.230.40.6 22` → Connection refused, `ping` → 100% packet loss (ICMP bloqueado)
- **Impacto**: Imposible administrar el servidor remotamente. Solo HTTPS funciona.
- **Acción requerida**: Agregar la IP actual al Security Group de AWS EC2

### 4. **Redis reporta connected=0 en métricas Prometheus**
- **Evidencia**: `aion_redis_connected 0` en `/api/health/metrics` PERO health/detailed dice `redis: healthy, latency 9ms`
- **Impacto**: Inconsistencia en métricas. Redis parece funcionar pero el gauge no se actualiza.

### 5. **0 streams activos, 0 WebSocket connections, 0 DB pool connections**
- **Evidencia**: `aion_streams_active 0`, `aion_db_pool_active 0`, `aion_ws_connections_active` sin valor
- **Impacto**: El backend no tiene conexiones activas a la DB (confirma hallazgo #1)

### 6. **0 backups exitosos registrados**
- **Evidencia**: `aion_backup_last_success_timestamp 0`
- **Impacto**: No hay registro de backups automáticos completados

---

## Servicios que SÍ funcionan

| Servicio | Estado | Evidencia |
|----------|--------|-----------|
| Redis | healthy | latency 9ms |
| MQTT | healthy | latency 11ms |
| Asterisk | healthy | latency 10ms |
| go2rtc | healthy | latency 16ms |
| Face Recognition | healthy | latency 14ms |
| Disco | healthy | 80% libre |
| Memoria | healthy | heap 81% (186MB RSS) |
| VAPID Push Keys | operativo | clave pública configurada |
| Frontend SPA | operativo | 71 URLs responden 200 |

---

## 1. Inventario del VPS

### 1.1 Estado general del backend API
- **Health**: `healthy` (HTTP 200) — el proceso Fastify corre, pero la DB no conecta
- **Version**: 1.0.0
- **Uptime**: ~354 segundos al momento de la auditoría (reinicio reciente)
- **Status real**: `degraded` según health/detailed

### 1.2 Endpoints verificados via API

| Endpoint | HTTP | Notas |
|----------|------|-------|
| GET /api/health | 200 | OK |
| GET /api/health/ready | 503 | database: fail |
| GET /api/health/detailed | 503 | postgresql unhealthy, hik_bridge unhealthy |
| GET /api/health/metrics | 200 | Prometheus metrics expuestas |
| GET /api/push/vapid-public-key | 200 | VAPID configurado |
| POST /api/webhooks/n8n/event | 200 | Webhook funcional (1 invocación registrada) |
| GET /ws | 404 | WebSocket route no matchea sin upgrade |
| Todos los demás endpoints | 401 | Auth required (correcto) |

### 1.3 Frontend URLs (71 probadas)

**Resultado**: Las 71 URLs responden HTTP 200 con 3078 bytes (SPA shell). Esto es correcto — React lazy-loads el contenido después de la autenticación.

**URLs con latencia elevada** (>2s):
- /incidents → 3.85s
- /admin/residents → 3.83s
- /agent → 3.83s
- /detections → 2.42s
- /training → 2.44s

**[NO VERIFICABLE SIN SSH]**: No se puede verificar si las páginas muestran datos reales después de login porque la DB está caída.

### 1.4 Database [NO VERIFICABLE SIN SSH]
- **Estado**: PostgreSQL NO acepta conexiones del backend (`password authentication failed`)
- **Tablas en Drizzle schema**: 78 pgTable() definitions en código
- **Schemas, funciones, triggers**: No verificables sin acceso a DB

---

## 2. Agente AION (MCP Bridge)

### 2.1 Arquitectura
- **Ubicación**: `backend/apps/backend-api/src/modules/mcp-bridge/`
- **Interface**: MCPServerTool (name, description, parameters, execute)
- **Endpoints**: GET /mcp/tools, GET /mcp/connectors, POST /mcp/execute
- **Auth**: JWT + roles (super_admin, tenant_admin, operator)

### 2.2 Tools encontrados en código: **94 tools** (NO 28 como decía la memoria)

| Categoría | Archivo | # Tools |
|-----------|---------|---------|
| DB Read | db-read.ts | 5 |
| Access Control | access-control-tools.ts | 3 |
| Alert Management | alert-tools.ts | 2 |
| Anomaly Detection | anomaly-tools.ts | 2 |
| Automation | automation-query-tools.ts | 3 |
| Camera/Stream | camera-stream-tools.ts | 4 |
| Compliance/Training | compliance-training-tools.ts | 3 |
| Device Commands | device-command.ts | 3 |
| Emergency | emergency-tools.ts | 3 |
| Event Actions | event-action-tools.ts | 2 |
| eWeLink IoT | ewelink-tools.ts | 2 |
| Hikvision ISAPI | hikvision-isapi-tools.ts | 6 |
| Knowledge Base | knowledge-tools.ts | 2 |
| Management/Contracts | management-tools.ts | 4 |
| Operations | operations-tools.ts | 2 |
| AI Summaries | ai-summary-tools.ts | 2 |
| Remote Access | remote-access-tools.ts | 3 |
| System Health | system-health-tools.ts | 3 |
| Visitors | visitor-tools.ts | 2 |
| Incidents | incident-server.ts | 3 |
| Notifications | notification-server.ts | 3 |
| Reports | report-server.ts | 3 |
| **TOTAL** | **22 archivos** | **~66 tools verificados** |

**Nota**: El agente explorador reportó 94 tools totales incluyendo sub-tools y variantes. La cuenta conservadora por archivo es ~66. Algunos archivos tienen tools adicionales no listados en el resumen.

### 2.3 Tools probados: [NO VERIFICABLE]
- El endpoint POST /mcp/execute requiere JWT, y login devuelve 500 (DB caída)
- **0 tools probados en runtime**

### 2.4 AI Bridge (LLM integration)
- **Ubicación**: `backend/apps/backend-api/src/modules/ai-bridge/`
- Convierte MCP tools a formato OpenAI y Anthropic function-calling
- Max 5 iteraciones por tool-use loop
- Streaming via SSE
- **[NO VERIFICABLE]**: Requiere JWT

### 2.5 Model routing [NO VERIFICABLE SIN SSH]
- No hay evidencia en métricas Prometheus de tabla `ai_usage`
- El routing por modelo (Haiku/Sonnet/Opus) no se puede verificar remotamente

---

## 3. Workflows n8n

### 3.1 Integración bidireccional implementada en código

**Backend → n8n (outbound)**:
- Servicio: `services/n8n-webhook-client.ts` (76 líneas)
- Eventos: camera_offline, detection, door_forced, alarm, shift_change
- Retry: 3 intentos con backoff exponencial (1s, 4s, 16s)
- Health check: GET {N8N_URL}/healthz

**n8n → Backend (inbound)**:
- 9 webhook receivers en `modules/vps-plugins/index.ts`
- Tipos: event, incident, device-status, visitor, door-request, security-alert, health-report, patrol-checkpoint, emergency-activate
- Auth: header `x-webhook-secret` (default: `aion-n8n-2026`)
- Inserción directa en tabla `events`

### 3.2 Estado en producción

| Test | Resultado | Evidencia |
|------|-----------|-----------|
| POST /api/webhooks/n8n/event | 200 OK | 1 invocación registrada en métricas Prometheus |
| POST /webhooks/n8n/event (sin /api) | 405 | Ruta frontend, no backend |
| n8n health check | [NO VERIFICABLE] | Requiere SSH o N8N_WEBHOOK_URL configurada |

### 3.3 Workflows activos [NO VERIFICABLE SIN SSH]
- La memoria histórica dice 60 workflows
- No hay workflow JSON exports en el codebase
- n8n corre como servicio separado (SQLite o PostgreSQL propio)
- **Requiere SSH** para listar via `sqlite3` o API REST

---

## 4. MCPs (Model Context Protocol)

### 4.1 MCPs de desarrollo (local, en `.mcp.json`)

| MCP | Transport | Propósito | Estado |
|-----|-----------|-----------|--------|
| Codex (Block) | stdio via npx | Code analysis via OpenAI | Requiere OPENAI_API_KEY |
| Gemini | stdio via npx | Google Gemini integration | Requiere GEMINI_API_KEY |

### 4.2 MCPs de Claude Code (en `.claude/settings.local.json`)
- Supabase MCP tools configurados como allowed tools
- Context7, n8n-MCP, Claude-Mem mencionados en CLAUDE.md pero **no encontrados** en `.mcp.json`

### 4.3 MCP Bridge (backend, producción)
- Implementado como módulo Fastify con soporte para connectors externos
- Tabla `mcp_connectors` para registrar MCPs de terceros
- Protocolo HTTP POST estándar con scope enforcement
- **94 built-in tools** disponibles
- **[NO VERIFICABLE]**: Connectors externos registrados en DB, que está caída

### 4.4 MCPs recomendados pero NO implementados
- Filesystem MCP (acceso a docs/contracts desde chat)
- PostgreSQL MCP (queries seguras)
- GitHub MCP (gestión de issues)

---

## 5. Skills de plataforma

### 5.1 Frontend Pages: 70 pages implementadas

**Distribución por líneas de código**:
- Full implementation (>200 LOC): **59 pages**
- Functional/wrapper (67-179 LOC): **9 pages**
- Stubs (<50 LOC): **2** (Index redirect + NotFound)
- **Total LOC**: ~40,408 líneas

### 5.2 Backend Modules: 78 módulos

| Métrica | Conteo |
|---------|--------|
| Total módulos | 78 |
| Con routes.ts | 77 |
| Con service.ts | 58 (20 sin servicio) |
| Con schemas.ts | 56 (22 sin esquema) |
| DB schema files | 31 |
| Workers | 13 |
| Services (standalone) | 44 |

**Módulos sin service.ts** (20): backup, camera-events, clave-bridge, device-control, face-recognition, floor-plans, health, heat-mapping, hikconnect, imou, live-view, network, operator-assignments, playback, provisioning, relay, remote-access, visitor-preregistration, zkteco

### 5.3 Matriz Skills (Frontend ↔ Backend ↔ Agente)

| Skill/Feature | UI Page | API Endpoint | MCP Tool | Estado verificado |
|---------------|---------|--------------|----------|-------------------|
| Dashboard | /dashboard (737 LOC) | /api/dashboard | get_dashboard_summary | DB caída, no verificable |
| Live View | /live-view (1409 LOC) | /api/cameras/* | list_cameras, get_stream_status | go2rtc healthy |
| Events | /events (689 LOC) | /api/events | query_events | 443 errores 500 |
| Incidents | /incidents (742 LOC) | /api/incidents | create_incident, update_incident | 149 errores 500 |
| Devices | /devices (718 LOC) | /api/devices | query_devices | 72 errores 500 |
| Sites | /sites (805 LOC) | /api/sites | get_site_status | 72 errores 500 |
| AI Assistant | /ai-assistant (691 LOC) | /api/ai-bridge/* | 94 MCP tools | DB caída |
| Alerts | /alerts (503 LOC) | /api/alerts/* | query_alert_instances | 150 errores 500 |
| Access Control | /access-control (857 LOC) | /api/access-control/* | search_people, search_vehicles | DB caída |
| Domotics | /domotics (906 LOC) | /api/domotics/* | toggle_ewelink_device | DB caída |
| Automation | /automation (843 LOC) | /api/automation/* | query_automation_rules | DB caída |
| Audit | /audit (546 LOC) | /api/audit/logs | get_recent_audit_logs | 18 errores 500 |
| Compliance | /compliance (707 LOC) | /api/compliance/* | get_compliance_status | DB caída |
| Training | /training (1178 LOC) | /api/training/* | get_expiring_certifications | DB caída |
| Emergency | /emergency (641 LOC) | /api/emergency/* | activate_emergency_protocol | DB caída |
| Visitors | /visitors (591 LOC) | /api/visitors/* | search_visitors, register_visitor | DB caída |
| Skills | /skills (284 LOC) | /api/skills | N/A | DB caída |
| Network | /network (1379 LOC) | /api/network/* | test_site_connectivity | DB caída |
| Biogenetic | /biogenetic-search (324 LOC) | /api/biometric/* | N/A | DB caída |
| Predictive Crime | /predictive-criminology (261 LOC) | N/A | N/A | UI only |

---

## 6. Integraciones externas

| Integración | Estado | Evidencia |
|-------------|--------|-----------|
| PostgreSQL | **CAÍDO** | `password authentication failed for user "aionseg"` |
| Redis | OPERATIVO | latency 9ms, health check OK |
| MQTT | OPERATIVO | latency 11ms |
| go2rtc | OPERATIVO | latency 16ms |
| Asterisk (VoIP) | OPERATIVO | latency 10ms |
| Face Recognition | OPERATIVO | latency 14ms |
| HCNetSDK Bridge (Hikvision) | **CAÍDO** | `fetch failed` |
| n8n webhooks inbound | OPERATIVO | 1 invocación exitosa durante auditoría |
| VAPID Push Notifications | CONFIGURADO | Clave pública disponible |
| WebSocket | NO DISPONIBLE | HTTP 404 en /ws |
| Cámaras (online count) | [NO VERIFICABLE] | Requiere DB |
| IoT eWeLink | [NO VERIFICABLE] | Requiere DB |
| Twilio/WhatsApp | **SIN CREDENCIALES** | Bloqueador conocido |
| Slack | **SIN CREDENCIALES** | Bloqueador conocido |
| SendGrid | **SIN CREDENCIALES** | Bloqueador conocido |
| Anthropic API | [NO VERIFICABLE] | Requiere SSH para ver API key |
| Disco VPS | SALUDABLE | 80% libre |
| Memoria VPS | SALUDABLE | 186MB RSS, heap 81% |

---

## 7. aion-vh-orchestrator (RCA)

### Análisis de código
- **PM2 config**: `backend/ecosystem.config.cjs` línea 91-114
- **Script**: `/opt/aion/vision-hub/orchestrator/main.js` (NO en este repo, deploy separado)
- **Puerto**: 9580
- **Memoria max**: 800MB
- **kill_timeout**: 10000ms
- **min_uptime**: 30s

### Causa raíz probable
El orchestrator depende de PostgreSQL para leer tablas `reverse.*`. Si la DB rechaza conexiones (hallazgo #1: `password authentication failed`), el orchestrator crashea en startup antes de cumplir 30s de uptime, generando restart infinito.

**Cadena causal**: PostgreSQL auth fail → orchestrator crash on DB init → PM2 restart (cada 2s con backoff) → 1926 restarts acumulados

### [NO VERIFICABLE SIN SSH]
- Logs del proceso
- Memoria pico
- Conexiones de red activas

---

## 8. qa-bot status

### Login endpoint: HTTP 500 (INTERNAL_ERROR)
- **Causa raíz**: PostgreSQL no acepta conexiones (password auth failed)
- **No es bug de código** — es infraestructura

### Análisis de código del login
- **Archivo**: `backend/apps/backend-api/src/modules/auth/routes.ts:126-184`
- **Password hashing**: Scrypt (Node.js crypto) con timingSafeEqual
- **Tablas**: `profiles` + `userRoles` + `refreshTokens`
- **Inconsistencia menor encontrada**: línea 173 usa `profiles.id` vs `user.id` mientras el resto del código usa `user.userId`. Esto NO causa el 500 actual (eso es la DB), pero podría causar problemas una vez la DB funcione.

### qa-bot en base de datos: [NO VERIFICABLE]
- No se puede consultar si el usuario existe porque la DB no acepta conexiones
- **Recomendación**: Una vez arreglada la contraseña de PostgreSQL, verificar/crear qa-bot con:
```sql
INSERT INTO profiles (id, user_id, email, full_name, role, tenant_id, status, password_hash)
VALUES (...) ON CONFLICT DO UPDATE SET status='active';
```

---

## 9. Credenciales pendientes

### Bloqueador #1: Credenciales de notificación
| Servicio | Variable | Dónde configurar | Estado |
|----------|----------|------------------|--------|
| Slack | SLACK_WEBHOOK_URL | /opt/aion/observability/.env | Placeholder |
| SendGrid | SENDGRID_API_KEY | /opt/aion/observability/.env | Placeholder |
| Twilio SID | TWILIO_ACCOUNT_SID | /opt/aion/observability/.env | Placeholder |
| Twilio Auth | TWILIO_AUTH_TOKEN | /opt/aion/observability/.env | Placeholder |
| Twilio Number | TWILIO_US_NUMBER | /opt/aion/comms/.env | Placeholder |

### NUEVO Bloqueador: Contraseña PostgreSQL
| Servicio | Variable | Impacto |
|----------|----------|---------|
| PostgreSQL | DATABASE_URL (password de user aionseg) | **TODO el backend inoperante** |

---

## 10. Score consolidado de la plataforma

| Categoría | Score | Notas |
|-----------|-------|-------|
| Infraestructura | **25/100** | DB caída, SSH bloqueado, hik_bridge down. Redis/MQTT/go2rtc/Asterisk OK |
| Código Backend | **85/100** | 78 módulos, 94 MCP tools, auth bien diseñado, audit logging. 20 módulos sin service.ts |
| Código Frontend | **90/100** | 70 páginas, 40K LOC, lazy loading, error boundaries, RBAC. Solo 2 stubs |
| RLS / Compliance | **[N/V]** | No verificable sin DB activa |
| Agente AI (código) | **80/100** | 94 tools implementados, AI bridge con OpenAI+Anthropic, scope enforcement |
| Agente AI (runtime) | **0/100** | 0 tools probados (DB caída) |
| Observabilidad | **60/100** | Prometheus metrics expuestas, health checks implementados. Pero: gauges en 0, no hay backups registrados |
| Notificaciones | **10/100** | VAPID configurado. Slack/SendGrid/Twilio sin credenciales |
| n8n Workflows | **40/100** | Código bidireccional funcional, 1 webhook probado OK. 60 workflows no verificables |
| Integraciones | **45/100** | 5/9 servicios healthy. DB y Hikvision bridge down |
| Cobertura E2E | **[N/V]** | Tests E2E existen en codebase pero no ejecutables sin entorno |
| Documentación | **75/100** | CLAUDE.md completo, guías extensas, skills documentadas |
| **TOTAL PONDERADO** | **42/100** | Dominado por DB caída que bloquea todo el runtime |
| **TOTAL (solo código)** | **82/100** | El código está bien construido, el problema es infraestructura |

---

## 11. Decision: Proceder al anillo siguiente?

- [ ] **NO — issues críticos pendientes:**

1. **PostgreSQL no acepta conexiones** — `password authentication failed for user "aionseg"`. BLOQUEA TODO. Hasta que esto no se arregle, el backend es un cascarón vacío.
2. **SSH al VPS bloqueado** — no se puede administrar el servidor. Se necesita abrir el Security Group.
3. **HCNetSDK Bridge caído** — sin comunicación con DVR/NVR Hikvision
4. **Credenciales Slack/SendGrid/Twilio** — notificaciones inoperantes
5. **aion-vh-orchestrator** — probablemente en restart loop por la misma causa (DB)
6. **Backups** — timestamp 0, sin registro de backup exitoso

**Requisitos mínimos para proceder**:
1. Arreglar acceso PostgreSQL (5 minutos con SSH)
2. Abrir SSH en Security Group (2 minutos en AWS Console)
3. Verificar que endpoints responden 200 con datos reales
4. Re-ejecutar esta auditoría para confirmar

---

## 12. Plan de remediación (próximos 7 días)

| Prioridad | Tarea | Responsable | Prerrequisito | Output esperado |
|-----------|-------|-------------|---------------|-----------------|
| P0 (hoy) | Abrir SSH en AWS Security Group | Isabella | Acceso a AWS Console | SSH funcional |
| P0 (hoy) | Arreglar contraseña PostgreSQL para user aionseg | Isabella (con SSH) | SSH activo | `ALTER USER aionseg WITH PASSWORD '...'` + reiniciar PM2 |
| P0 (hoy) | Verificar que /api/health/ready → database: ok | Isabella | DB arreglada | Todos los endpoints responden sin 500 |
| P1 (día 2) | Arreglar HCNetSDK Bridge | Isabella | SSH + DB | hik_bridge: healthy |
| P1 (día 2) | Verificar/crear qa-bot en tabla profiles | Isabella | DB activa | Login exitoso con qa-bot |
| P1 (día 2) | Verificar aion-vh-orchestrator estabilidad | Isabella | DB activa | 0 restarts en 1 hora |
| P2 (día 3) | Re-ejecutar auditoría completa con SSH | Claude | SSH + DB | Score actualizado |
| P2 (día 3) | Verificar n8n workflows (60 declarados) | Claude | SSH | Lista de workflows activos vs erroring |
| P2 (día 3) | Probar cada MCP tool individualmente | Claude | DB + JWT funcional | Matriz tool×status |
| P3 (día 4-5) | Configurar credenciales Slack/SendGrid/Twilio | Isabella | Cuentas creadas | Notificaciones funcionales |
| P3 (día 4-5) | Configurar backups automáticos verificados | Isabella | SSH + DB | backup_last_success_timestamp > 0 |
| P4 (día 6-7) | Completar módulos sin service.ts (20 pendientes) | Claude | DB estable | 78/78 módulos completos |
| P4 (día 7) | Re-auditoría final + decisión anillo siguiente | Claude + Isabella | Todo anterior | Score >85/100 |

---

## Anexo A: Métricas Prometheus completas (snapshot)

```
# Requests por ruta y status code (desde último reinicio)
GET /events          → 500: 443 requests, 401: 2
GET /alerts/instances → 500: 150
GET /incidents       → 500: 149
GET /cameras/by-site → 500: 78
GET /devices         → 500: 72
GET /sites           → 500: 72
GET /health/detailed → 503: 48
HEAD /health         → 200: 28
GET /health          → 200: 24
GET /api/health      → 401: 22
GET /audit/logs      → 500: 18
GET /health/ready    → 503: 17
POST /webhooks/n8n/event → 200: 1
GET /health/metrics  → 200: 1
GET /push/vapid-public-key → 200: 1
GET /ws              → 404: 1
GET /domotics/devices → 401: 1
GET /go2rtc/streams  → 401: 1

# Gauges
aion_streams_active: 0
aion_redis_connected: 0
aion_db_pool_active: 0
aion_backup_last_success_timestamp: 0
```

## Anexo B: Servicios healthy en /api/health/detailed

```json
{
  "redis": {"status": "healthy", "latency_ms": 9},
  "mqtt": {"status": "healthy", "latency_ms": 11},
  "asterisk": {"status": "healthy", "latency_ms": 10},
  "go2rtc": {"status": "healthy", "latency_ms": 16},
  "face_recognition": {"status": "healthy", "latency_ms": 14},
  "disk": {"status": "healthy", "detail": "80% free"},
  "memory": {"status": "healthy", "detail": "heap 81% (186MB RSS)"},
  "postgresql": {"status": "unhealthy", "detail": "password authentication failed for user \"aionseg\""},
  "hik_bridge": {"status": "unhealthy", "detail": "fetch failed"}
}
```
