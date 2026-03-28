# INFORME DE AUDITORÍA AION — 2026-03-28

## 1. RESUMEN EJECUTIVO

- **Score general: 72/100**
- **Frontend: 6.1/10** | Backend: 7.5/10 | Database: 8/10 | Security: 8/10 | AI/Agent: 9/10 | DevOps: 6/10
- Módulos frontend: 49 páginas (20 COMPLETE, 1 PARTIAL)
- Módulos backend: 55 route registrations (45/45 endpoints responden 200)
- Tests passing: 887 (212 frontend + 675 backend)
- TypeScript errors: 0
- Bugs críticos encontrados: 12
- Mejoras prioritarias: 28

## 2. SCORES POR CATEGORÍA

| Categoría | Score | Estado |
|-----------|-------|--------|
| Error Handling | 4/10 | ZERO páginas manejan isError de React Query |
| Loading States | 7/10 | 14/20 páginas usan Skeleton, 6 solo boolean |
| Empty States | 7/10 | 18/20 tienen estados vacíos |
| Type Safety | 5/10 | 63+ usos de `any` en servicios core |
| API Consistency | 5/10 | 3 sistemas de API coexisten (apiClient, edge functions, Supabase directo) |
| Internationalization | 6/10 | i18n parcial, strings hardcoded en español |
| Frontend Security | 8/10 | DOMPurify, Sentry, RBAC |
| Performance | 7/10 | Lazy loading, React Query, VirtualTable |
| Design System | 8/10 | 43 componentes shadcn/ui, CSS variables |
| Accessibility | 4/10 | Sin aria-labels, sin skip-nav, sin WCAG audit |
| Backend Auth | 8/10 | Refresh rotation, HS256, rate limiting |
| Backend Validation | 6/10 | Zod en la mayoría, raw casts en 8+ endpoints |
| Database | 8/10 | 62 tablas, indexes comprehensivos, credential gap |
| AI/Agent | 9/10 | 22 tools reales, RAG, streaming, dual-provider |
| DevOps | 6/10 | Docker+CI existen, falta deploy pipeline |

## 3. PROBLEMAS CRÍTICOS (P0 — Corregir inmediatamente)

### P0-1: Zero páginas manejan errores de API
- **Impacto:** Cuando la API falla, el usuario ve tablas vacías sin feedback
- **Archivos:** TODOS los 20 páginas principales
- **Fix:** Agregar `{isError && <ErrorState onRetry={refetch} />}` en cada página

### P0-2: Tres sistemas de API coexisten
- **Impacto:** Comportamiento inconsistente, bugs difíciles de rastrear
- **Sistemas:** (1) apiClient→Fastify, (2) services/api.ts→Edge Functions, (3) Supabase directo
- **Archivos afectados:** DashboardPage, EventsPage, IncidentsPage, AdminPage, AIAssistantPage
- **Fix:** Migrar TODO a apiClient→Fastify

### P0-3: 63+ usos de `any` en servicios core
- **Impacto:** Sin type safety, bugs en runtime
- **Archivos:** services/api.ts (54), use-supabase-data.ts (9)
- **Fix:** Tipar con interfaces de dominio

### P0-4: ~40+ GET endpoints sin requireRole
- **Impacto:** Cualquier usuario autenticado ve todos los datos
- **Módulos:** devices, sites, events, incidents, alerts, shifts, patrols, emergency, SLA, intercom, domotics
- **Fix:** Agregar requireRole('viewer', 'operator', 'tenant_admin', 'super_admin') a todos los GET

### P0-5: Credenciales de dispositivos en texto plano
- **Impacto:** DB comprometida = todas las contraseñas de DVR/NVR expuestas
- **Tablas:** devices (username, password), voip_config (ari_password, fanvil_admin_password)
- **Fix:** Forzar encriptación AES en todas las credenciales

## 4. PROBLEMAS ALTOS (P1)

