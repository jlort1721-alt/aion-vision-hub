# Skills + MCPs Roadmap — AION Vision Hub 2026-04-19

Plan de lo que falta integrar para que la plataforma se opere desde Claude Code / agentes con máxima eficiencia.

---

## 1. Skills locales (.claude/skills/)

Skills son scripts o prompts especializados que Claude Code puede invocar. Los existentes están en `.claude/skills/` (ver `using-superpowers`, `tdd`, etc). A continuación los que propongo añadir para operar AION.

### 1.1 Device audit skills (alta prioridad)

| Skill | `.claude/skills/<name>/SKILL.md` | Qué hace |
|---|---|---|
| **device-audit** | `device-audit/SKILL.md` | Login SDK a 41 devices (28 Hik + 13 Dahua) y reporta status, passwords válidos, channels |
| **stream-health** | `stream-health/SKILL.md` | Verifica HLS de cada stream go2rtc + genera reporte con links rotos + tabla `stream_key ↔ device_id` |
| **dvr-unlock-check** | `dvr-unlock-check/SKILL.md` | Detecta DVRs Hikvision en lockout + sugiere reboot físico o espera; calcula tiempo restante estimado |
| **imou-refresh** | `imou-refresh/SKILL.md` | Llama Imou Open Platform API y regenera URLs HLS firmadas para los 13 Dahua |

**Esfuerzo estimado total: 4h**

### 1.2 Operational skills

| Skill | Qué hace |
|---|---|
| **alarm-monitor** | Summary últimos 100 eventos `isapi_events` con severity + device + sitio |
| **access-control-audit** | Revisa 37 puertas + última apertura, flagea devices sin actividad >24h |
| **backup-snapshot** | Trigger manual de `pg_dump` + backup configs + upload a MinIO |
| **dev-deploy-check** | Valida antes de deploy: tests, TS check, migrations pending |
| **incident-postmortem** | Plantilla interactiva para escribir post-mortems después de incidentes |

**Esfuerzo: 3-4h**

### 1.3 Intelligence / LLM skills

| Skill | Qué hace |
|---|---|
| **pm2-cluster-ops** | Start/stop/restart/reload de clusters PM2 con validation post-op |
| **go2rtc-stream-manager** | Crea/modifica/test streams en go2rtc.yaml con backup automático |
| **openclaw-plan-review** | Lista `/home/openclaw/devops/plans/` y ayuda a aprobar/rechazar cambios |
| **sdk-diagnostic** | Test integrado HCNetSDK + NetSDK con reporte de sesiones concurrent |

**Esfuerzo: 3h**

---

## 2. MCPs (Model Context Protocol)

MCPs existentes en `.claude/settings.local.json`:
- **Context7** — docs libraries (Fastify, Drizzle, React)
- **n8n-MCP** — 60 workflows + 1396 node types
- **Claude-Mem** — persistent memory
- **Supabase** — legacy

### 2.1 MCPs a añadir (alta prioridad)

| MCP | Propósito | Complejidad |
|---|---|---|
| **go2rtc-mcp** | Query streams, create/delete streams, restart config | baja (HTTP API) |
| **hikvision-isapi-mcp** | PUT/GET ISAPI a DVRs directamente desde Claude (configurar motion, leer eventos) | baja (HTTP digest) |
| **pm2-mcp** | `pm2 start/stop/restart/list/logs` remoto desde Claude | baja (SSH wrapper) |
| **prometheus-mcp** | Query PromQL desde Claude para debugging | media |
| **loki-mcp** | LogQL queries para buscar errores cruzando jobs | media |
| **grafana-mcp** | Create dashboards + alertas + screenshots | alta |

### 2.2 MCPs de integración avanzada

| MCP | Propósito |
|---|---|
| **mosquitto-mcp** | Publish/subscribe MQTT para testing event bus canonical |
| **ffmpeg-mcp** | Transcoding, analyze streams, extract frames, detect video quality |
| **postgres-mcp** | Query DB con safety layer (read-only default, write con confirmación) |
| **wireguard-mcp** | Config/peers management (cuando se conecte VPN sitio) |
| **nginx-mcp** | Edit config + reload + test nginx -t |
| **docker-mcp** | Query containers + logs + exec + compose up/down |

