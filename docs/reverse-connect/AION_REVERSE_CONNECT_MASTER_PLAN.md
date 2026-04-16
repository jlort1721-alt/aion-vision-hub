# AION · Reverse-Connect Gateway — Plan Maestro de Ejecución Autónoma

**Proyecto:** Integración nativa de DVR/NVR/Cámaras Dahua y Hikvision a AION sin IP pública, sin port-forwarding, sin dependencia de IMOU Cloud / Hik-Connect.
**Objetivo:** Que los 22+ sitios de Clave Seguridad CTA reporten video, eventos, PTZ, audio y configuración al VPS AION (18.230.40.6, São Paulo) iniciando la conexión desde el equipo (reverse connection).
**Resultado esperado:** AION muestra, graba y controla el 100% de los equipos como si fuera DSS / iVMS-4200, con latencia < 500 ms en live view, sin romper nada del stack actual.
**Tag de corte:** `v1.1.0-reverse-connect`
**Tiempo objetivo:** 18–36 horas de ejecución agente-asistida.

---

## 0. Principios inviolables (memoria de seguridad)

> **Estas reglas se inyectan al inicio de cada agente. Si un agente no las puede respetar, debe abortar y pedir confirmación humana.**

1. **NO MODIFICAR** código existente de AION salvo los puntos de extensión explícitamente declarados en §5. Todo lo nuevo vive en módulos nuevos: `services/reverse-gateway/`, `apps/api/src/routes/reverse/`, `apps/web/src/features/reverse/`.
2. **NO TOCAR** la base de datos existente sin migración **aditiva**. Prohibido `DROP`, `ALTER ... DROP`, renombrar columnas, cambiar tipos. Solo `CREATE TABLE`, `CREATE INDEX`, `ADD COLUMN NULL`.
3. **NO REINICIAR** procesos PM2 existentes (`aion-api`, `aion-agent`, `aion-web`, `go2rtc`) hasta la fase de integración validada. El gateway nuevo corre como proceso independiente (`aion-reverse-gateway`).
4. **NO CAMBIAR** la configuración actual de go2rtc. Se crea un archivo **adicional** `go2rtc.reverse.yaml` cargado en paralelo, o se usan streams dinámicos vía API.
5. **NO ABRIR** puertos en el firewall sin dejarlos registrados en `/etc/aion/firewall-changelog.md` con fecha, razón y comando de rollback.
6. **NO DESCARGAR** SDKs binarios sin verificar checksum SHA-256 contra la fuente oficial del fabricante.
7. **BACKUP OBLIGATORIO** antes de cualquier cambio que toque disco persistente: `pg_dump`, snapshot EBS, `tar` de `/etc/aion` y `/opt/aion`.
8. **TODO CAMBIO** se hace en rama git `feature/reverse-connect-gateway` con commits atómicos. Prohibido `--force`, `reset --hard` sobre `main`, o rebase destructivo.
9. **ROLLBACK DOCUMENTADO** para cada paso. Si un agente no puede definir el rollback, no ejecuta.
10. **TESTS PRIMERO** para cualquier lógica de registro/parsing/routing. Cobertura mínima del módulo nuevo: 80 %.

---

## 1. Diagnóstico arquitectónico

### 1.1 Estado actual (lo que ya funciona, NO tocar)

```
Sitios                    Internet        VPS AION (18.230.40.6, t3.xlarge, SP)
──────                    ────────        ──────────────────────────────────────
[16× Hikvision DVR/NVR] ──HTTP port fwd──► go2rtc (isapi://) ─┐
[7×  Dahua XVR (108 ch)]──IMOU Cloud API─► adapter ───────────┤
[Cámaras IP sueltas]     ──RTSP/ONVIF ───► go2rtc ────────────┤
                                                              ▼
                          ┌─ Fastify API (Node 20) ── Drizzle ── Postgres local
                          ├─ AION Agent (Claude API + 28 tools)
                          ├─ MCP Server (22 tools)
                          ├─ React frontend (49 pages, 54 modules)
                          └─ Redis + PM2 + Nginx
```

### 1.2 Lo que falla hoy (por eso hacemos esto)

- Port-forwarding: depende del router/ISP de cada cliente. Frágil.
- IMOU Cloud: rate limits, latencia, dependencia de nube ajena, términos cambiantes.
- Hik-Connect: igual que IMOU. Además no expone todo lo que necesitamos.
- ISAPI directo: requiere IP pública o VPN en el sitio.

### 1.3 Lo que añadimos (diseño objetivo)

