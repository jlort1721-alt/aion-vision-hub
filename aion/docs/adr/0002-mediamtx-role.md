# ADR 0002 — Rol de MediaMTX

**Fecha:** 2026-04-17
**Estado:** Propuesto — requiere investigación
**Autor:** Claude Code

## Contexto

`mediamtx.service` corre como systemd desde antes de la auditoría de 2026-04-17. Coexiste con `go2rtc` (ADR 0001 propone como canónico).

Estado observado:
- `systemctl status mediamtx` → active
- Puertos detectados: no listados en `ss -tulpn` como escuchando puertos estándar MediaMTX (8554 lo ocupa go2rtc, 1935 RTMP no visible).
- Sin mount points, sin config visible en `/etc/mediamtx/` por defecto.
- Sin procesos aparentes consumiéndolo.

## Decisión

**Investigar durante 7 días antes de decidir.** No desactivar sin evidencia.

## Plan de investigación

1. `systemctl cat mediamtx` — ver Unit + ExecStart para identificar config path.
2. Buscar config YAML: `sudo find /etc /opt /var -name "mediamtx.yml" -o -name "mediamtx.yaml" 2>/dev/null`.
3. `journalctl -u mediamtx --since "24 hours ago"` — ver actividad.
4. `sudo ss -tulpn | grep mediamtx` — ver puertos reales.
5. Revisar si algún PM2 worker (`snap-*`, `imou-live-server`) invoca RTSP vía `rtsp://localhost:PORT` diferente a go2rtc.

## Posibles roles

| Hipótesis | Evidencia a buscar |
|---|---|
| Relay de RTSP para cámaras IMOU/Dahua cuando go2rtc falla | Logs con reconexiones desde `imou-live-server` |
| Grabación legacy a disco | Archivos en `/data/recordings/` con timestamps recientes |
| Herramienta de debug dejada en prod | Config vacío, puertos default cerrados |
| Compatibilidad ONVIF/NTS | go2rtc ya cubre ONVIF |

## Acción si...

- **Es activamente usado:** dejar como está, documentar rol en `aion/docs/runbooks/mediamtx.md`.
- **No hay evidencia de uso:** `systemctl stop mediamtx && systemctl disable mediamtx`, tag `adr-0002-mediamtx-decommissioned`.

## Riesgo

Bajo — MediaMTX no consume RAM/CPU significativa en los logs actuales. Apagarlo sin uso no afecta los 31 PM2. Pero apagarlo con uso desconocido podría romper un worker latente.
