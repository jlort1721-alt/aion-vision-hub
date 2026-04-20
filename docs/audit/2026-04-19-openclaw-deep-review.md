# OpenClaw — Review profundo

**Fecha:** 2026-04-19
**Versión instalada:** workspace en `/home/openclaw/.openclaw/`

---

## 1. Qué es OpenClaw en este VPS

OpenClaw es un **agente de mejora continua 24/7** integrado en el VPS. Su arquitectura:

```
aion-continuous-improvement.sh (cron shell)
    ↓ cada 30 min
POST http://127.0.0.1:18789/agent/aion-improver
    ↓
openclaw-gateway (Node.js)
    ↓
openclaw core (CLI con LLM)
    ↓ LLM API
Claude (Anthropic) + OpenAI (GPT-4)
    ↓ output
/home/openclaw/devops/{plans,reports}/*.json
```

## 2. Components en ejecución

| Component | PID | Port | Rol |
|---|---|---|---|
| `openclaw` (core) | 43639 | — | Proceso base del agente |
| `openclaw-gateway` | 44076 | 18789, 18791 | API REST para que scripts llamen al agente |
| `owld` (OWL) | 44365 | 9465, 9540 | Gateway SIP GB28181 para cámaras chinas (separado del agente) |
| `aion-continuous-improvement.sh` | 1075 | — | Loop cada 30 min que alimenta al agente |

## 3. Lo que hace cada ciclo (iteración #119)

1. **Monitor** — recoge: health check, PM2 restarts, errores, métricas disk/RAM/load, alertas proactivas
2. **Analyze** — envía JSON al gateway, el LLM analiza y devuelve diagnóstico + propuestas + severidad
3. **Plan** — guarda en `/home/openclaw/devops/plans/<ts>.json`
4. **Implement** — **solo si hay aprobación humana** en `exec-approvals.json`
5. **Test** — corre tests relacionados
6. **Deploy** — si tests green, despliega (ej. `pm2 reload`)

## 4. Estado último reporte (iteración 119, 2026-04-19T16:35)

```json
{
  "timestamp": "2026-04-19T16:35:58+00:00",
  "iteration": 119,
  "health": {"errors": 99},
  "pm2_restarts": [],
  "proactive_alerts": [],
  "recent_errors_count": 1,
  "disk_summary": ""
}
```

**Lectura:**
- `"health":{"errors":99}` — 99 errores acumulados en módulos (acumulativo)
- `pm2_restarts: []` — ningún restart reciente ✅
- `proactive_alerts: []` — nada urgente
- Errores muestreados son newlines (probable output roto de algún comando)

## 5. Issues detectados

### 🚨 CRÍTICO — API keys en systemd en texto plano

En `/etc/systemd/system/openclaw.service` las variables `Environment=OPENAI_API_KEY=` y `Environment=ANTHROPIC_API_KEY=` tienen las keys reales en claro.

**Problema:** cualquier backup del filesystem (snapshot EBS, tar) las incluye. Con sudo cualquiera las lee.

**Fix:**

```bash
# 1. Mover a vault
sudo mkdir -p /etc/aion/secrets
# Cuando el user pase las keys nuevas, editarlas en este file:
sudo nano /etc/aion/secrets/openclaw.env
# Contenido (placeholder — no committear):
#   OPENAI_API_KEY=<KEY>
#   ANTHROPIC_API_KEY=<KEY>
#   OPENCLAW_GATEWAY_TOKEN=<TOKEN>
sudo chmod 600 /etc/aion/secrets/openclaw.env
sudo chown root:root /etc/aion/secrets/openclaw.env

# 2. Editar unit — override con systemctl edit
sudo systemctl edit openclaw.service
# Añadir:
#   [Service]
#   # Clear existing envs (redact inline Environment=)
#   Environment=
#   EnvironmentFile=/etc/aion/secrets/openclaw.env

# 3. Reload
sudo systemctl daemon-reload
sudo systemctl restart openclaw

# 4. Rotar keys (las viejas están en snapshots previos)
```

### ⚠️ MEDIA — event-bridge.log crece sin límite

El archivo diario tiene 2.2 MB. Sin rotación estricta crece 60+ MB/mes.

**Fix:**

```bash
sudo tee /etc/logrotate.d/openclaw > /dev/null <<'LOGROT'
/home/openclaw/.openclaw/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    copytruncate
    su openclaw openclaw
}
LOGROT
```