### 2.3 MCPs domain-specific

| MCP | Propósito |
|---|---|
| **imou-open-platform-mcp** | Imou API: list devices, get HLS URL, subscribe events |
| **dahua-netsdk-mcp** | Wrapper del NetSDK Python 2.0.0.1 (login, real-play, capture, PTZ) |
| **asterisk-ari-mcp** | REST wrapper sobre Asterisk ARI para intercom calls |
| **minio-mcp** | Upload/list/download buckets + lifecycle policies |

---

## 3. Prioridad de implementación

### Fase 1 — Esencial (esta semana)
1. `device-audit` skill — permite diagnosticar los 41 devices rápido
2. `stream-health` skill — confirma video real
3. `go2rtc-mcp` — gestión de streams
4. `pm2-mcp` — operaciones PM2 desde chat

### Fase 2 — Útil (este mes)
5. `hikvision-isapi-mcp` — configurar DVRs remotos
6. `imou-refresh` skill — regenera URLs Dahua
7. `alarm-monitor` skill — visibilidad eventos
8. `loki-mcp` + `prometheus-mcp` — observabilidad

### Fase 3 — Avanzado (siguiente ciclo)
9. `dahua-netsdk-mcp` — para cuando haya devices enterprise
10. `wireguard-mcp` — cuando peer sitio esté disponible
11. `grafana-mcp` — dashboards programáticos
12. `docker-mcp` + `nginx-mcp` — operaciones infra

---

## 4. Agentes sub-especializados

Agentes en `.claude/agents/` actuales:
- planner, architect, tdd-guide, code-reviewer, security-reviewer, build-error-resolver, e2e-runner, refactor-cleaner, doc-updater
- api-docs-generator, db-migration, deploy-rollback, incident-response, integration-tester, module-scaffold, monitor-observe, perf-profiler

### Agentes a añadir

| Agent | Propósito |
|---|---|
| **device-operator** | Specialist en operar DVR/NVR remotos vía SDK + ISAPI |
| **stream-troubleshooter** | Especializado en debugging go2rtc + ffmpeg + HLS |
| **openclaw-liaison** | Interface con OpenClaw para revisar planes propuestos |
| **imou-integrator** | Gestión Imou Open Platform API |
| **wireguard-operator** | Configuración + monitoreo VPN peers |

---

## 5. Hooks adicionales (.claude/hooks/)

Hooks actuales (9 scripts, ver `/rules/hooks.md`).

### Hooks a añadir

| Hook | Cuando dispara | Qué hace |
|---|---|---|
| `pre-deploy-smoke` | PreToolUse en `pm2 reload` o `docker compose up` | Ejecuta `curl /api/health` y bloquea si !=200 |
| `dvr-session-limit` | PreToolUse en scripts que usen `hik_pull` | Cuenta procesos activos, bloquea si >10 |
| `secret-scan-deeper` | PostToolUse Write | Regex más estricta (incluye JWTs, tokens bearer) |
| `go2rtc-yaml-validate` | PostToolUse Write en `.yaml` | Valida sintaxis antes de permitir commit |

---

## 6. Commands (.claude/commands/)

Commands existentes: 25 (ver `/.claude/rules/`).

### Commands a añadir

| Command | Qué hace |
|---|---|
| `/device-audit [brand=<>]` | Corre auditoría de devices |
| `/live-view-check` | Test HLS de todos los streams |
| `/dvr-cooldown-check` | Reporte de DVRs en lockout + ETA |
| `/openclaw-status` | Último reporte + planes pendientes |
| `/imou-refresh-urls` | Regenera URLs HLS Dahua Imou |
| `/backup-now` | Trigger manual pg_dump + tar configs + MinIO upload |

---

## 7. Cómo implementar (esqueleto)

### 7.1 Skill ejemplo `device-audit`

