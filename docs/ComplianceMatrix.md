# AION Vision Hub — Matriz de Cumplimiento Final

> **Auditor:** CTO / QA Lead Principal
> **Fecha:** 2026-03-08
> **Método:** Revisión línea por línea de código fuente (src/), edge functions (supabase/functions/), migraciones SQL (supabase/migrations/), y 41 documentos (docs/)
> **Criterio:** Solo se marca CUMPLE si la funcionalidad es verificable en código. No se acepta "UI ready" como cumplimiento de funcionalidad backend.

---

## Resumen Ejecutivo

| Categoría | Cantidad | Porcentaje |
|-----------|----------|------------|
| **CUMPLE** | 20 | 66.7% |
| **CUMPLE PARCIALMENTE** | 9 | 30.0% |
| **NO CUMPLE** | 1 | 3.3% |

**Score ponderado** (cumple=1, parcial=0.5, no=0): **24.5 / 30 = 81.7%**

---

## Matriz Detallada

### REQ-01: Plataforma Web Enterprise Navegable

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | React 18.3 + TypeScript 5.8 + Vite 5.4. 20 rutas en `App.tsx:57-87`. Sidebar con nav filtrada por permisos (`AppLayout.tsx`). Command Palette Cmd+K (`CommandPalette.tsx`). Build de producción en `dist/`. |
| **Tablas DB** | 28 tablas con RLS |
| **Edge Functions** | 11 desplegadas |
| **Nota** | No es mockup. Todas las rutas tienen componentes con lógica real conectada a Supabase. |

---

### REQ-02: PWA Instalable

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE PARCIALMENTE** |
| **Lo que existe** | `manifest.json` con name="AION Vision Hub", display=standalone, theme_color. `<link rel="manifest">` en `index.html:13`. |
| **Lo que falta** | **No hay service worker** (grep en src/ y public/ = 0 resultados). Solo 1 ícono (favicon.ico 64x64) — faltan 192x192 y 512x512. No hay `vite-plugin-pwa`. Sin soporte offline. Chrome/Edge no mostrarán prompt de instalación sin SW. |
| **Para corregir** | Instalar vite-plugin-pwa, generar íconos, registrar SW en main.tsx. |

---

### REQ-03: Multi-tenant

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | Tabla `tenants` con id, name, slug, settings (JSONB). `get_user_tenant_id(UUID)` como SECURITY DEFINER en migración 1. 42 políticas RLS usando `tenant_id = get_user_tenant_id(auth.uid())`. `profiles.tenant_id` FK a `tenants.id`. Trigger `handle_new_user()` auto-asigna tenant default. Settings de idioma persisten por tenant (`I18nContext.tsx:1118-1155`). |

---

### REQ-04: RBAC

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | Enum `app_role`: super_admin, tenant_admin, operator, viewer, auditor. Tabla `user_roles` con user_id + role + tenant_id. Función `has_role()` SECURITY DEFINER usada en 20+ políticas RLS. Tabla `role_module_permissions` (migración 5). `hasModuleAccess()` filtra navegación en `permissions.ts:53-61`. AdminPage con matriz de permisos editable. Edge function `admin-users` previene auto-modificación de rol y valida jerarquía. |

---

### REQ-05: 50 Secciones Configurables por Nombre

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | Tabla `sections` con id, tenant_id, name, type, description, is_active, order_index, site_id (migración 6). CRUD completo en `use-module-data.ts:7-58`. Usado como filtro dropdown en DomoticsPage, AccessControlPage, IntercomPage, DatabasePage. Sin límite artificial de cantidad (no hay CHECK constraint). RLS: tenant isolation + admin management. |

---

### REQ-06: Live View como Centro Operativo Real

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE PARCIALMENTE** |
| **Lo que existe** | Grid layouts 1x1 → 6x6 = hasta 36 cámaras simultáneas. Persistencia de layouts en `live_view_layouts` table (migración 4). Asignación de cámaras a slots. Panel de eventos en tiempo real con 10s refetch (`LiveViewEventsPanel.tsx`). Panel de operaciones con botones a módulos (`LiveViewOpsPanel.tsx`). TourEngine integrado. |
| **Lo que NO existe** | **No hay rendering de video real.** Los slots muestran placeholders estáticos, no streams RTSP/WebRTC/HLS. No hay player de video en el código (ni HLS.js, ni WebRTC client, ni elemento `<video>` con src). Los botones del ops panel son mayormente stubs que muestran toasts (`LiveViewOpsPanel.tsx` — cada onClick es `toast()`). |
| **Dependencia** | Gateway RTSP→WebRTC (MediaMTX o similar) + player frontend (HLS.js o WebRTC). |

---