```
Sitios                       Internet          VPS AION
──────                       ────────          ────────
[Dahua XVR/NVR] ─── TCP out ──► :7681 ──► aion-reverse-gateway (Go)
                                              │ protocolo DVRIP-reverse
[Hik DVR/NVR/IP] ── TCP out ──► :7660 ──►     │ protocolo ISUP 5.0
                                :7661 ──►     │ stream
                                              ▼
                              spawn RTSP local 127.0.0.1:8554/reverse/{siteId}/{ch}
                                              ▼
                                       go2rtc (reload sources vía API)
                                              ▼
                                       AION API ──► React ──► operadores
```

**Ninguno de los equipos necesita IP pública, DDNS, port-forward, ni nube del fabricante. Solo Internet saliente.**

---

## 2. Matriz de capacidades por protocolo

| Capacidad                     | Dahua Auto Register (DVRIP-R) | Hikvision ISUP 5.0 |
|-------------------------------|-------------------------------|--------------------|
| Registro inverso              | ✅ nativo                      | ✅ nativo           |
| Live view multicanal          | ✅                             | ✅                  |
| Playback con búsqueda         | ✅                             | ✅                  |
| PTZ + presets + tours         | ✅                             | ✅                  |
| Eventos (motion, LPR, face)   | ✅                             | ✅                  |
| Audio bidireccional (talkback)| ✅                             | ✅                  |
| I/O alarmas (relés)           | ✅                             | ✅                  |
| Snapshots                     | ✅                             | ✅                  |
| Descarga de clips             | ✅                             | ✅                  |
| Configuración remota          | ✅ (limitada)                  | ✅ completa         |
| Reboot / NTP / usuarios       | ✅                             | ✅                  |
| Heartbeat / keep-alive        | ✅ (30s)                       | ✅ (20s)            |
| Multi-tenant (N sitios → 1 VPS)| ✅                           | ✅                  |

**Conclusión:** ISUP de Hikvision es ligeramente más completo en config remota; Dahua es más sencillo de implementar. Ambos cubren el 100 % del caso de uso operativo de Clave.

---

## 3. Stack técnico del gateway nuevo

| Componente          | Tecnología                     | Justificación                                    |
|---------------------|--------------------------------|--------------------------------------------------|
| Listener Dahua      | Go 1.22 + cgo → Dahua NetSDK   | Performance, goroutines = 1 por sesión            |
| Listener Hikvision  | Go 1.22 + cgo → HCNetSDK+ISUP  | Mismo proceso, mismo runtime                      |
| Media publishing    | FFmpeg → RTSP local → go2rtc   | Reutiliza lo que ya tienes                        |
| Persistencia        | Postgres (schema `reverse`)    | Aditiva, 0 conflicto con AION actual             |
| Cache de sesión     | Redis DB 3 (separada)          | Tu Redis ya está; DB 3 reservada                  |
| Config              | TOML en `/etc/aion/reverse/`   | Fácil de versionar, human-readable                |
| Logs                | JSON a stdout → PM2 → file     | Coherente con el resto de AION                    |
| Métricas            | Prometheus `/metrics:9464`     | Coherente con Fase 6 de Vision Hub                |
| Supervisión         | PM2 `aion-reverse-gateway`     | Mismo patrón que tus otros servicios              |
| API de control      | gRPC interno + REST a Fastify  | Fastify orquesta, gateway ejecuta                 |

---

## 4. Estructura de archivos (todo nuevo, nada pisado)

```
/opt/aion/
├── services/
│   └── reverse-gateway/              ← NUEVO MÓDULO COMPLETO
│       ├── cmd/gateway/main.go
│       ├── internal/
│       │   ├── dahua/                   (SDK wrapper + listener :7681)
│       │   ├── hikvision/               (SDK wrapper + listener :7660/7661)
│       │   ├── session/                 (registro, heartbeat, estado)
│       │   ├── media/                   (FFmpeg → go2rtc bridge)
│       │   ├── store/                   (Postgres + Redis)
│       │   ├── api/                     (gRPC server para Fastify)
│       │   └── metrics/                 (Prometheus)
│       ├── sdks/                        (binarios oficiales, .gitignored)
│       │   ├── dahua/                   (NetSDK Linux64)
│       │   └── hikvision/               (HCNetSDK + EHome/ISUP Linux64)
│       ├── configs/gateway.toml
│       ├── migrations/                  (SQL aditivo)
│       │   └── 001_reverse_schema.sql
│       ├── test/
│       │   ├── unit/
│       │   ├── integration/
│       │   └── fixtures/                (capturas PCAP de handshake)
│       ├── Dockerfile
│       ├── Makefile
│       ├── go.mod
│       └── README.md
│
├── apps/api/src/routes/reverse/      ← EXTENSIÓN a Fastify existente
│   ├── index.ts                         (registrar plugin)
│   ├── sessions.route.ts                (GET /reverse/sessions)
│   ├── streams.route.ts                 (POST /reverse/streams/:id/start)
│   ├── ptz.route.ts
│   ├── events.route.ts
│   └── schemas/                         (Zod)
│
├── apps/web/src/features/reverse/    ← EXTENSIÓN a React existente
│   ├── ReverseFleetPage.tsx
│   ├── components/
│   │   ├── SessionCard.tsx
│   │   ├── LiveGrid.tsx
│   │   └── PTZJoystick.tsx
│   └── hooks/useReverseSession.ts
│
└── ops/
    ├── pm2/ecosystem.reverse.config.js
    ├── nginx/sites-enabled/reverse-metrics.conf
    ├── firewall/reverse-ports.sh
    └── backups/pre-reverse-deploy.sh
```