### P1-1: 6 páginas sin loading visual (solo boolean)
- AlertsPage, ShiftsPage, PatrolsPage, EmergencyPage, VisitorsPage, WhatsAppPage
- Fix: Agregar Skeleton components

### P1-2: 9 páginas sin PageShell
- PatrolsPage, EmergencyPage, AdminPage, WhatsAppPage, + 5 más
- Fix: Adoptar PageShell en todas

### P1-3: Intercom endpoints sin validación de input
- POST /sessions/inbound, /sessions/:id/end, /sessions/:id/handoff usan `request.body as any`
- Fix: Agregar Zod schemas

### P1-4: Tenant plugin no verifica estado activo/suspendido
- Un tenant deshabilitado aún puede acceder al API
- Fix: Verificar tenant.status !== 'suspended'

### P1-5: Deploy pipeline faltante
- deploy-production.yml referenciado pero no existe
- Fix: Crear pipeline CI/CD completo

### P1-6: Drizzle schema drift
- knowledge_base y deleted_at columns existen en DB pero no en Drizzle .ts files
- Fix: Sincronizar schemas

### P1-7: Dark mode toggle no funciona
- SettingsPage cambia estado pero App.tsx hardcodea `<div className="dark">`
- Fix: Implementar ThemeProvider

### P1-8: API keys hardcoded a role 'operator'
- No se puede crear API keys con roles diferentes
- Fix: Agregar scope/role per key

## 5. ESTADO DE CADA MÓDULO FRONTEND (Top 20)

| # | Página | Status | API | Loading | Error | Empty | PageShell | Issues |
|---|--------|--------|-----|---------|-------|-------|-----------|--------|
| 1 | DashboardPage | COMPLETE | apiClient + healthApi | Skeleton ✅ | ❌ | ✅ | ✅ | healthApi usa edge function legacy |
| 2 | DevicesPage | COMPLETE | apiClient | Skeleton ✅ | ❌ | ✅ | ✅ | — |
| 3 | LiveViewPage | COMPLETE | useDevices | Skeleton ✅ | ❌ | ✅ | ❌ | Layout save es stub |
| 4 | EventsPage | COMPLETE | apiClient + eventsApi | Skeleton ✅ | ❌ | ✅ | ✅ | Mezcla legacy + apiClient |
| 5 | AccessControlPage | COMPLETE | apiClient | Skeleton ✅ | ❌ | ✅ | ✅ | Schedules en localStorage |
| 6 | IncidentsPage | COMPLETE | apiClient + incidentsApi | Skeleton ✅ | ❌ | ✅ | ✅ | Mezcla legacy |
| 7 | AlertsPage | COMPLETE | apiClient | ⚠️ boolean | ❌ | ✅ | ✅ | Sin Skeleton |
| 8 | ShiftsPage | COMPLETE | apiClient | ⚠️ boolean | ❌ | ✅ | ✅ | Sin Skeleton, user ID texto libre |
| 9 | PatrolsPage | COMPLETE | apiClient | ⚠️ boolean | ❌ | ✅ | ❌ | Sin Skeleton |
| 10 | SitesPage | COMPLETE | apiClient | Skeleton ✅ | ❌ | ✅ | ✅ | — |
| 11 | AIAssistantPage | COMPLETE | Supabase directo | ✅ | ✅ | N/A | ❌ | Bypassa apiClient |
| 12 | SettingsPage | COMPLETE | apiClient | Skeleton ✅ | ❌ | ✅ | ❌ | Dark mode roto |
| 13 | AdminPage | COMPLETE | Supabase directo | Skeleton ✅ | ❌ | ❌ | ❌ | Sin tenant filter |
| 14 | ReportsPage | COMPLETE | apiClient | Skeleton ✅ | ❌ | ✅ | ✅ | Download bypass |
| 15 | EmergencyPage | COMPLETE | apiClient | ⚠️ boolean | ❌ | ✅ | ❌ | Sin Skeleton, checklists hardcoded |
| 16 | VisitorsPage | COMPLETE | apiClient | ⚠️ Loader2 | ❌ | ✅ | ✅ | Usa `any` |
| 17 | ContractsPage | COMPLETE | apiClient | Skeleton ✅ | ❌ | ✅ | ❌ | — |
| 18 | CompliancePage | COMPLETE | apiClient | Skeleton ✅ | ❌ | ✅ | ❌ | 1000+ líneas |
| 19 | TrainingPage | COMPLETE | apiClient | Skeleton ✅ | ❌ | ✅ | ❌ | — |
| 20 | WhatsAppPage | PARTIAL | Delegado a sub-components | Suspense | ❌ | ❌ | ❌ | Shell vacío |

