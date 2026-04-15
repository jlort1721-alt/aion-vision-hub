# SUPABASE RESIDUAL — 2026-04-15

## Resumen

| Categoría | Instancias | Estado | Acción |
|---|---|---|---|
| `supabase.from()` | 74 | MIGRABLE | → backend Fastify |
| `supabase.rpc()` | 14 | MIGRABLE | → `/api/v1/tenants/my-tenant` |
| `supabase.storage` | 0 | OK | — |
| Claves hardcoded | 0 | SEGURO | Todas desde `.env` / `Deno.env.get()` |
| `createClient` | 31 | OK | No hardcoded |
| **Total migrable** | **88** | — | Sprint 1-4 |

## Detalle por archivo (edge functions — `supabase/functions/`)

| Archivo | Líneas con `.from()` | Tablas | Operaciones | Clasificación |
|---|---|---|---|---|
| `incidents-api/index.ts` | 22,51,55,73,78,85,86,93,111,129,145,146 | audit_logs, incidents | INSERT/SELECT/UPDATE | MIGRAR |
| `reports-api/index.ts` | 48,66,81,95,104-107 | events, incidents, devices, audit_logs, sites | SELECT/INSERT | MIGRAR |
| `health-api/index.ts` | 28,37,48,64,73,82,98 | tenants, devices, events, integrations, mcp_connectors, sites, audit_logs | SELECT | MIGRAR |
| `events-api/index.ts` | 33,37,75,102,103,107 | events, audit_logs | SELECT/UPDATE/INSERT | MIGRAR |
| `devices-api/index.ts` | 31,50,57,79,110,111,120 | devices, audit_logs | CRUD | MIGRAR |
| `ai-chat/index.ts` | 75,78,81,159 | events, devices, incidents, ai_sessions | SELECT/INSERT | MIGRAR |
| `mcp-api/index.ts` | 33,37,56,62,65,67,79,81,94,95,98,105,106,108 | mcp_connectors, audit_logs | CRUD | MIGRAR |
| `integrations-api/index.ts` | 32,36,48,53,56,58,69,71,83,84,87,93,94,96 | integrations, audit_logs | CRUD | MIGRAR |
| `reports-pdf/index.ts` | 108,115,116,117,118 | tenants, devices, events, incidents, sites | SELECT | MIGRAR |

## RPC calls (14)

Todos invocan `get_user_tenant_id()` — fácil de reemplazar por un endpoint único `/api/v1/tenants/my-tenant` que lea del JWT.

## Clasificación código frontend

### Legítimo — MANTENER (Supabase Auth únicamente)
- `src/contexts/AuthContext.tsx` — auth JWT
- `src/lib/api-client.ts` — token injection
- `src/hooks/use-realtime-events.ts` — realtime channels (evaluar migración a SSE propio)
- `src/integrations/supabase/client.ts` — init cliente

### Guardrail activo
- `src/test/no-supabase-bypass.test.ts` — previene `supabase.from()` en frontend.
- Resultado: 0 bypass en código de producción frontend.

## Plan de remediación (4 sprints)

1. **Sprint 1** — Crear rutas Fastify (`/api/v1/incidents`, `/api/v1/health`, `/api/v1/events`, `/api/v1/devices`) con paridad funcional.
2. **Sprint 2** — Desactivar edge functions `admin-users`, `incidents-api`, `devices-api`, `events-api`. Feature flag para switchover.
3. **Sprint 3** — Tests de paridad, validar audit_logs y RLS en nueva ruta.
4. **Sprint 4** — Cleanup supabase.functions ya no usadas, doc de migración.

## Relación con FX-NNN

Esta migración bloquea parcialmente:
- FX-108 (Documentos + storage) → necesita MinIO local o backend-managed S3
- FX-112 (reportes) → depende de `reports-api` migrada
- FX-046/047 (incidentes) → depende de `incidents-api` migrada

Ver `MIGRACION_PENDIENTE.md` para tracking detallado.