---

## 5. Puntos de extensión en lo existente (cirugía mínima)

Solo 3 archivos existentes se tocan, y solo para *añadir*:

### 5.1 `apps/api/src/app.ts`
```diff
+ import reverseRoutes from './routes/reverse';
  await app.register(existingRoutes);
+ await app.register(reverseRoutes, { prefix: '/api/v1/reverse' });
```

### 5.2 `apps/web/src/routes.tsx`
```diff
+ { path: '/reverse', element: <ReverseFleetPage /> },
```

### 5.3 `ecosystem.config.js` (PM2)
```diff
+ // Nuevo proceso, no toca los anteriores
+ { name: 'aion-reverse-gateway', script: '/opt/aion/services/reverse-gateway/bin/gateway', ... }
```

**Nada más.** El gateway es un proceso independiente que habla con Fastify vía gRPC local (`127.0.0.1:50551`).

---

## 6. Agentes autónomos — prompts de ejecución

> Cada agente es un prompt completo y autocontenido. Se ejecutan en orden. Cada uno produce un **artefacto verificable** antes de que empiece el siguiente. Si el test de aceptación de un agente falla, se detiene la cadena y se pide intervención humana.

### AGENTE 0 — Auditor de Estado Previo (read-only)

**Rol:** SRE forense. No modifica nada. Mapea el VPS actual para que los agentes siguientes no rompan nada.

**Tareas:**
1. Conectar por SSH al VPS.
2. Ejecutar `pm2 jlist`, `ss -tlnp`, `systemctl list-units --type=service --state=running`, `docker ps`, `psql -c "\dt"`, `redis-cli info`.
3. Verificar versión de: Node, Go (instalar si falta 1.22+), FFmpeg, go2rtc, Postgres, Redis, Nginx, PM2.
4. Listar puertos ocupados y confirmar que `7660`, `7661`, `7681`, `50551`, `9464` están libres.
5. Hacer snapshot EBS del volumen root.
6. `pg_dump -Fc` de la base AION a `/backup/pre-reverse-$(date +%Y%m%d-%H%M).dump`.
7. Generar `/root/aion-state-report.json` con todo lo anterior.

**Test de aceptación:**
- Archivo `/root/aion-state-report.json` existe, JSON válido.
- Snapshot EBS listado en `aws ec2 describe-snapshots`.
- Dump Postgres ≥ 1 MB.
- Ningún proceso crítico de AION reportó error.

**Rollback:** n/a (read-only).

---

### AGENTE 1 — Preparador de Infraestructura

**Rol:** Provisioner. Abre puertos, crea directorios, instala dependencias faltantes.

**Tareas:**
1. Crear rama `git checkout -b feature/reverse-connect-gateway`.
2. AWS Security Group del VPS: añadir reglas (documentar en `firewall-changelog.md`):
   - TCP 7660 (Hikvision ISUP signaling) — source `0.0.0.0/0`
   - TCP 7661 (Hikvision ISUP stream) — source `0.0.0.0/0`
   - UDP 7661 (Hikvision ISUP stream, algunos firmwares)
   - TCP 7681 (Dahua Auto Register) — source `0.0.0.0/0` (ya parece abierto por tu screenshot, verificar)
   - TCP 9464 (Prometheus metrics) — source solo `127.0.0.1` vía nginx reverse proxy
3. `ufw` local: mismo patrón.
4. Instalar: `apt install -y build-essential pkg-config libssl-dev`. Go 1.22 desde tarball oficial a `/usr/local/go`.
5. Crear `/opt/aion/services/reverse-gateway/` con estructura del §4.
6. Crear usuario sistema `aion-reverse` sin shell, propietario del módulo.
7. `chown -R aion-reverse:aion /opt/aion/services/reverse-gateway/`.
8. Crear schema Postgres aditivo (ejecutar `001_reverse_schema.sql` — ver §7).
9. Redis DB 3 verificar vacía: `redis-cli -n 3 dbsize` → 0.