### ⚠️ MEDIA — Parse timestamp fail en logs

`journalctl -u openclaw` muestra: `Failed to parse timestamp: "2`

Indica que algún log emit tiene formato `"2` (truncado). Probable bug en el logger del gateway. No crítico.

### ℹ️ BAJA — Planes propuestos no se auto-ejecutan

`exec-approvals.json` vacío → el agente propone pero espera aprobación manual. Esto es por diseño de seguridad, pero significa que las mejoras propuestas se acumulan sin aplicarse.

**Acción sugerida:**
1. Revisar `/home/openclaw/devops/plans/` semanalmente
2. Aprobar planes relevantes en `exec-approvals.json`
3. O configurar whitelist de tipos de cambio auto-aprobables (ej. `pm2 reload`, `systemctl restart`)

### ℹ️ BAJA — No hay métricas en Grafana

**Mejora:** añadir exporter que lea `/home/openclaw/devops/reports/*.json` y exponga a Prometheus:
- `openclaw_iteration_count`
- `openclaw_health_errors`
- `openclaw_pm2_restarts`
- `openclaw_plan_pending` / `openclaw_plan_executed`

---

## 6. Valor real que entrega OpenClaw

**Beneficios detectados:**

1. ✅ Auto-diagnóstico cada 30 min sin intervención humana
2. ✅ Conexión Telegram (probable notificación a operador)
3. ✅ Historial de iteraciones persistente (119 iteraciones = 60h de monitoreo continuo)
4. ✅ Integrado con múltiples LLMs (Claude + OpenAI)

**Limitaciones detectadas:**

1. ❌ No ejecuta cambios automáticamente (exec-approvals.json requiere human input)
2. ❌ Output no visible en Grafana
3. ❌ API keys expuestas en systemd
4. ⚠️ Logs sin rotación

---

## 7. Recomendación final OpenClaw

**Vale la pena mantenerlo** pero hay que:

1. **Hoy**: fix de seguridad API keys (mover a `/etc/aion/secrets/`)
2. **Esta semana**: logrotate + Grafana exporter
3. **Este mes**: revisar `devops/plans/` y aprobar cambios específicos

**No tocar el core** de OpenClaw (tiene su propio repo upstream). Solo configurar mejor alrededor.

---

## 8. Para integrar la nueva API key Claude del user

Cuando el user me pase la nueva Claude API key, los pasos son:

### 8.1 Actualizar OpenClaw para usarla

```bash
# 1. Escribir /etc/aion/secrets/openclaw.env (placeholder)
sudo tee /etc/aion/secrets/openclaw.env <<'EOF'
OPENAI_API_KEY=REEMPLAZAR
ANTHROPIC_API_KEY=REEMPLAZAR
CLAUDE_MODEL=claude-opus-4-7
EOF
sudo chmod 600 /etc/aion/secrets/openclaw.env

# 2. Systemctl override
sudo systemctl edit openclaw.service
# [Service]
# Environment=
# EnvironmentFile=/etc/aion/secrets/openclaw.env

# 3. Restart
sudo systemctl daemon-reload && sudo systemctl restart openclaw

# 4. Verify
sudo journalctl -u openclaw --since "1 min ago" | grep -i anthropic
```

### 8.2 Actualizar backend aionseg-api si usa Claude

```bash
ssh aion-vps
sudo grep -l "ANTHROPIC_API_KEY" /var/www/aionseg/backend/apps/backend-api/.env
# Editar con la nueva key
pm2 reload aionseg-api
```

### 8.3 Test después de integrar

```bash
# Call al agent improver
curl -s -X POST http://127.0.0.1:18789/agent/aion-improver \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}'
# Debe devolver JSON con response del LLM
```

---

## 9. Archivos relevantes (paths en VPS)

```
/etc/systemd/system/openclaw.service            # systemd unit (mover API keys)
/home/openclaw/.env                             # env del usuario openclaw
/home/openclaw/aion-continuous-improvement.sh   # script del loop cada 30 min
/home/openclaw/.openclaw/                       # config core agente
/home/openclaw/devops/plans/                    # planes propuestos JSON
/home/openclaw/devops/reports/                  # reportes por iteración
/home/openclaw/.openclaw/event-bridge.log       # log principal ~2.2MB/día
/home/openclaw/.openclaw/exec-approvals.json    # whitelist ejecución
/opt/aion/vision-hub/bin/owld                   # OWL SIP GB28181 (separado)
```
