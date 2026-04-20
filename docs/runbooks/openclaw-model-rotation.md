# OpenClaw — Rotación del modelo LLM

**Motivo del runbook:** OpenClaw emite peticiones al API de Anthropic usando el modelo configurado en `/home/openclaw/.openclaw/.openclaw/openclaw.json`. Cuando Anthropic deprecia un modelo (retorna HTTP 404 `not_found_error`), el agente falla silenciosamente — las respuestas por Telegram/WhatsApp emergen como "HTTP 404: not_found_error: model: XXX". Este runbook explica cómo rotar el modelo sin downtime del servicio.

---

## 1. Síntoma

Logs de error tipo:

```
[agent/embedded] embedded run agent end: ... isError=true
  model=claude-sonnet-4-20250514 provider=anthropic
  error=HTTP 404 not_found_error: model: claude-sonnet-4-20250514
  rawError=404 {"type":"error","error":{"type":"not_found_error","message":"model: …"}}
```

Y en Telegram / WhatsApp, el bot responde literalmente con el mensaje de error.

Los logs viven en `/home/openclaw/.openclaw/logs/gateway-error.log`.

---

## 2. Verificar qué modelos están vigentes

Test directo al API con la key del vault:

```bash
ssh aion-vps
KEY=$(sudo sed -n 's/^ANTHROPIC_API_KEY=//p' /etc/aion/secrets/openclaw.env)
for MODEL in claude-opus-4-7 claude-sonnet-4-6 claude-haiku-4-5-20251001; do
  status=$(curl -sS -o /dev/null -w '%{http_code}' \
    https://api.anthropic.com/v1/messages \
    -H "x-api-key: $KEY" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" \
    -d "{\"model\":\"$MODEL\",\"max_tokens\":5,\"messages\":[{\"role\":\"user\",\"content\":\"ok\"}]}")
  echo "$MODEL → $status"
done
```

200 = válido; 404 = deprecated.

---

## 3. Identificar dónde está el modelo configurado

OpenClaw almacena la default en:

```
/home/openclaw/.openclaw/.openclaw/openclaw.json
```

Campo: `agents.defaults.model` (ej. `anthropic/claude-sonnet-4-6`).

Comprobar el valor actual:

```bash
sudo jq '.agents.defaults.model' /home/openclaw/.openclaw/.openclaw/openclaw.json
```

> **Nota:** hay una segunda copia en `/home/openclaw/.openclaw/openclaw.json` que NO es la que OpenClaw lee (tiene `model: null`). La ruta "doblemente anidada" `/.openclaw/.openclaw/` es la canónica — es un artefacto de cómo OpenClaw inicializó sus dirs.

También existe `CLAUDE_MODEL` en `/etc/aion/secrets/openclaw.env` pero **no parece ser usado** por el gateway actualmente; se mantiene por consistencia.

---

## 4. Rotar el modelo

```bash
ssh aion-vps
CONFIG=/home/openclaw/.openclaw/.openclaw/openclaw.json

# 1. Backup antes de modificar
sudo cp -a "$CONFIG" /root/trash-2026-04-20/openclaw-config.before-model-fix.$(date -u +%Y%m%dT%H%M%SZ).json

# 2. Sustituir el modelo (reemplaza OLD/NEW según tu caso)
sudo sed -i "s|anthropic/claude-sonnet-4-20250514|anthropic/claude-sonnet-4-6|g" "$CONFIG"

# 3. Opcional: actualizar también el vault para consistencia
sudo sed -i 's|^CLAUDE_MODEL=.*|CLAUDE_MODEL=claude-sonnet-4-6|' /etc/aion/secrets/openclaw.env

# 4. Restart openclaw
sudo systemctl restart openclaw
sleep 10

# 5. Verificar que el nuevo modelo aparece en logs
sudo tail -20 /home/openclaw/.openclaw/logs/gateway.log | grep "agent model"
# Esperado: 2026-…+00:00 [gateway] agent model: anthropic/claude-sonnet-4-6
```

---

## 5. Validación post-rotación

```bash
# A. Health HTTP del gateway
curl -sS -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:18789/health
# Esperado: 200

# B. Service activo
systemctl is-active openclaw
# Esperado: active

# C. Próximos 15 minutos sin errores 404 en el log
sudo tail -f /home/openclaw/.openclaw/logs/gateway-error.log | grep --line-buffered not_found
# Esperado: sin output (el stream queda quieto)

# D. Esperar al próximo ciclo de improvement (cada 30 min, en minuto X:06 o X:36 UTC)
#    y validar que el nuevo report fue escrito sin errores:
sudo ls -lt /home/openclaw/devops/reports/ | head -3
sudo cat /home/openclaw/devops/reports/$(sudo ls -t /home/openclaw/devops/reports/ | head -1) | jq .

# E. Prometheus exporter debe reflejar iteration+1 al llegar el report
curl -s http://127.0.0.1:9109/metrics | grep openclaw_iteration_count
```

---

## 6. Tabla de modelos Anthropic vigentes (2026-04-20)

| Modelo ID | Cuándo usar |
|---|---|
| `claude-opus-4-7` | Decisiones arquitectónicas complejas, razonamiento profundo |
| `claude-sonnet-4-6` | **Default para OpenClaw** — balance costo/calidad, loop 30 min |
| `claude-haiku-4-5-20251001` | Agentes ligeros, alta frecuencia (>1/min) |

Prefix correcto para OpenClaw: `anthropic/<MODEL_ID>`.

---

## 7. Historial

| Fecha | De → A | Motivo |
|---|---|---|
| 2026-04-20 06:27 UTC | `claude-sonnet-4-20250514` → `claude-sonnet-4-6` | API devolvió 404 `not_found_error`. Modelo deprecated por Anthropic. El error se propagaba a Telegram (`@aion_seguridad_bot` bot) y WhatsApp como respuesta literal. |

---

## 8. Guardrails

- **NO modificar `openclaw.json` con el servicio corriendo** sin backup. SIGHUP no recarga config en OpenClaw — requiere `systemctl restart`.
- **Siempre testear el nuevo modelo** contra `/v1/messages` de Anthropic ANTES de aplicar el cambio.
- **No usar API models listing** (`/v1/models`) para decidir — no siempre incluye todos los modelos; usar `claude-api` skill / docs de Anthropic.
- **El prefix `anthropic/`** es obligatorio en el campo `agents.defaults.model`. Sin él, OpenClaw no sabe qué provider usar.