**Test de aceptación:**
- `ss -tlnp | grep -E '7660|7661|7681'` muestra que los puertos están listos para binding.
- `go version` retorna 1.22+.
- `psql -c "\dn" | grep reverse` muestra el schema.
- Commit atómico con mensaje `infra(reverse): provision vps + firewall + schema`.

**Rollback:**
```bash
# documentado en firewall-changelog.md
aws ec2 revoke-security-group-ingress ...
ufw delete allow 7660 && ufw delete allow 7661 && ufw delete allow 7681
psql -c "DROP SCHEMA reverse CASCADE"
rm -rf /opt/aion/services/reverse-gateway
git checkout main && git branch -D feature/reverse-connect-gateway
```

---

### AGENTE 2 — Integrador Dahua NetSDK (reverse registration)

**Rol:** Ingeniero de protocolo Dahua. Implementa el listener DVRIP reverso.

**Contexto que debe leer primero:**
- `sdks/dahua/README.pdf` y `sdks/dahua/NetSDK_Manual.pdf`.
- Funciones clave: `CLIENT_Init`, `CLIENT_ListenServer`, `CLIENT_SetAutoRegisterCallBack`, `CLIENT_LoginWithHighLevelSecurity`, `CLIENT_RealPlayEx`, `CLIENT_PTZControlEx2`, `CLIENT_StartListen` (eventos).

**Tareas:**
1. Descargar `General_NetSDK_Eng_Linux64_IS_V3.058` desde portal oficial Dahua. Verificar SHA-256.
2. Colocar en `sdks/dahua/lib/` las `.so`. Añadir al `LD_LIBRARY_PATH` del servicio vía systemd/PM2.
3. Escribir `internal/dahua/sdk.go` con bindings cgo mínimos para: Init, ListenServer, RegisterCallback, Login, RealPlay, PTZ, Events.
4. Escribir `internal/dahua/listener.go`:
   - `Start(ctx, addr ":7681")`.
   - Al recibir callback de auto-register: validar deviceID contra tabla `reverse.devices`, si no existe crear en estado `pending_approval`.
   - Si existe y está `approved`: hacer login con credenciales guardadas (encriptadas con AES-256-GCM, clave en AWS KMS o en `/etc/aion/reverse/.key`).
   - Persistir sesión en `reverse.sessions`.
   - Emitir evento gRPC `SessionOpened` a Fastify.
5. Escribir `internal/dahua/media.go`:
   - Al recibir comando `StartStream(sessionId, channel)` vía gRPC: abrir RealPlay, leer frames H.264/H.265, pipe a FFmpeg que publica RTSP en `rtsp://127.0.0.1:8554/reverse/dahua/{deviceId}/{ch}`.
   - Registrar la URL en go2rtc vía API `PUT /api/streams`.
6. Escribir `internal/dahua/ptz.go` con mapping estándar (up/down/left/right/zoom/focus/preset/tour).
7. Escribir `internal/dahua/events.go` — suscripción a motion, LPR, IVS. Publicar a NATS interno o Redis pub/sub (canal `reverse:events:dahua`).
8. Tests unitarios con mocks del SDK (interface `DahuaClient` para poder inyectar fake en tests).
9. Test de integración con device real: `make test-integration-dahua DEVICE_SERIAL=BRXVR001`.

**Test de aceptación:**
- `go test ./internal/dahua/... -race -cover` ≥ 80 %.
- Con un XVR físico configurado apuntando al VPS, aparece en `reverse.sessions` en < 10 s.
- `curl http://localhost:8554/reverse/dahua/BRXVR001/1` devuelve stream RTSP válido (`ffprobe` lo reconoce).
- Heartbeat: si se apaga el XVR, la sesión pasa a `disconnected` en < 90 s.

**Rollback:** detener servicio, `DELETE FROM reverse.sessions WHERE vendor='dahua'`, `git revert` del commit.

---

### AGENTE 3 — Integrador Hikvision ISUP 5.0

**Rol:** Ingeniero de protocolo Hikvision. Gemelo del Agente 2 para ISUP.

**Contexto que debe leer primero:**
- `EHome_SDK_Programming_Manual_V6.1.pdf`.
- Funciones clave: `NET_ECMS_Init`, `NET_ECMS_Start_V30` (listener), `NET_ECMS_RegisterCallBack`, `NET_ECMS_StartGetRealStream`, `NET_ECMS_PTZControl_Other`, `NET_ECMS_SetAlarmCallBack`.