### REQ-07: Soporte Conceptual para 500 Vistas/Cámaras

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE PARCIALMENTE** |
| **Lo que existe** | Modelo de datos sin límite artificial (devices table). Tipos: DeviceType, Stream, LiveViewSlot. devices-api edge function con limit=500 por query. Múltiples layouts posibles (live_view_layouts). |
| **Lo que falta** | No hay virtualización de listas (la lista de cámaras en LiveView carga todos los devices sin paginación). No hay test de rendimiento a 500 dispositivos. Grid máximo es 6x6=36 por vista. |

---

### REQ-08: Tours por Portería y Movimiento

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | `TourEngine.tsx` (252 LOC). 4 modos: section, motion, scheduled, manual. Intervalo configurable 3-30s con Slider. Auto-cycling con play/pause/skip/reset. Queue display con posición actual. Filtro por sección en modo section. Modo motion shuffles cameras (necesitará priorización por eventos reales en producción). |

---

### REQ-09: Playback Inteligente

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE PARCIALMENTE** |
| **Lo que existe** | `PlaybackPage.tsx` (630 LOC). Selectores device/channel/date. Timeline interactiva con zoom. Controles play/pause, velocidad 0.5x-4x. Dialog de export con selección de rango. Tabla `playback_requests` para tracking. |
| **Lo que NO existe** | **Los segmentos de grabación son datos mock** generados en el cliente (no consultan NVR ni storage real). **No hay rendering de video** (sin `<video>` element funcional). Export genera toast, no archivo real. |

---

### REQ-10: Envío de Evidencia por Correo

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE PARCIALMENTE** |
| **Lo que existe** | MCP connector "Email Notifications" en catálogo (`mcp-registry.ts:54-65`). Edge function `event-alerts` (194 LOC) que genera template de email con datos del evento y lista de destinatarios. |
| **Lo que NO existe** | **El envío de email es simulado.** `event-alerts` no llama a ningún servicio SMTP — solo escribe en audit_logs y retorna. No hay botón "enviar evidencia por correo" en la UI. No hay adjuntos (snapshot/clip). |
| **Para completar** | Integrar Resend/SendGrid/SMTP en event-alerts. Agregar UI para enviar evidencia desde eventos/incidentes. |

---

### REQ-11: Envío de Evidencia por WhatsApp

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE PARCIALMENTE** |
| **Lo que existe** | MCP connector "WhatsApp Business" en catálogo (`mcp-registry.ts:127-137`) con tool schema `send_message(phone, message)`. Tab "WhatsApp" en IntercomPage. |
| **Lo que NO existe** | **No hay integración con WhatsApp Business API.** No hay edge function para WhatsApp. No hay flujo de "enviar evidencia" en la UI. El tab es informativo/placeholder. |

---

### REQ-12: Módulo de Domóticos Completo

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | Tablas: `domotic_devices` (name, type, brand, model, state, section_id) + `domotic_actions` (device_id, action, user_id, result). Migración 6. CRUD completo en `use-module-data.ts:60-126`: create, update, delete, toggleState. Filtros por sección y tipo. State toggle on/off con registro de acción. Historial de acciones por dispositivo. Detail panel. RLS: tenant isolation + admin/operator management. |

---

### REQ-13: Módulo de Control de Acceso Completo

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | 3 tablas: `access_people` (full_name, type, section, unit, phone, email, document_id), `access_vehicles` (plate, brand, model, color, person_id), `access_logs` (person_id, vehicle_id, direction, method, operator_id). Migración 6. CRUD en `use-module-data.ts:144-269`. 5 tabs: Personas, Bitácora, Vehículos, Reportes, Credenciales. Reportes diario/semanal/quincenal/mensual (botones, export pendiente). RLS: tenant + operator management. |

---

### REQ-14: Módulo de Reinicios Completo

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | Tabla `reboot_tasks` (device_id, reason, status, result, recovery_time_seconds, initiated_by, completed_at). Migración 6. CRUD en `use-module-data.ts:271-317`. KPIs: dispositivos con problemas, exitosos hoy, pendientes, promedio recovery. 4 procedimientos guiados (hardcoded en RebootsPage). Detección de dispositivos offline. Botones AION diagnostics. RLS: tenant + operator. |

---

### REQ-15: Módulo de Citofonía IP Completo

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE PARCIALMENTE** |
| **Lo que existe** | Tablas: `intercom_devices` (name, brand, model, ip, sip_uri, section), `intercom_calls` (device_id, caller, type, duration, answered_by). Migración 6. Create hook para devices. Call history view. Voice AI config tab (welcome message, provider dropdown, capabilities checkboxes). Attend mode selector (human/ai_agent/mixed). |
| **Lo que NO funciona** | Botón "Call" muestra toast placeholder. **Sin integración SIP/VoIP real.** ElevenLabs es solo dropdown sin backend. WhatsApp threads es contador hardcoded. Solo hook `create` para devices (no update/delete). |

