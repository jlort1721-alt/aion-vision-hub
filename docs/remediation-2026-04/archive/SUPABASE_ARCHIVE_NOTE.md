# Archivo histórico: directorio `supabase/`

**Fecha de archivado:** 2026-04-15
**Tarball:** `supabase-legacy-20260415.tar.gz` (mismo directorio)
**Commit pre-removal:** `27a22c4` (main) / `e9a7c80` (remediation branch)
**Tag de seguridad:** `pre-remediation-20260415-155113`

## Qué contenía

- `supabase/functions/` — 13 edge functions Deno (admin-users, ai-chat, devices-api, email-api, event-alerts, events-api, health-api, incidents-api, integrations-api, mcp-api, reports-api, reports-pdf, whatsapp-api).
- `supabase/migrations/` — 22 archivos `*.sql` (migraciones legacy de Supabase 2026-03 a 2026-04-05). NO aplicables a la BD local; el esquema actual vive en `backend/apps/backend-api/src/db/migrations/` (030 migrations hasta la fecha).
- `supabase/seed/` + `supabase/seed.sql` — datos semilla legacy.
- `supabase/config.toml` — config del CLI de Supabase.

## Por qué se archiva y no se borra del disco sin rastro

Trazabilidad histórica: si aparece un regreso de bug relacionado con lógica que vivía en una edge function, aquí está el código original para comparación. No se re-deploya; vive solo como snapshot.

## Equivalentes backend en runtime actual

Todas las funciones eliminadas tienen equivalente en `backend/apps/backend-api/src/modules/`:

| Legacy edge fn | Módulo backend activo |
|---|---|
| admin-users | `modules/auth/`, `modules/users` (via auth plugin) |
| ai-chat | `modules/ai-bridge/`, `modules/internal-agent/` |
| devices-api | `modules/devices/` |
| email-api | `modules/email/`, `workers/notification-dispatcher.ts` |
| event-alerts | `modules/alerts/`, `workers/notification-dispatcher.ts` |
| events-api | `modules/events/` |
| health-api | `modules/health/` |
| incidents-api | `modules/incidents/` |
| integrations-api | `modules/integrations/` |
| mcp-api | `modules/mcp-bridge/` (con 45 tool handlers) |
| reports-api | `modules/reports/` + `workers/reports-worker.ts` |
| reports-pdf | `workers/reports-worker.ts` |
| whatsapp-api | `modules/intercom/`, `services/whatsapp-twilio.ts` |

Runtime: Fastify 5 + Node 20 en VPS 18.230.40.6, PM2 service `aionseg-api`.