**Tareas:** simétricas al Agente 2 pero contra ISUP.

1. Descargar `EHome_SDK_V6.1.x_Linux64`. SHA-256.
2. Bindings cgo en `internal/hikvision/sdk.go`.
3. `listener.go` — TCP :7660 señalización, UDP/TCP :7661 media. ISUP requiere un **device key** (PSK) por dispositivo además del deviceID. Guardar encriptado.
4. `media.go` — Hik entrega PS (Program Stream) sobre UDP. Convertir a RTSP vía FFmpeg (`-f mpegps` input).
5. `ptz.go`, `events.go`.
6. Tests idénticos en estructura.

**Test de aceptación:**
- Con un NVR físico con "Platform Access / ISUP 5.0" apuntando al VPS, aparece en `reverse.sessions` en < 10 s.
- Stream RTSP funcional. PTZ responde. Eventos de motion llegan a Redis.

**Rollback:** idéntico al Agente 2.

---

### AGENTE 4 — Puente a go2rtc (publicación dinámica)

**Rol:** Integrador de media. Conecta el gateway con go2rtc existente sin tocar su config actual.

**Tareas:**
1. go2rtc ya corre. Usar su API HTTP (`http://127.0.0.1:1984/api/streams`) para añadir/quitar streams dinámicamente.
2. `internal/media/go2rtc_client.go` — cliente Go con métodos `AddStream`, `RemoveStream`, `ListStreams`.
3. Namespace: todos los streams del gateway se publican con prefijo `rv_` para no colisionar con los existentes (`rv_dahua_BRXVR001_ch1`, `rv_hik_NVR042_ch3`).
4. Al cerrar sesión o perder heartbeat → `RemoveStream` automático.
5. Validar que los streams aparecen en la UI de go2rtc (`http://127.0.0.1:1984`).

**Test de aceptación:**
- Crear 2 sesiones de prueba → 2 streams `rv_*` aparecen en go2rtc.
- Cerrar sesión → stream desaparece en ≤ 5 s.
- Streams existentes de AION (los 16 Hikvision vía ISAPI, etc.) **no cambian** (comparar hash de lista antes/después).

**Rollback:** `for s in $(go2rtc list | grep ^rv_); do go2rtc remove $s; done`.

---

### AGENTE 5 — Schema Postgres + Drizzle types

**Rol:** DBA aditivo.

**Archivo:** `services/reverse-gateway/migrations/001_reverse_schema.sql`