---

### REQ-16: Módulo de Base de Datos Completo

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | Tabla `database_records` (title, category, section_id, content JSONB, tags, created_by). Migración 6. CRUD completo en `use-module-data.ts:366-417`. 7 categorías: residents, vehicles, commercial, providers, companies, staff, other. Búsqueda por nombre/unidad/teléfono. Export CSV/XLSX via librería `xlsx`. Filtro por sección. Detail panel con contacto, notas, tags. RLS: tenant + operator. |

---

### REQ-17: Agente AION Transversal

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE PARCIALMENTE** |
| **Lo que existe** | `AIAssistantPage.tsx` (227 LOC) con chat, selección de provider/model, 4 quick prompts. Edge function `ai-chat` (185 LOC) con streaming SSE, context enrichment (event/device/incident), sanitización de input, audit logging en `ai_sessions`. 7 use cases definidos en `ai-provider.ts`. |
| **Lo que falta** | **Sin persistencia de conversaciones** (se pierden al recargar). **No es transversal** — solo accesible desde /ai-assistant, no embebido como copilot en cada módulo. **Tool calling no funcional** (tool_calls tipado pero no ejecutado). SSE parsing manual y frágil (sin retry/reconnect). Feedback thumbs up/down no se guarda. |

---

### REQ-18: OpenAI por Backend

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | Edge function `ai-chat` soporta `provider="openai"`. Modelos: GPT-5, GPT-5 Mini en `ai-provider.ts:41-43`. API key via env var `OPENAI_API_KEY` en edge function. Patrón proxy: frontend → edge function → OpenAI (key nunca expuesta al cliente). Streaming SSE soportado. |

---

### REQ-19: Claude por Backend

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | Edge function `ai-chat` soporta `provider="anthropic"`. Modelos: Claude Sonnet 4, Claude 3.5 Haiku en `ai-provider.ts:44-47`. API key via env var `ANTHROPIC_API_KEY`. Mismo patrón seguro de proxy. |

---

### REQ-20: ElevenLabs por Backend

| Campo | Valor |
|-------|-------|
| **Veredicto** | **NO CUMPLE** |
| **Lo que existe** | Dropdown "ElevenLabs" como opción de Voice Provider en IntercomPage. |
| **Lo que NO existe** | No hay edge function para ElevenLabs. No hay service contract en `production-contracts.ts`. No hay env var documentada. No hay código de TTS/STT. No hay endpoint de audio. Es un label decorativo sin backend. |
| **Para corregir** | Crear edge function `elevenlabs-tts` con API de text-to-speech. Agregar contract en production-contracts.ts. Documentar env var ELEVENLABS_API_KEY. |

---

### REQ-21: MCP Registry

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | `mcp-registry.ts` (229 LOC) con 14 tipos de conectores. 14 categorías tipadas. Tool schemas con inputSchema definidos por conector. Config schemas por conector. Tabla `mcp_connectors` en DB (migración 1). Edge function `mcp-api` (118 LOC) con CRUD, health-check, toggle. Tab MCP en IntegrationsPage. RLS: tenant + admin. |

---

### REQ-22: Integraciones

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | Tabla `integrations` en DB (migración 1). Edge function `integrations-api` (106 LOC) con CRUD, test, toggle. IntegrationsPage con 3 tabs: Active, MCP Connectors, Catalog. Health checks (simulados en edge). Toggle active/inactive. Audit logging en create/toggle/delete. |

---

### REQ-23: Auditoría

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | Tabla `audit_logs` (user_id, action, entity_type, entity_id, before_state, after_state, ip_address, user_agent). Migración 1. 8 de 11 edge functions escriben audit_logs (admin-users, devices-api, events-api, incidents-api, integrations-api, mcp-api, event-alerts, ai-chat). AuditPage con búsqueda, filtro por acción, tabla con detalle before/after (JSON). Export CSV. RLS: solo admins y auditors. Índices: idx_audit_logs_tenant, idx_audit_logs_created. |

---

### REQ-24: Reportes

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | Edge function `reports-api` (116 LOC) con 4 tipos: events, incidents, devices, summary. Edge function `reports-pdf` (300 LOC) genera HTML con SVG charts (bar, donut). ReportsPage con date range picker, 4 cards, quick summary KPIs. ReportsCharts.tsx con Recharts (bar, line, pie). Export CSV/XLSX via `xlsx`. Export PDF via reports-pdf. |

---

