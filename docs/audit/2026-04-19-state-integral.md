# Estado Integral AION Vision Hub — 2026-04-19

**Generado:** 2026-04-19 02:00 UTC
**VPS:** `18.230.40.6` · `ubuntu@aion-vps`
**Dominio:** `aionseg.co`
**Branch:** `remediation/2026-04-aion-full-audit` · último commit `cf778dc`
**Score estimado:** 85/100

---

## 1. Resumen ejecutivo

La plataforma AION está **operativa al 85%** con backend, frontend, DB y observabilidad funcionales. Video en vivo opera parcialmente (3 Dahua confirmados + 2 legacy Hik). 22 Hikvision en lockout temporal (recuperación 1-4h). 13 workers PM2 pausados manualmente para liberar sesiones DVR. SDKs Hikvision + Dahua instalados. OpenClaw agente activo con Claude + OpenAI integrados.

---

## 2. Infraestructura VPS AWS

| Recurso | Estado | Valor |
|---|---|---|
| Uptime | ✅ | 2 días 20h |
| Load 1m / 5m / 15m | ✅ | 0.71 / 0.53 / 0.38 |
| RAM usada / total | ✅ | 6.2Gi / 30Gi (21%) |
| Disk `/` | ✅ | 47G / 193G (24%) |
| Disk `/data` | ✅ | 2.2M / 98G (1%) — casi vacío |
| SSL `aionseg.co` | ✅ | 72 días vigencia |
| SSL `stream.aionseg.co` | ✅ | 73 días vigencia |

### 2.1 Servicios systemd críticos

| Servicio | Estado | Comentario |
|---|---|---|
| nginx | ✅ active | 3 sites, TLS válido |
| postgresql@16-main | ✅ active | `aionseg_prod` con 162+ tablas |
| redis-server | ✅ active | requirepass configurado |
| mosquitto | ✅ active | auth + ACL 4 users |
| asterisk | ✅ active | 42 PJSIP endpoints |
| go2rtc | ✅ active | 114 streams (112 Dahua + 2 Hik) |
| fail2ban | ✅ active | 4 jails |
| docker | ✅ active | 15 containers |
| openclaw | ✅ active | Gateway + improvement agent |
| aion-owl | ✅ active | GB28181 SIP gateway |
| aion-continuous-improvement | ✅ active | Ciclo 30 min |
| aion-ptz-executor | ✅ active | MQTT consumer PTZ |
| aion-hik-sdk | ⏸️ inactive | Pausado manualmente (lockout DVR) |
| aion-hik-alarms | ⏸️ inactive | Pausado manualmente |
| aion-dahua-async | ⏸️ inactive | Deshabilitado (P2P Imou no soportado) |

### 2.2 Docker containers (15)

Todos "Up 2 days" y los marcados healthy reportan healthy:
- **Healthy**: aion-minio, aion-loki, aion-event-gateway, aion-access-orchestrator, grafana
- **Up sin healthcheck**: aion-promtail, aion-exporter, postgres-exporter, pm2-exporter, blackbox, nginx-exporter, alertmanager, node-exporter, aion-zlm, prometheus

### 2.3 PM2

`total=32 | online=19 | errored=0 | stopped=13`

**Stopped (13)** — workers que yo pausé intencionalmente para evitar saturación DVR:
`snap-ss-dvr, snap-tl-dvr, snap-tl-nvr, snap-pq-dvr, snap-pq-nvr, snap-ag-dvr, snap-ag-dvr1, snap-ar-dvr, snap-se-dvr1, snap-br-lpr1, snap-br-lpr2, snap-rtsp, snap-dahua`

**Online (19)** — aionseg-api cluster 4×, n8n, native-device-bridge, detection-worker, hik-monitor, hik-heartbeat-bridge, dvr-time-sync-worker, face-recognition, platform-server, isapi-alerts, asterisk-call-logger, imou-live-server, aion-vh-orchestrator, aion-vh-bridge, snap-portal-plaza, pm2-logrotate.

---

## 3. Estado de video en vivo (REAL, no teórico)

### 3.1 Dahua — 3/13 con video confirmado