```sql
CREATE SCHEMA IF NOT EXISTS reverse;

CREATE TABLE reverse.devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor          TEXT NOT NULL CHECK (vendor IN ('dahua','hikvision')),
  device_id       TEXT NOT NULL,                       -- serial/ID declarado por el equipo
  site_id         UUID REFERENCES public.sites(id),    -- FK a tu tabla existente
  display_name    TEXT,
  channel_count   INT DEFAULT 1,
  username_enc    BYTEA,                               -- AES-256-GCM
  password_enc    BYTEA,
  isup_key_enc    BYTEA,                               -- solo Hik
  status          TEXT NOT NULL DEFAULT 'pending_approval'
                  CHECK (status IN ('pending_approval','approved','blocked')),
  first_seen_at   TIMESTAMPTZ DEFAULT now(),
  last_seen_at    TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}'::jsonb,
  UNIQUE (vendor, device_id)
);

CREATE TABLE reverse.sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_pk       UUID NOT NULL REFERENCES reverse.devices(id) ON DELETE CASCADE,
  remote_addr     INET NOT NULL,
  state           TEXT NOT NULL DEFAULT 'connecting'
                  CHECK (state IN ('connecting','online','degraded','disconnected')),
  opened_at       TIMESTAMPTZ DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  last_heartbeat  TIMESTAMPTZ,
  firmware        TEXT,
  sdk_version     TEXT,
  capabilities    JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX ON reverse.sessions (device_pk, state);
CREATE INDEX ON reverse.sessions (state) WHERE state = 'online';

CREATE TABLE reverse.streams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES reverse.sessions(id) ON DELETE CASCADE,
  channel         INT NOT NULL,
  go2rtc_name     TEXT NOT NULL UNIQUE,                -- rv_dahua_BRXVR001_ch1
  codec           TEXT,
  resolution      TEXT,
  started_at      TIMESTAMPTZ DEFAULT now(),
  stopped_at      TIMESTAMPTZ
);

CREATE TABLE reverse.events (
  id              BIGSERIAL PRIMARY KEY,
  device_pk       UUID NOT NULL REFERENCES reverse.devices(id) ON DELETE CASCADE,
  channel         INT,
  kind            TEXT NOT NULL,
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON reverse.events (device_pk, created_at DESC);
CREATE INDEX ON reverse.events (kind, created_at DESC);

CREATE TABLE reverse.audit_log (
  id              BIGSERIAL PRIMARY KEY,
  actor           TEXT NOT NULL,
  action          TEXT NOT NULL,
  target          TEXT,
  details         JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

**Drizzle:** `apps/api/src/db/schema/reverse.ts` — tipar las 5 tablas. No tocar los schemas existentes.

**Test de aceptación:**
- Migración aplica limpio sobre copia del dump (agente 0).
- `EXPLAIN ANALYZE` de la query `sessions WHERE state='online'` usa el índice parcial.
- Rollback probado: `DROP SCHEMA reverse CASCADE` y re-aplicar restaura estado.

---

### AGENTE 6 — API Fastify (plugin `reverse`)

**Rol:** Backend Node. Expone las funcionalidades del gateway a AION.

**Rutas (prefijo `/api/v1/reverse`):**

| Método | Path                          | Descripción                                  |
|--------|-------------------------------|----------------------------------------------|
| GET    | `/devices`                    | Lista con filtros (vendor, site, status).    |
| POST   | `/devices/:id/approve`        | Aprobar dispositivo pending. Asigna creds.   |
| POST   | `/devices/:id/block`          |                                              |
| GET    | `/sessions`                   | Sesiones activas.                            |
| GET    | `/sessions/:id`               | Detalle + capacidades negociadas.            |
| POST   | `/sessions/:id/streams`       | `{channel}` → arranca stream, retorna URL.   |
| DELETE | `/sessions/:id/streams/:ch`   | Detiene stream.                              |
| POST   | `/sessions/:id/ptz`           | `{action, speed, preset?}`                   |
| POST   | `/sessions/:id/snapshot`      | Devuelve JPEG.                               |
| GET    | `/events?kind=&from=&to=`     | Stream SSE de eventos en vivo.               |
| GET    | `/health`                     | gateway up? sessions count? redis? postgres? |

**Autenticación:** reutiliza el middleware JWT existente de AION. Solo roles `operator` y `admin`.

**Schemas:** Zod para todo input/output. Documentación OpenAPI regenerada.

**Test de aceptación:**
- `vitest` con supertest cubre los 11 endpoints.
- `curl /api/v1/reverse/health` devuelve 200 con métricas.
- Swagger UI existente muestra los nuevos endpoints bajo tag `Reverse Connect`.

---

### AGENTE 7 — Frontend React (Fleet Reverse)

**Rol:** UI engineer. Crea una nueva vista, no toca las 49 existentes.

**Vista nueva:** `/reverse` (lazy-loaded).

- **Header:** resumen (N dispositivos online, pending approval, disconnected).
- **Tabla** de dispositivos con estado, vendor, último heartbeat, acciones.
- **Panel lateral** al seleccionar: live grid hasta 16 canales, PTZ joystick, log de eventos.
- **Modo kiosko** `/reverse/wall` para operadores (16/25/36 tiles).
- Paleta AION: `#030810` fondo, `#C8232A` alertas, `#D4A017` destacados. Montserrat 900 en títulos.
- Usa `@/components/ui/*` existentes (no reinventa botones).

**Test de aceptación:**
- Playwright E2E: navegar a `/reverse`, aprobar un device mock, arrancar stream, ver frames por ≥ 5 s, enviar PTZ.
- Lighthouse ≥ 90 performance.
- No regresión: todas las páginas existentes siguen renderizando (snapshot tests).

---

### AGENTE 8 — QA Automatizado (full stack)

**Rol:** Test engineer. Valida extremo a extremo.

**Suites:**
1. **Unit** (Go, Vitest) — ya cubiertas por agentes 2/3/5/6/7.
2. **Integration**:
   - `docker-compose.test.yml` con Postgres + Redis + go2rtc aislados.
   - Simuladores de equipo: `test/sim/dahua-client.go` y `test/sim/hik-client.go` que hablan DVRIP-R e ISUP contra el gateway.
   - 12 escenarios: registro ok, credenciales malas, heartbeat timeout, 100 sesiones concurrentes, stream start/stop, PTZ, evento de alarma, reconnect tras restart del gateway, approval flow, block flow, rotación de credenciales, fallo de go2rtc.