## 6. ESTADO DE CADA MÓDULO BACKEND (20 clave)

| # | Módulo | Prefix | Endpoints | Roles en GET | Validación | Issues |
|---|--------|--------|-----------|-------------|------------|--------|
| 1 | devices | /devices | 16 | ❌ sin role | Parcial | GET sin requireRole |
| 2 | sites | /sites | 7 | ❌ sin role | Parcial | GET sin requireRole |
| 3 | events | /events | 5 | ❌ sin role | ✅ Zod | GET sin requireRole |
| 4 | incidents | /incidents | 6 | ❌ sin role | ✅ Zod | GET sin requireRole |
| 5 | access-control | /access-control | 11 | ✅ viewer+ | ✅ Zod | — |
| 6 | alerts | /alerts | 19 | ❌ sin role | ✅ Zod | 8 GET sin requireRole |
| 7 | shifts | /shifts | 8 | ❌ sin role | ✅ Zod | GET sin requireRole |
| 8 | patrols | /patrols | 12 | ❌ sin role | ✅ Zod | GET sin requireRole |
| 9 | emergency | /emergency | 14 | ❌ sin role | ✅ Zod | Contacts son sensibles |
| 10 | sla | /sla | 8 | ❌ sin role | ✅ Zod | GET sin requireRole |
| 11 | automation | /automation | 6 | ✅ operator+ | ✅ Zod | — |
| 12 | visitors | /visitors | 12 | ✅ viewer+ | ✅ Zod | DELETE permite operator |
| 13 | contracts | /contracts | 11 | ✅ operator+ | ✅ Zod | audit sin await |
| 14 | keys | /keys | 10 | ✅ operator+ | ✅ Zod | audit sin await |
| 15 | compliance | /compliance | 11 | ✅ operator+ | ✅ Zod | audit sin await |
| 16 | training | /training | 10 | ✅ operator+ | ✅ Zod | raw query cast en expiring |
| 17 | reports | /reports | 5 | ✅ viewer+ | ✅ Zod | — |
| 18 | whatsapp | /whatsapp | 13 | ✅ variado | Parcial | POST /test sin validación |
| 19 | intercom | /intercom | 20 | ❌ parcial | Parcial | 3 endpoints sin validación |
| 20 | domotics | /domotics | 8 | ❌ sin role | ✅ Zod | GET sin requireRole |

## 7. INFRAESTRUCTURA

| Componente | Estado | Issues |
|-----------|--------|--------|
| PostgreSQL 16 local | ✅ 2 DBs, 0.3ms latency | Pool max=20 puede ser bajo |
| Redis | ✅ Cache para auth | Sin password configurado |
| go2rtc | ✅ 36 streams | 2 sedes con video activo |
| Mosquitto MQTT | ✅ localhost:1883 | Sin autenticación |
| Nginx | ✅ 2 dominios + go2rtc proxy | — |
| Asterisk PBX | ✅ 27 extensiones | — |
| PM2 | ✅ 4 procesos | — |
| Docker | ✅ compose file | Sin deploy pipeline |
| CI/CD | ⚠️ Parcial | deploy-production.yml faltante |
| Monitoring | ✅ OTEL + Prometheus | Sentry configurado |