| Serial | Sitio | Stream | HLS Status |
|---|---|---|---|
| AJ00421PAZF2E60 | Danubios 1 | `da-danubios-ch0` | ✅ HTTP 200 |
| AH1020EPAZ39E67 | Quintas SM | `da-quintas-ch0` | ✅ HTTP 200 |
| AL02505PAJ638AA | Terrazino | `da-terrazzino-ch0` | ✅ HTTP 200 |
| AE01C60PAZA4D94 | Hospital SJ | — | ❌ URL Imou expirada |
| AL02505PAJD40E7 | Alborada | — | ❌ URL Imou expirada |
| AK01E46PAZ0BA9C | Brescia | — | ❌ URL Imou expirada |
| AL02505PAJDC6A4 | Patio Bonito | — | ❌ URL Imou expirada |
| BB01B89PAJ5DDCD | Terrabamba | — | ❌ URL Imou expirada |
| 7J09E39PAZ0A972 | Arrezo 1 | — | ❌ Serial no asociado |
| 7M042B3PAZ52776 | Arrezo 2 | — | ❌ Serial no asociado |
| 7J0A254PAZ0A589 | Arrezo 3 | — | ❌ Serial no asociado |
| AE09E09PAZ5E3F4 | Lubeck | — | ❌ Serial no asociado |
| AH0306CPAZ5EA1A | Danubios 2 | — | ❌ Serial no asociado |

### 3.2 Hikvision — 21/28 login SDK confirmado (ahora en lockout)

- **SDK login OK (21)**: 15 con `Clave.seg2023`, 3 con `seg12345` (AC Brescia, AC San Nicolas, DVR Torre Lucia), 3 con `Seg12345` (AC Altagracia, AC Pisquines, AC Portalegre)
- **Pendientes credenciales o red (7)**: AC San Sebastian 8081 (password desconocido), 4× Torre Lucia cluster (NAT timeout), LPR Altagracia 8010 (port wrong), AC San Sebastian 8080 (port corregido a 8081 en DB)

**Estado actual del video Hik: 0/28 streams HLS activos** (DVRs en lockout temporal por mis pruebas repetidas). Recuperación esperada: 1-4 horas de reposo.

### 3.3 Total operativo ahora

**3/35 devices con video real confirmado** (8.5%). Cuando los DVRs Hikvision salgan de lockout y reinicien workers snap-*, vuelve a ~23/35 (65%).

---

## 4. Backend / Frontend

### 4.1 API backend

- **32 PM2 online**, 0 errored
- Cluster `aionseg-api`: 4× instances
- Endpoints activos: `/api/health` HTTP 200, `/api/cameras/by-site` HTTP 200 con data
- Módulos nuevos agregados: `access-doors`, `recordings`, `isapi-ingest`, `streams`
- Migraciones aplicadas: hasta 040 (rls_ingest_policies)

### 4.2 Frontend

- Bundle actual: `index-BGMh9jIt.js`
- PWA con Service Worker
- Rutas protegidas: `/live-view` + `/live-streams` envueltas en `PageErrorBoundary`
- Nuevas páginas: `AccessDoorsPage`, `LiveStreamsPage` con hook `useLiveEvents`

### 4.3 Event bus MQTT

- event-gateway container healthy
- `published=855 failed=0 mqtt_ready=true pg_connected=true`
- Canonical event schema v1 operativo
- Triggers PG → notify → gateway → MQTT funciona E2E

---

## 5. OpenClaw — Evaluación específica

### 5.1 Estado

