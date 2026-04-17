# ADR 0003 — Rol del servicio `openclaw`

**Fecha:** 2026-04-17
**Estado:** Propuesto — requiere documentación
**Autor:** Claude Code

## Contexto

Al auditar el VPS se encontraron 3 servicios custom que usan el nombre "openclaw":

- `openclaw.service` — systemd, activo. Binario: `/home/openclaw/.openclaw/workspace/.git`-based.
- `aion-continuous-improvement.service` — "AION Continuous Improvement Agent (OpenClaw)".
- Usuario shell `openclaw` existe (`/home/openclaw/`).

Puertos observados ocupados por OpenClaw:
- `127.0.0.1:18789`, `127.0.0.1:18791` — gateway
- `127.0.0.1:9465`, `127.0.0.1:9540` — OWL (posiblemente OpenWhisk-like?)

Conexiones activas salientes desde `openclaw-gatewa` PID 44076:
- `104.18.2.115:443` — Cloudflare (probablemente API de algún servicio)
- `149.154.166.110:443` — **Telegram Bot API** (MTProto endpoint)

## Decisión

**Documentar antes de tocar.** El servicio tiene ownership externo (usuario dedicado, git repo propio) y conexiones persistentes a APIs externas — apagarlo sin confirmación puede romper bot de Telegram, CI/CD, o agente de mejora continua.

## Plan

1. **Preguntar a Isabella:**
   - ¿Es un agente de auto-mejora desarrollado internamente?
   - ¿Está activamente usado o es una prueba antigua?
   - ¿Qué Telegram chat recibe sus mensajes?

2. **Si es activo:**
   - Documentar en `aion/docs/runbooks/openclaw.md`.
   - Añadir health endpoint al monitoring.
   - Considerar migrarlo a un container Docker para consistencia.

3. **Si es legacy/no usado:**
   - Backup de `/home/openclaw/` a `/var/backups/aion/openclaw-YYYYMMDD/`.
   - `systemctl stop openclaw aion-continuous-improvement`.
   - `systemctl disable openclaw aion-continuous-improvement`.
   - Dejar el usuario shell pero sin login activo.

## Alertas relacionadas (añadir si se mantiene)

```yaml
- alert: OpenClawGatewayDown
  expr: up{job="openclaw-gateway"} == 0
  for: 5m
  labels:
    severity: medium
```

## Consecuencias

- **Si apagamos sin preguntar:** potencial pérdida de notificaciones Telegram, agente de mejora continua dejaría de enviar métricas, algo podría depender de su webhook.
- **Si documentamos y mantenemos:** +1 servicio del que hay que preocuparse, pero con runbook claro.