3. **Load**: k6 con 50 sesiones simultáneas, 3 streams por sesión = 150 streams. Criterio: gateway < 3 GB RAM, CPU < 60 %, 0 drops de heartbeat.
4. **Chaos**: matar `aion-reverse-gateway` con `kill -9`; las sesiones deben reestablecerse en < 30 s al reiniciar; los streams se recuperan en go2rtc automáticamente.
5. **Security**:
   - `nmap` de los puertos expuestos: solo 7660/7661/7681 aceptan conexiones esperadas.
   - `gosec` + `trivy` en la imagen Docker — 0 HIGH/CRITICAL.
   - Credenciales nunca en logs (grep automatizado).

**Test de aceptación:** todas las suites verdes en CI. Reporte en `/reports/reverse-connect-v1.1.0.html`.

---

### AGENTE 9 — Despliegue controlado

**Rol:** Release engineer.

**Procedimiento:**
1. Merge `feature/reverse-connect-gateway` → `main` vía PR con 1 reviewer (puedes ser tú, Isabella).
2. Tag `v1.1.0-reverse-connect`.
3. `ops/backups/pre-reverse-deploy.sh` → snapshot EBS + pg_dump + tar de `/opt/aion`.
4. `pm2 start /opt/aion/services/reverse-gateway/ops/pm2/ecosystem.reverse.config.js` — **solo el proceso nuevo**.
5. `pm2 save`.
6. Nginx: añadir location `/api/v1/reverse/*` → 127.0.0.1:3000 (ya apunta ahí tu Fastify; no cambia nada).
7. Prometheus: añadir target `aion-reverse-gateway:9464`.
8. **Canary:** habilitar reverse-connect en 1 solo sitio piloto (el de Medellín más cercano). Monitorear 24 h.
9. **Rollout:** habilitar en los 22+ sitios en grupos de 5, validando cada grupo 2 h.
10. Notificación por WhatsApp Business API (tu Twilio) al completar cada fase.

**Test de aceptación:**
- Los 22 sitios online en `reverse.sessions`.
- Latencia live view < 500 ms mediana, < 1 s p95.
- 0 alertas en Prometheus durante 48 h.

**Rollback:**
```bash
pm2 stop aion-reverse-gateway && pm2 delete aion-reverse-gateway
# los procesos AION existentes nunca se tocaron, así que no hay nada que restaurar ahí
# si además quieres borrar data nueva:
psql -c "DROP SCHEMA reverse CASCADE"
# revertir security groups según firewall-changelog.md
```

---

### AGENTE 10 — Verificador Final + Documentación

**Rol:** Técnico documentador.

**Entregables:**
1. `docs/reverse-connect/README.md` — arquitectura.
2. `docs/reverse-connect/operator-manual.es.md` — manual para operadores de Clave (cómo aprobar un equipo nuevo, cómo ver video, cómo PTZ).
3. `docs/reverse-connect/device-provisioning/` — instructivos con capturas para configurar cada familia:
   - Dahua: cómo llegar a "Red → Registro Automático" (tu screenshot original).
   - Hikvision: cómo habilitar "Platform Access / ISUP 5.0" en DVR, NVR y cámaras IP.
4. `docs/reverse-connect/runbook.md` — qué hacer cuando: un sitio no se conecta, el gateway reinicia, Postgres se llena, etc.
5. Video corto (screencast) para el onboarding del siguiente técnico.
6. Actualizar `aionseg.co/changelog` con la feature.

**Test de aceptación:** un técnico que no participó en el desarrollo puede provisionar un sitio nuevo siguiendo solo la docs, en < 15 min.

---

## 7. Prompt maestro para Claude Code CLI / AION Dev Agent

> Pega esto en tu CLI. Ejecuta los 11 agentes en orden. Cada uno consulta al anterior vía `reverse.audit_log`.

```
Eres el AION Reverse-Connect Autonomous Executor. Tu misión es implementar el
plan documentado en /opt/aion/docs/AION_REVERSE_CONNECT_MASTER_PLAN.md
siguiendo estas reglas inviolables:

1. Lee el plan completo antes de empezar. Si algo no está claro, detente y pregunta.
2. Ejecuta los AGENTES 0 → 10 en orden estricto. No saltes ninguno.
3. Antes de cada agente: verifica precondiciones del agente anterior y registra
   en reverse.audit_log (actor='agent-N', action='start').
4. Respeta los 10 principios inviolables de la §0. Prohibido destruir nada existente.
5. Al final de cada agente: corre su test de aceptación. Si falla, DETENTE,
   registra el fallo en reverse.audit_log, emite alerta por Telegram al canal
   de Isabella, y espera input humano. No intentes 'arreglar' saltando pasos.
6. Commits atómicos. Mensaje formato conventional commits: feat(reverse):, test(reverse):, etc.
7. Nunca uses git push --force. Nunca borres backups.
8. Al terminar agente 10: genera reporte HTML con cobertura de tests, métricas de
   performance, y lista de los 22 sitios conectados. Envíalo por WhatsApp a Isabella.

Stack confirmado:
- VPS: AWS t3.xlarge, São Paulo, 18.230.40.6
- OS: Ubuntu LTS
- Runtime existente: Node 20, Fastify, Drizzle, Postgres local, Redis, go2rtc, PM2, Nginx
- Runtime nuevo: Go 1.22 + cgo con SDKs Dahua/Hikvision
- Colores AION: #030810 navy, #C8232A red, #D4A017 gold
- Tipografía: Montserrat 900 headings

Arranca por el AGENTE 0 ahora. Reporta al final de cada agente.
```

