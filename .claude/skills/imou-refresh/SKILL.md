---
name: imou-refresh
description: Refresh HLS URLs for 13 Dahua consumer devices via Imou Open Platform API (getLiveStreamInfo). Writes refreshed URLs back to devices + go2rtc.yaml fragment.
---

# imou-refresh

Los 13 dispositivos Dahua consumer están registrados en cuentas Imou del cliente. El SDK enterprise no soporta P2P rendezvous de Imou, así que dependemos de URLs HLS firmadas que **expiran en horas/días**. Este skill las renueva vía Imou Open Platform.

## Requisitos previos

1. Cuenta Imou Open Platform dev: https://open.imoulife.com/
2. `IMOU_APP_ID` + `IMOU_APP_SECRET` registrados en `/etc/aion/secrets/imou.env` (600 root:root).
3. Dispositivos asociados a la app en Imou console.
4. Ver runbook de alta: `docs/runbooks/imou-open-platform-setup.md`.

## Modos

| Flag | Efecto |
|---|---|
| _(default)_ | Renueva URLs de **todos** los Dahua activos |
| `--device=<serial>` | Un solo device por serial |
| `--dry-run` | Llama a Imou pero no escribe DB ni yaml |
| `--reload-go2rtc` | Tras escribir yaml, manda `go2rtc reload` |

## Invocación

```bash
bash .claude/skills/imou-refresh/scripts/refresh.sh
bash .claude/skills/imou-refresh/scripts/refresh.sh --reload-go2rtc
bash .claude/skills/imou-refresh/scripts/refresh.sh --device=AJ00421PAZF2E60 --dry-run
```

## Output

1. Reporte `/tmp/imou-refresh-<ts>.md` con: serial | name | hls_url (ofuscada) | expires_at | status.
2. Actualiza `devices.hls_url` + `devices.hls_expires_at` en DB (si no `--dry-run`).
3. Actualiza fragmento `/etc/aion/go2rtc-imou.fragment.yaml` y lo incluye desde `go2rtc.yaml`.

## Garantías

- No expone APP_SECRET en stdout ni logs.
- Rate-limit: ≤ 5 req/s a Imou (retry con backoff si 429).
- Si serial devuelve "DeviceOffline" → mantiene URL anterior + marca `stale`.

## Secrets vault esperado

```
/etc/aion/secrets/imou.env        # 600 root:root
IMOU_APP_ID=...
IMOU_APP_SECRET=...
IMOU_API_BASE=https://openapi.easy4ip.com/openapi
```