```
.claude/skills/device-audit/
├── SKILL.md                    # descripción + cuándo usar
├── audit-hikvision.py          # script Python ctypes HCNetSDK
├── audit-dahua.py              # script que usa NetSDK Python
└── templates/
    └── report-template.md       # output format
```

`SKILL.md`:
```markdown
---
name: device-audit
description: Comprehensive SDK login check across all 41 registered devices
---

# Device Audit

Valida login SDK a los 28 Hikvision (HCNetSDK) y 13 Dahua (NetSDK Python
2.0.0.1), reporta status + passwords válidos + channels + firmware.

## Uso
/device-audit                 # todos
/device-audit brand=hikvision # solo Hik

## Output
Tabla markdown con: device_name | ip/serial | status | pw | channels | firmware
```

### 7.2 MCP ejemplo `go2rtc-mcp`

```typescript
// .claude/mcp/go2rtc-mcp/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import fetch from "node-fetch";

const GO2RTC = process.env.GO2RTC_API_URL ?? "http://127.0.0.1:1984/api";

const server = new Server(
  { name: "go2rtc-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler("tools/list", async () => ({
  tools: [
    { name: "list_streams", description: "List all go2rtc streams with producer status" },
    { name: "get_stream", description: "Get detail of one stream by key", inputSchema: {...} },
    { name: "add_stream", description: "Add new stream to go2rtc.yaml", inputSchema: {...} },
    { name: "test_hls", description: "Probe HLS endpoint", inputSchema: {...} },
  ],
}));

server.setRequestHandler("tools/call", async (req) => {
  const { name, arguments: args } = req.params;
  if (name === "list_streams") {
    const r = await fetch(`${GO2RTC}/streams`);
    return { content: [{ type: "text", text: JSON.stringify(await r.json()) }] };
  }
  // ...
});
```

---

## 8. Roadmap de implementación

| Sprint | Semana | Entregables |
|---|---|---|
| S1 | Esta | `device-audit`, `stream-health`, `go2rtc-mcp`, `pm2-mcp` |
| S2 | Próxima | `hikvision-isapi-mcp`, `imou-refresh`, `alarm-monitor`, `openclaw-plan-review` |
| S3 | +2 sem | `prometheus-mcp`, `loki-mcp`, hooks adicionales, commands adicionales |
| S4 | +3 sem | `grafana-mcp`, `imou-open-platform-mcp`, agents especializados |

---

## 9. Dependencias para estos MCPs/skills

### APIs / credentials necesarias

| Recurso | Estado | Bloqueador |
|---|---|---|
| Anthropic API key (Claude) | Pendiente de pasar nueva | User promete entregarla |
| OpenAI API key | Ya en OpenClaw | Rotar a nueva tras mover a vault |
| Imou Open Platform App ID + Secret | Faltante | Cliente/operador crea cuenta dev |
| Grafana API token | Faltante | Crear service account en Grafana |
| Prometheus (no requiere auth) | OK | — |
| Loki (no requiere auth) | OK | — |
| go2rtc (no requiere auth local) | OK | — |
| Mosquitto auth para MCP | OK | usar `aion_probe` user |
| Hikvision ISAPI credentials | OK | `admin:Clave.seg2023` o variants |
| PM2 SSH | OK | SSH key ya disponible |

### Software dependencies

- **Node.js 20+** ya en VPS
- **Python 3.12** ya en VPS
- **@modelcontextprotocol/sdk** — npm install en local cuando haga MCPs
- **NetSDK Python 2.0.0.1** ya instalado para Dahua MCP
- **HCNetSDK v6.1.9** ya instalado para Hikvision MCP

---

## 10. Efecto esperado

Con estos skills + MCPs:

- **Tiempo diagnóstico** reducido de 15 min a 30s (`/device-audit`)
- **Cambios configuración** desde chat sin SSH manual (`/go2rtc` commands)
- **Visibilidad** de eventos y métricas sin abrir Grafana (queries directas)
- **Onboarding** operadores nuevos — reducido de 1 día a 1 hora
- **Escalabilidad** — agregar nuevo DVR en 2 min con `/device-register`