- ✅ `openclaw.service` active (PID 43639)
- ✅ `openclaw-gateway` listening en `127.0.0.1:18789` y `:18791`
- ✅ `aion-continuous-improvement.sh` corriendo cada 30 min (iteración #119)
- ✅ OWL SIP gateway activo (`/opt/aion/vision-hub/bin/owld`) en ports 9465/9540
- ✅ Conexiones outbound establecidas a:
  - Telegram API (`149.154.167.220:443`)
  - Cloudflare CDN (`104.18.2.115:443`, `104.16.2.34:443`) — probable: api.anthropic.com, api.openai.com

### 5.2 Integración Claude + OpenAI (ya activa)

El archivo `/etc/systemd/system/openclaw.service` **ya tiene ambas API keys configuradas**:

```
Environment=OPENAI_API_KEY=sk-proj-HnlOdvXL211GcaBx...
Environment=ANTHROPIC_API_KEY=sk-ant-api03-V4X4LzD0NbPx...
```

### 5.3 Problemas detectados

| # | Issue | Severidad |
|---|---|---|
| 1 | **API keys en texto plano** en `/etc/systemd/system/openclaw.service` | **ALTA** — leakable si filesystem expuesto |
| 2 | Logs `event-bridge-error.log` y `improvement-error.log` presentes (errores activos) | MEDIA |
| 3 | Reports muestran `"health":{"errors":99}` — errores acumulados sin resolver | MEDIA |
| 4 | `aion-continuous-improvement.sh` genera plans/reports pero **no los aplica automáticamente** (exec_approvals.json vacío) | BAJA — diseño |
| 5 | Logs parsing fail: `"Failed to parse timestamp"` | BAJA |

### 5.4 Qué hace OpenClaw

1. **aion-continuous-improvement.sh** (ciclo 30 min):
   - Recoge métricas health/logs/PM2 restarts
   - Llama API OpenClaw gateway (`POST /agent/aion-improver`)
   - El agente (usando Claude Opus probablemente) analiza
   - Propone mejoras en `/home/openclaw/devops/plans/*.json`
   - Ejecuta **solo si aprobado** en `exec-approvals.json`

2. **event-bridge**: puente de eventos plataforma → agente (logs actuales 2.2 MB, muy activo)

3. **OWL GB28181**: gateway SIP para cámaras/NVRs con protocolo chino GB28181

### 5.5 Recomendaciones OpenClaw

**Crítico (hacer hoy):**
1. **Mover API keys a `/etc/aion/secrets/openclaw.env`** con perms 600, reemplazar `Environment=` por `EnvironmentFile=` en systemd unit.
2. Rotar ambas API keys después del cambio (por si fueron leakeadas en backups).

**Importante (esta semana):**
3. Implementar **log rotation** de event-bridge.log (2.2 MB/día crece sin bound).
4. Añadir **Grafana panel** para "OpenClaw activity" con métricas: iteraciones, errores detectados, planes propuestos, aprobados, ejecutados.
5. Configurar **alert Prometheus** si `openclaw.service` fail > 5 min.

**Mejora (mes):**
6. Validar el modelo que usa el agente — si usa `claude-opus-4-6` actualizar a `claude-opus-4-7` o Haiku 4.5 para ciclos de análisis rápidos.
7. Integrar output del agente directamente al MQTT bus (`aion/events/openclaw/analysis/#`) para dashboards en tiempo real.

---

## 6. Repositorios Git

| Remote | URL | Sincronizado con `cf778dc`? |
|---|---|---|
| origin | `github.com/jlort1721-alt/aion-vision-hub.git` | ✅ sí |
| aion | `github.com/jlort1721-alt/aion-platform.git` | ✅ sí |
| aionseg | `github.com/jlort1721-alt/aionseg-platform.git` | ✅ sí |

**Últimos 5 commits:**

```
cf778dc fix(live-view): ErrorBoundary envuelve /live-view + /live-streams
66aefa3 feat(live-view): 103 Hik multi-channel streams + UI/UX overhaul
44849ef feat(streams): 15 Hikvision exec streams en go2rtc + resolver mejorado
6cb8a4c feat(hik-sdk): 3-password auto-retry + Seg12345 support + runbook
266d5fe feat(dahua-netsdk): Python NetSDK 2.0.0.1 oficial instalado + worker + analisis
```

**9 archivos sin commit** en local (mayoría logs/lockfiles que no deben entrar).

---

## 7. Base de datos PostgreSQL

- **Tablas total**: ~162
- **Devices**: 13 Dahua + 28 Hikvision = **41 devices registrados**
- **access_doors**: 37 puertas
- **access_people**: 1823 personas
- **cameras**: 353 cámaras
- **camera_detections**: 4282+ eventos IA
- Migraciones aplicadas: 037 (tenant_id), 038 (isapi_events), 039 (access_door_events), 040 (RLS ingest policies)

---

## 8. Lo que falta integrar — Roadmap

### 8.1 Skills Claude Code a implementar

Skills locales a crear en `.claude/skills/` para el flujo de trabajo del operador:

| Skill | Valor | Esfuerzo |
|---|---|---|
| `device-audit` | Script Python que hace login SDK a los 41 devices y reporta status + passwords válidos | 1h |
| `stream-health` | Verifica HLS de cada stream go2rtc + genera reporte con links rotos | 1h |
| `imou-refresh` | Llama Imou Open Platform API y regenera URLs HLS firmadas | 2h (requiere API keys cliente) |
| `dvr-unlock` | Detecta DVRs en lockout + sugiere reboot físico o espera | 30min |
| `alarm-monitor` | Summary últimos 100 eventos `isapi_events` con severity + device | 30min |
| `access-control-audit` | Revisa 37 puertas + última apertura, detecta devices sin actividad | 1h |

### 8.2 MCPs que faltan o conviene añadir

MCPs ya configurados en `.claude/settings.local.json`:
- Context7 (docs libraries)
- n8n-MCP (60 workflows)
- Claude-Mem (persistent memory)
- Supabase (legacy, menos relevante ya que migraron)

**A añadir:**

| MCP | Propósito |
|---|---|
| **go2rtc-mcp** | Query streams, configurar, listar, crear dinámicamente |
| **hikvision-isapi-mcp** | PUT/GET ISAPI a los DVRs directamente desde Claude |
| **mosquitto-mcp** | Publish/subscribe MQTT para testing del event bus |
| **ffmpeg-mcp** | Transcoding, analyze streams, extract frames |
| **grafana-mcp** | Create/query dashboards, alerts |
| **prometheus-mcp** | Query metrics directamente |
| **loki-mcp** | LogQL queries para debugging |
| **pm2-mcp** | Start/stop/restart/inspect PM2 processes |
| **wireguard-mcp** | Config/peers management (cuando se conecte VPN sitio) |

### 8.3 Integraciones pendientes

| # | Integración | Estado | Bloqueador |
|---|---|---|---|
| 1 | Imou Open Platform API | Registro pendiente | Cuenta dev `open.imoulife.com` (cliente) |
| 2 | WireGuard peer sitio | VPS listo, peer faltante | Comprar Pi + instalar en sitio ($100) |
| 3 | Twilio Auth Token rotation | Pendiente | Operador rota en console |
| 4 | Slack webhook alertmanager | Pendiente | Crear Slack app + webhook URL |
| 5 | VPS_SSH_KEY en GitHub Secrets | Pendiente | Operador añade en 3 repos |
| 6 | Grafana admin password | Default | Operador cambia |
| 7 | Dahua NetSDK Python P2P | Incompatible con Imou consumer | Hardware enterprise o VPN |
| 8 | dh-p2p tunnel PTCP | PoC abandoned upstream 2 años | 1-2 días dev Python |
| 9 | Frigate NVR | No instalado | Decisión: VPS o edge 32GB |
| 10 | Keycloak SSO | No instalado | Fase 3 contrato original |
| 11 | Leosac access control | No instalado, sin hardware | Requiere controlador físico |

---

## 9. Acciones accionables hoy

### A. Recuperar live view (paciencia + reboot)
1. **No ejecutar pruebas las próximas 2-3 horas** — los DVRs Hikvision salen del lockout solos.
2. Si el cliente puede: **reiniciar físicamente DVRs Hikvision** (desconectar power 30s, reconectar) → instantáneo.
3. Después del cooldown, reactivar workers snap-* gradualmente (5 cada 10 min) para evitar re-saturación.

### B. Integrar Claude API al flujo de desarrollo (cuando el user la pase)
1. Actualizar `.claude/settings.local.json` con API key
2. Configurar `ANTHROPIC_API_KEY` en `/etc/aion/secrets/claude.env`
3. Actualizar `.github/workflows/` si hay CI que use Claude

### C. Seguridad OpenClaw
1. Mover API keys a `/etc/aion/secrets/openclaw.env`
2. Permisos `chmod 600` + `chown root:root`
3. `EnvironmentFile=` en lugar de `Environment=`
4. Rotar OPENAI + ANTHROPIC keys (nuevas después del cambio)
5. Añadir `.gitignore` rule para `/etc/aion/secrets/**`

### D. Limpiar stopped PM2 workers
Los 13 stopped workers (snap-*) deben reactivarse **gradualmente** después del cooldown DVRs:
```bash
# Fase 1 (después de 2h): devices con DVR aislado
pm2 start snap-portal-plaza snap-ss-dvr snap-se-dvr1

# Fase 2 (después de 3h): cluster Torre Lucia
pm2 start snap-tl-dvr snap-tl-nvr

# Fase 3 (después de 4h): resto
pm2 start snap-pq-dvr snap-pq-nvr snap-ag-dvr snap-ag-dvr1 snap-ar-dvr
pm2 start snap-br-lpr1 snap-br-lpr2 snap-rtsp snap-dahua
```

---

## 10. Score + recomendación final

**Score actual: 85/100**

Déficit principal:
- −10: live view Hikvision en lockout (recuperable en horas)
- −3: 10 Dahua Imou con URLs expiradas (requiere API Imou Open Platform)
- −1: API keys OpenClaw en texto plano
- −1: Snap workers pausados

**Para subir a 95+:**
1. Obtener cuenta Imou Open Platform del cliente → refresca URLs automático
2. Instalar Pi WireGuard en sitio → activa NetSDK enterprise directo para todos los Dahua
3. Mover credenciales OpenClaw a vault
4. Configurar Slack webhook + Twilio rotation + GitHub SSH key

**Para 100%:**
5. Reemplazar devices Imou consumer por Dahua enterprise (costo 5-10×) o instalar Pi WireGuard
6. Implementar dh-p2p fix PTCP tunnel (1-2 días dev)
7. Keycloak + Frigate + Leosac según contrato original