---

## 8. Criterios de aceptación global (definition of done)

- [ ] Los 22+ sitios de Clave reportan al menos 1 sesión `online` en `reverse.sessions`.
- [ ] Cada sitio permite live view, PTZ, snapshot y eventos desde la UI de AION `/reverse`.
- [ ] 0 regresiones en los 887 tests existentes (re-run completo en CI).
- [ ] Cobertura del módulo nuevo ≥ 80 %.
- [ ] Latencia live view p50 < 500 ms, p95 < 1 s.
- [ ] Tag `v1.1.0-reverse-connect` firmado en git.
- [ ] Documentación completa y operador de Clave entrenado.
- [ ] Plan de rollback probado al menos una vez en staging.
- [ ] Dashboard Prometheus/Grafana con SLO: 99.5 % de sesiones `online` mensuales.
- [ ] IMOU API queda marcada como deprecated (se mantiene 30 días como fallback y luego se apaga).

---

## 9. Dependencias externas y cuentas necesarias

| Recurso                          | Dónde obtener                              | Estado    |
|----------------------------------|--------------------------------------------|-----------|
| Dahua NetSDK Linux64 v3.058+     | Portal partner Dahua (gratuito con cuenta) | Pendiente |
| Hikvision HCNetSDK + EHome/ISUP  | Portal open-hikvision (gratuito)           | Pendiente |
| AWS Security Group edit perms    | Ya tienes                                  | ✅         |
| Postgres role con CREATE SCHEMA  | Ya tienes (eres owner)                     | ✅         |
| Acceso físico/remoto a 1 XVR y 1 NVR para pruebas | Lo tienes en Medellín          | ✅         |

---

## 10. Riesgos y mitigaciones

| Riesgo                                            | Prob | Impacto | Mitigación                                              |
|---------------------------------------------------|------|---------|---------------------------------------------------------|
| SDK del fabricante cambia ABI en update           | M    | M       | Pin de versión, Docker image con SDK embebido.          |
| Firmware antiguo no soporta ISUP 5.0              | M    | M       | Detectar en handshake; caer a ISAPI vía VPN como fallback. |
| Puerto 7660/7661 bloqueado por ISP del cliente    | B    | A       | Documentar puertos alternos (443) vía tunneling.        |
| Carga media supera t3.xlarge                      | M    | A       | Pre-dimensionado: 150 streams caben; alertas > 70 % CPU.|
| Corrupción de credenciales encriptadas            | B    | A       | AES-GCM + key rotation mensual + backup cifrado.        |
| go2rtc API cambia entre versiones                 | B    | M       | Pin de versión go2rtc + tests contract.                 |
| Operador aprueba dispositivo fraudulento          | M    | A       | Approval requiere 2 roles + log audit + device fingerprint. |

---

## 11. Qué descartamos y por qué (para no volver a discutirlo)

- **DDNS propio en VPS:** no resuelve NAT entrante en los sitios. Descartado.
- **PPPoE:** solo da IP pública al router, inviable en 22 sedes. Descartado.
- **Forkear DSS/iVMS:** no son open source. Descartado.
- **iVMS-4200 como backend:** es cliente Windows, sin API server. Descartado.
- **IMOU/Hik-Connect:** dependencia de nube ajena, rate limits, lo que ya tienes y falla. Se deprecia tras rollout.
- **VPN en cada sitio (WireGuard):** viable pero costoso operacionalmente para 22+ sitios, y no aporta nada que los protocolos nativos ya hagan. Queda como plan B de emergencia si un ISP bloquea puertos.

---

**Fin del plan. Al ejecutar el Prompt Maestro de la §7, AION queda con reverse-connect productivo y los 22 sitios integrados sin dependencia de nubes ajenas.**

**Autora del plan:** Claude, para Isabella — Clave Seguridad CTA · AION.
**Versión:** 1.0 · Sunday, April 12, 2026.
