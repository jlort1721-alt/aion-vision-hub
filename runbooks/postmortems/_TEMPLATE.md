# Post-mortem: <título descriptivo>

**Fecha**: YYYY-MM-DD
**Autor**: <nombre>
**Severidad**: critical | high | medium | low
**Estado**: draft | in-review | published

---

## Resumen ejecutivo

Una o dos frases. Qué pasó, a quién afectó, cuánto duró. Sin jerga.

> Ejemplo: *El 15 de abril a las 3:14am, la plataforma estuvo inaccesible para todos los usuarios durante 23 minutos debido a un deploy que dejó el pool de conexiones a Postgres mal configurado. Se recuperó con rollback automático.*

---

## Línea de tiempo (UTC-5 / Bogotá)

| Hora | Evento |
|------|--------|
| 03:12 | Deploy iniciado — commit `abc123` |
| 03:14 | Primera alerta `Pm2AppErrored` para `aion-api-blue` |
| 03:14 | On-call notificado vía WhatsApp |
| 03:16 | On-call confirma incidente, abre canal `#inc-2026-04-15` |
| 03:18 | Diagnóstico: pool size = 0 en config nuevo |
| 03:21 | Rollback ejecutado |
| 03:22 | `/api/health` retorna 200 |
| 03:35 | Verificación completa: 70/70 URLs |
| 03:40 | Incidente cerrado |

---

## Impacto

- **Usuarios afectados**: ~1,800 residentes + 22 conjuntos
- **Servicios afectados**: api, frontend, agent (todos los autenticados)
- **Servicios NO afectados**: páginas públicas (cache), SMS de emergencia (fallback Twilio directo)
- **Pérdida de datos**: ninguna
- **Eventos de seguridad perdidos durante el outage**: N (reconstruidos desde DVR locales una vez restaurada la conexión)

---

## Causa raíz

Una sola frase técnica, lo más concreta posible.

> Ejemplo: *El commit `abc123` cambió `PG_POOL_MAX` de `40` a `${PG_POOL_MAX}` (variable inexistente), y el código interpretó eso como `0`, rechazando todas las queries.*

### Causas contribuyentes
- Falta de validación de env vars al arranque del proceso.
- El smoke test de deploy.sh no testea queries reales contra la DB.
- El reviewer del PR no ejecutó el branch localmente.

---

## Detección

- **Cómo se detectó**: alerta automática `Pm2AppErrored` (3 min después del deploy)
- **Idealmente debería haberse detectado**: en el smoke test del IDLE color, antes del swap nginx
- **Por qué no se atrapó antes**: smoke.py no autentica ni hace queries — solo HTTP `/api/health` que retorna 200 incluso si el pool falla a la primera query

---

## Resolución

Pasos exactos que tomó el on-call:

1. `ssh` al VPS
2. `pm2 logs aion-api-blue --err --lines 50 --nostream` → vio el error de pool
3. Decidió rollback antes de diagnosticar más a fondo
4. `/opt/aion/scripts/rollback.sh`
5. Verificó con `curl /api/health` y dashboard de Grafana

**Tiempo total**: detección 2min, diagnóstico 4min, resolución 3min, verificación 13min.

---

## Lo que salió bien

- Rollback automático funcionó como diseñado.
- WhatsApp despertó al on-call en <1 min.
- Snapshot de logs preservado para análisis post-mortem.

## Lo que salió mal

- El smoke test no atrapó el bug.
- El env var faltante no causó crash al arranque (debió fallar fast).
- Tomó 4 min entender que era pool config y no DB caída — los logs eran ambiguos.

## Suerte (qué pudo haber sido peor)

- Pasó a las 3am, no en hora pico (las 7-9pm de detecciones).
- El color `green` seguía sano, blue-green funcionó perfecto.
- No coincidió con un evento real de seguridad en algún conjunto.

---

## Acciones de prevención

| # | Acción | Owner | Fecha objetivo | Estado |
|---|--------|-------|----------------|--------|
| 1 | Agregar validación de env vars al startup de aion-api (fail fast si falta) | Isabella | 2026-04-22 | TODO |
| 2 | Mejorar smoke.py: agregar query autenticada + check de pool | Isabella | 2026-04-22 | TODO |
| 3 | Pre-deploy hook: validar ecosystem.config.js contra .env actual | — | 2026-04-29 | TODO |
| 4 | Documentar en el runbook el patrón "pool=0 → DB queries fallan con timeout" | Isabella | 2026-04-15 | DONE |
| 5 | Agregar dashboard panel: "DB queries por minuto" para detectar caída de queries con HTTP 200 | Isabella | 2026-04-22 | TODO |

---

## Notas y referencias

- Slack: `#inc-2026-04-15`
- Grafana snapshot durante el incidente: <url>
- Logs preservados: `/opt/aion/snapshots/incident-2026-04-15/`
- Commit problemático: `abc123`
- Rollback exitoso: snapshot `val-20260415-031200`
