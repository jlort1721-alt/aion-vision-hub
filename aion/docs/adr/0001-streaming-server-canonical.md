# ADR 0001 — Servidor de streaming canónico: go2rtc (no ZLMediaKit)

**Fecha:** 2026-04-17
**Estado:** Propuesto
**Autor:** Claude Code (en nombre del operador)

## Contexto

En el VPS aionseg.co hoy conviven dos servidores de streaming:

| Servicio | Estado | Puertos | Uso |
|---|---|---|---|
| `go2rtc` (systemd) | active | 1984, 8554 RTSP, 8555 WebRTC | **129 streams activos**, consumido por frontend y workers `hik-monitor`/`snap-*` |
| `aion-zlm` (Docker, ZLMediaKit) | active | 9550 HTTP, 10554 RTSP, 30000-30500 UDP WebRTC | Propósito no documentado — posible herencia de GB28181 (`aion-owl` service) |

Hay solapamiento funcional: ambos ofrecen RTSP y WebRTC.

## Decisión

**Canónico: `go2rtc`.** ZLMediaKit queda en evaluación 14 días para identificar si es consumido por algún flujo real.

## Racional

1. **go2rtc ya está en producción con 129 streams activos**: migrar sería riesgo cero-reward.
2. **Integración:** el backend, `hik-monitor`, `snap-*` y el frontend consultan `http://127.0.0.1:1984/api/streams` directamente.
3. **ZLM vs go2rtc:**
   - go2rtc: go-binary single, config YAML simple, WebRTC + RTSP + HLS nativos, bajo footprint (~30MB RAM).
   - ZLMediaKit: C++ con más features (grabación, GB28181), pero más pesado y con API HTTP más compleja.
4. **`aion-owl`** (SIP GB28181 gateway) puede estar usando ZLM para ingesta GB28181 → pendiente de validar.

## Plan de verificación (14 días)

Durante 2 semanas (hasta 2026-05-01), monitorear:

- `docker stats aion-zlm` para ver si recibe tráfico real (TX/RX bytes).
- `sudo ss -tnp state established | grep ":9550\|:10554"` para ver clientes conectados.
- Buscar en código del repo: `grep -rE "9550|10554|zlm|zlmediakit"`.
- Consultar con Isabella si `aion-owl` requiere ZLM como backend GB28181.

## Criterio de cierre

- **Si hay ≥1 cliente consumidor real** → documentar el rol, no desactivar.
- **Si no hay consumidores en 14 días** → stop del service + tag `phase-6-zlm-decommissioned`, pero dejar imagen por si hay que revivir.

## Consecuencias

- **Positivas:** 1 servidor de streaming reduce complejidad mental, documentación y puertos expuestos (30000-30500 UDP son 501 puertos).
- **Negativas:** si `aion-owl`/GB28181 depende de ZLM y se apaga, se rompe ingesta GB28181. Mitigado por el periodo de observación.
- **Pendientes:** verificación con Isabella sobre rol de `aion-owl`.
