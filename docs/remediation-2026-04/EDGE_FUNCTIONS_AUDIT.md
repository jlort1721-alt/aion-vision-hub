# EDGE FUNCTIONS AUDIT — 2026-04-15

## Resumen

- **Total edge functions:** 13 (en `supabase/functions/`)
- **Invocadas activamente:** 13 (ninguna huérfana)
- **Recomendación:** migrar 7 a backend Fastify, mantener 4 serverless, 2 consolidar

## Matriz

| # | Función | Propósito | Equivalente backend | Recomendación |
|---|---|---|---|---|
| 1 | ai-chat | LLM gateway (Anthropic/OpenAI/Lovable) con streaming | No existe | MANTENER SERVERLESS |
| 2 | devices-api | CRUD dispositivos + audit | `backend-api/routes/devices/` | MIGRAR |
| 3 | events-api | Eventos: list, ack, resolve, dismiss, AI summary | `backend-api/routes/events/` | MIGRAR |
| 4 | incidents-api | Incidentes: CRUD + transiciones + escalamiento | `backend-api/modules/incident-manager/` | MIGRAR |
| 5 | admin-users | CRUD usuarios + roles + invitaciones | `backend-api/routes/admin/users` | MIGRAR (seguridad) |
| 6 | event-alerts | Dispara alertas email/WA/push | `backend-api/workers/notification-dispatcher.ts` | MIGRAR |
| 7 | reports-pdf | Generación PDF a demanda | `backend-api/workers/reports-worker.ts` | MIGRAR |
| 8 | health-api | Health checks DB y servicios | `tools/system-health-tools.ts` | MIGRAR |
| 9 | reports-api | CRUD reportes | `backend-api/routes/reports/` | MIGRAR |
| 10 | integrations-api | Webhooks eWeLink/Hikvision/Dahua | `backend-api/modules/integrations/` | MANTENER SERVERLESS |
| 11 | mcp-api | Proxy REST→MCP con routing Opus/Sonnet/Haiku | `backend-api/modules/mcp-bridge/` | MANTENER SERVERLESS |
| 12 | email-api | Envío correos con plantillas | `backend-api/workers/notification-dispatcher.ts` | CONSOLIDAR |
| 13 | whatsapp-api | Twilio WA (envío + webhooks + conversaciones) | `backend-api/services/whatsapp-twilio.ts` | MANTENER SERVERLESS |

## Orden de migración (7 funciones)

1. `admin-users` — seguridad crítica
2. `incidents-api` — lógica compleja
3. `devices-api` — CRUD fundamental
4. `events-api` — volumen alto
5. `reports-api` — integridad transaccional
6. `reports-pdf` — mejor como worker async
7. `email-api` + `event-alerts` — consolidar en `notification-dispatcher`

## Deuda técnica detectada

| Problema | Afecta | Acción |
|---|---|---|
| Validación Zod inconsistente | devices-api, events-api | Middleware uniforme en backend |
| Rate limiting en memoria (no distribuido) | Varios | Migrar a Redis |
| Acceso directo a Supabase sin repo layer | Todas | Capa service en backend |
| Sin versionado de modelo IA | ai-chat | Columna `model_version` en `ai_sessions` |
| Error handling dispar | Todas | Schema común de error |

## Relación con FX-NNN

- Migración de `events-api` + `incidents-api` → desbloquea FX-040 a FX-049 (Bloque E)
- Migración de `reports-api` + `reports-pdf` → desbloquea FX-112 a FX-114 (Bloque L)
- Consolidación `email-api`/`event-alerts` → soporta FX-042 a FX-044 (canales de alerta)
