---
name: stream-health
description: Probe go2rtc streams via local API and HLS endpoints, reporting producer status, HLS HTTP 200, and first-packet latency. Read-only (no DVR login).
---

# stream-health

Verifica la salud de cada stream configurado en `go2rtc.yaml` sin contactar el DVR/NVR directamente.

## Cuándo usar

- Post-deploy de `go2rtc.yaml` (validar que ninguna entrada queda rota).
- Diagnóstico rápido antes de live view en producción.
- Correlación con ausencia de JPGs en `/var/www/aionseg/frontend/snapshots`.

## Cuándo NO usar

- Durante operativa crítica (puede saturar CPU unos segundos con muchos streams).

## Modos

| Flag | Efecto |
|---|---|
| _(default)_ | Consulta `/api/streams` y `/api/streams?src=<key>&probe=1` por cada stream |
| `--probe-hls` | Hace además un `HEAD` al endpoint `/stream.m3u8` (y mide ttfb) |
| `--filter=<regex>` | Limita por nombre de stream (ej. `--filter='hik_.*'`) |
| `--output=<path>` | Reporte destino (default `/tmp/stream-health-<ts>.md`) |

## Invocación

```bash
bash .claude/skills/stream-health/scripts/probe.sh
bash .claude/skills/stream-health/scripts/probe.sh --probe-hls --filter='dahua_.*'
```

## Output

Tabla por stream: `name | producer | consumers | last_packet | hls_http | ttfb_ms | notes`.

## Garantías

- **No** inicia login SDK contra cámaras.
- Timeout `HEAD` HLS: 4 s por endpoint.
- Concurrencia: 4 peticiones HTTP paralelas vs go2rtc local.

## Dependencias

- `curl`, `jq` (en VPS disponibles).
- `go2rtc` escuchando en `http://127.0.0.1:1984` (check preflight).