## 8. AI/AGENT

| Componente | Estado |
|-----------|--------|
| MCP Tools | ✅ 22 implementados, datos reales |
| RAG Knowledge Base | ✅ PostgreSQL full-text search |
| Streaming SSE | ✅ Dual provider (OpenAI + Anthropic) |
| Tool Calling | ✅ Con confirmación para acciones peligrosas |
| Internal Agent | ✅ Health check cada 5 min (score 78/100) |
| CLAVE Bridge | ✅ Bidireccional |
| Feedback Loop | ❌ ThumbsUp/Down sin backend |

## 9. PLAN DE IMPLEMENTACIÓN PRIORIZADO

### SPRINT 1 — Error handling + API unification
1. Agregar isError + ErrorState component a las 20 páginas
2. Migrar DashboardPage, EventsPage, IncidentsPage de edge functions a apiClient
3. Migrar AdminPage de Supabase directo a apiClient
4. Eliminar services/api.ts (legacy)
5. Agregar requireRole a ~40 GET endpoints sin protección

### SPRINT 2 — Type safety + validation
6. Eliminar 63 usos de `any` en servicios core
7. Agregar Zod schemas a 8 endpoints con raw casts
8. Tipar todas las respuestas de API con interfaces de dominio
9. Forzar encriptación de credenciales en DB

### SPRINT 3 — UX consistency
10. Adoptar PageShell en 9 páginas faltantes
11. Agregar Skeleton loading a 6 páginas
12. Implementar dark mode toggle funcional
13. Completar i18n (strings hardcoded)
14. Agregar accessibility (aria-labels, skip-nav)

### SPRINT 4 — Infrastructure
15. Crear deploy-production.yml
16. Sincronizar Drizzle schema con migrations
17. Implementar staging environment
18. Agregar Redis authentication
19. Configurar container registry push

### SPRINT 5 — Operational workflows
20. Implementar alarm video popup → resident call → gate open workflow
21. Conectar LPR con cámaras reales (Hikvision ANPR events)
22. Implementar QR scanner para patrullas
23. Conectar emergency dispatch con notificaciones reales
24. Implementar real PDF report generation

## 10. ARCHIVOS CLAVE PARA MODIFICAR

```
Frontend (por orden de impacto):
src/lib/api-client.ts                    — Punto central de todas las API calls
src/services/api.ts                       — ELIMINAR (legacy edge functions)
src/hooks/use-supabase-data.ts            — Eliminar `any`, tipar respuestas
src/components/layout/AppLayout.tsx        — Sidebar, header, notifications
src/pages/DashboardPage.tsx               — Dashboard principal
src/pages/AccessControlPage.tsx           — Residentes, vehículos, LPR
src/pages/LiveViewPage.tsx                — Video en vivo
src/pages/EventsPage.tsx                  — Eventos en tiempo real
src/pages/AlertsPage.tsx                  — Alertas y escalamiento
src/pages/EmergencyPage.tsx               — Protocolos de emergencia

Backend (por orden de impacto):
backend/apps/backend-api/src/plugins/auth.ts          — Autenticación
backend/apps/backend-api/src/modules/devices/routes.ts — 16 endpoints
backend/apps/backend-api/src/modules/alerts/routes.ts  — 19 endpoints
backend/apps/backend-api/src/modules/intercom/routes.ts — 20 endpoints
backend/apps/backend-api/src/modules/access-control/   — Residentes CRUD
backend/apps/backend-api/src/modules/events/routes.ts   — Eventos
backend/apps/backend-api/src/modules/ai-bridge/service.ts — Agente IA
```

---

*Generado automáticamente por auditoría exhaustiva de 3 agentes en paralelo.*
*Frontend: 49 páginas, 43 UI components, 19 hooks, 40 services.*
*Backend: 55 módulos, 200+ endpoints, 62 DB tables, 22 MCP tools.*