### REQ-25: Health

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | Edge function `health-api` (106 LOC) verificando 8 componentes: Database, Devices, Event Pipeline, AI Gateway, Integrations, MCP Connectors, Sites, Auth. Degradation logic (>50% offline = degraded). SystemHealthPage con 3 KPIs + cards con latencia. Auto-refresh 30 segundos. |

---

### REQ-26: Settings

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | SettingsPage.tsx (449 LOC) con 6 tabs: General (org name, timezone, profile, language ES/EN, appearance), Security (2FA toggle, session timeout, password policy), Notifications (push browser, preferences, historial), AI (provider principal/fallback), Feature Flags (read-only), Advanced (retention). Language persiste en tenant settings via Supabase. Push notifications via browser Notification API. |

---

### REQ-27: Documentación Interna Suficiente

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | 41 archivos en docs/. Cobertura: arquitectura (3), seguridad (4), módulos (6), AI/MCP (5), API (4), operaciones (3), auditorías (4), readiness (5), estrategias (3), deployment (2), roadmap (1), data model (1). Calidad general: A- (90%). Inconsistencias menores documentadas en esta auditoría. |

---

### REQ-28: UX Enterprise

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | Dark theme (`class="dark"` en index.html + App.tsx). shadcn/ui + Radix UI (50+ componentes). i18n ES/EN completo (200+ keys en I18nContext.tsx, 1167 LOC). Command Palette Cmd+K. Sonner toasts. Loading states consistentes. Responsive con sidebar colapsable. Recharts para charts. Framer Motion para animaciones. |

---

### REQ-29: Seguridad Correcta

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE PARCIALMENTE** |
| **Lo que funciona** | Supabase Auth con JWT. 42 políticas RLS en 28 tablas. `get_user_tenant_id()` + `has_role()` SECURITY DEFINER. API keys solo en edge functions. Input sanitization (HTML strip en comments, field whitelisting). Audit trail en 8/11 funciones. Self-modification prevention en admin-users. |
| **Brechas CRÍTICAS** | `Access-Control-Allow-Origin: *` en las **11 edge functions** — permite ataques CSRF desde cualquier dominio. **Cero rate limiting** en todos los endpoints — vulnerable a brute force y DOS. **2FA es toggle UI sin implementación backend.** Password policy = Supabase default (6 chars). Sin CSP headers en frontend. XSS parcial en reports-pdf (solo table cells, no SVG). `health-api` y `reports-pdf` **no filtran por tenant** — exponen datos cross-tenant. `event-alerts` usa service role key sin autenticación para POST. |

---

### REQ-30: Readiness para Backend/Gateway Real

| Campo | Valor |
|-------|-------|
| **Veredicto** | **CUMPLE** |
| **Evidencia** | `production-contracts.ts` (290 LOC) con interfaces para: IDeviceAdapter, IDiscoveryAdapter, IStreamAdapter, IPlaybackAdapter, IEventAdapter, IPTZAdapter, IDomoticConnector, IAccessControlConnector, IIntercomConnector, IAIProvider, IMCPConnector, IWhatsAppService. `adapters.ts` (85 LOC) con IHikvisionAdapter, IDahuaAdapter, IOnvifAdapter. `api.ts` con apiFetch() centralizado y 8 módulos API. Gateway architecture documentada en docs/GatewayArchitecture.md. Streaming strategy documentada. |
| **NOTA IMPORTANTE** | No existe directorio `gateway/` en el repositorio. Los documentos anteriores afirmaban que existía un "gateway backend project" — esto es **FALSO**. Lo que existe son interfaces TypeScript y documentación. El gateway es un componente por implementar. |

---

## Correcciones a Documentación Anterior

La versión previa de este documento contenía las siguientes afirmaciones incorrectas:

| Afirmación anterior | Realidad verificada |
|---------------------|---------------------|
| "25/30 cumple, 5 parcial, 0 no cumple" | 20/30 cumple, 9 parcial, 1 no cumple |
| "gateway/ project with adapters, Docker" | **No existe directorio gateway/ en el repo** |
| "i18n EN/ES/FR/PT" | Solo EN y ES (2 idiomas, no 4) |
| "CORS headers ✅" | CORS `*` en las 11 funciones — esto es un problema, no un cumplimiento |
| "ElevenLabs ⚠️ Parcial, UI ready" | No cumple — no hay backend, no hay contract, solo un label |
| "25+ tables" | 28 tablas (conteo preciso) |
| "15 MCP connector types" | 14 tipos (conteo preciso en mcp-registry.ts) |
| "Rate limiting ⚠️ Config needed" | No existe implementación alguna — no es "config needed", es "not implemented" |
| "READY FOR PRODUCTION DEPLOYMENT" | No está listo para producción con CORS `*` y sin rate limiting |
