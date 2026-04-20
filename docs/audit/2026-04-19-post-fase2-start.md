# Post P0 — Estado del VPS (Fase 2 start)

**Fecha:** 2026-04-20 02:39 UTC (arranque Fase 2)
**Contexto:** tras completar P0.1 (vault OpenClaw) y P0.2 (logrotate). Sin tocar DVRs — cooldown Hikvision vigente.

---

## 1. OpenClaw

| Check | Estado |
|---|---|
| `systemctl is-active openclaw` | `active` |
| Drop-in override cargado | `/etc/systemd/system/openclaw.service.d/override.conf` |
| Env vars plaintext en unit | eliminadas (solo `HOME/OPENCLAW_HOME/NVM_DIR` residen ahí) |
| `EnvironmentFile` | `/etc/aion/secrets/openclaw.env` (600 root:root) |
| Gateway HTTP | `http://127.0.0.1:18789/health` → `200` |
| Ports en LISTEN | `127.0.0.1:18789`, `127.0.0.1:18791`, `::1:18789` |
| Restart reciente | 02:37:21 UTC (PID 1245291) sin errores |

Runbook de rotación: [`docs/runbooks/openclaw-secrets-rotation.md`](../runbooks/openclaw-secrets-rotation.md).

## 2. Logrotate

| Check | Estado |
|---|---|
| `/etc/logrotate.d/openclaw` | instalado (644 root:root) |
| Cobertura | `/home/openclaw/.openclaw/*.log` + `/home/openclaw/.openclaw/logs/*.log` |
| Política | `daily`, `rotate 14`, `maxsize 100M`, `compress`, `delaycompress`, `copytruncate` |
| `su` | `openclaw openclaw` (evita error de perms) |
| `logrotate --debug` | patrones OK, state file creado, rotaciones previas detectadas |

## 3. Servicios PM2

- **Total:** 32 procesos registrados.
- **Online:** 19.
- **Stopped:** 13 — todos los `snap-*` (correcto, cooldown activo).
- **Errored:** 0.

Los snap workers permanecerán stopped hasta confirmar cooldown DVR (≥ 06:00 UTC 2026-04-19) y se reactivarán por fases (runbook separado).

## 4. Endpoints clave

| Servicio | Resultado |
|---|---|
| `https://aionseg.co/api/health` | `200` en 43 ms |
| `http://127.0.0.1:18789/health` (OpenClaw) | `200` |
| `http://127.0.0.1:1984/api/streams` (go2rtc) | `200` |

## 5. Recursos

| Métrica | Valor |
|---|---|
| Disco `/` | 47G/193G (24%) |
| RAM | 6.2G/30G usado, 14G libre, 10G buff/cache |

## 6. Sin cambios en DVRs

- **No** se ejecutaron logins SDK Hikvision/Dahua durante Fase 2 P0.
- **No** se reiniciaron workers snap-* ni hik-* que pudieran saturar sesiones.
- El cooldown programado (≥ 2–4 h desde 2026-04-19 02:00 UTC) se respeta.

## 7. Deltas vs state integral 2026-04-19

| Ítem | Antes (2026-04-19) | Después (2026-04-20 02:39) |
|---|---|---|
| OpenClaw keys | plaintext en systemd unit | vault 600 root:root |
| OpenClaw drop-in | ausente | `override.conf` activo |
| Logrotate openclaw | sin configurar | configurado + validado |
| Estado PM2 | 19 online / 13 stopped | idéntico (sin tocar DVRs) |

## 8. Siguiente tramo

Proceder con P1:
1. Skill `device-audit` (DRY-RUN default).
2. Skill `stream-health`.
3. Skill `imou-refresh`.
4. MCP `go2rtc-mcp`.
5. MCP `pm2-mcp`.
6. Runbook GitHub Secrets.
7. Alertmanager + Slack webhook.

Ningún P1 tocará DVRs por SDK mientras el cooldown esté activo.
