# Plan Maestro de Mejoras — AION Vision Hub (aionseg.co)

**Fecha:** 2026-04-07
**Estado actual:** 99/100 funcional, pero con deuda tecnica critica
**Objetivo:** Plataforma robusta, segura, profesional, lista para produccion real

---

## RESUMEN EJECUTIVO

El analisis exhaustivo revela **40 issues criticos, 27 altos, 24 medios** distribuidos en 3 areas:

| Area | Criticos | Altos | Medios |
|------|:--------:|:-----:|:------:|
| Frontend (69 pages, 100+ components) | 3 | 5 | 4 |
| Backend (60+ modules, 42 services) | 8 | 7 | 6 |
| Infra/Seguridad/CI-CD | 16 | 12 | 12 |
| **TOTAL** | **27** | **24** | **22** |

---

## FASE 0: EMERGENCIA DE SEGURIDAD (Dia 1)

> **Skill activo:** security-review (everything-claude-code)
> **Agente:** security-reviewer

### 0.1 Rotar TODOS los secretos comprometidos

Los siguientes secretos estan expuestos en el historial de Git:

| Secreto | Archivo | Accion |
|---------|---------|--------|
| DATABASE_URL (password: TestAdmin456!) | `backend/.env:14` | Cambiar password en Supabase |
| JWT_SECRET | `backend/.env:17` | Generar nuevo con `openssl rand -hex 32` |
| OPENAI_API_KEY (sk-proj-...) | `backend/.env:46` | Rotar en platform.openai.com |
| ANTHROPIC_API_KEY (sk-ant-...) | `backend/.env:47` | Rotar en console.anthropic.com |
| ELEVENLABS_API_KEY | `backend/.env:49` | Rotar en elevenlabs.io |
| RESEND_API_KEY | `backend/.env:54` | Rotar en resend.com |
| TWILIO_ACCOUNT_SID + AUTH_TOKEN | `backend/.env:88-98` | Rotar en twilio.com |
| EWELINK credentials | `backend/.env:74-77` | Cambiar password |
| CREDENTIAL_ENCRYPTION_KEY | `backend/.env:43` | Generar nuevo, re-encriptar dispositivos |
| 204 RTSP credentials | `deploy/go2rtc-*.yaml` | Cambiar passwords de DVR/NVR |
| 17+ device passwords | `deploy/RUNBOOK.sh` | Cambiar en dispositivos fisicos |

### 0.2 Purgar secretos del historial de Git

```bash
# Usar git filter-repo para eliminar archivos con secretos del historial
pip install git-filter-repo
git filter-repo --path backend/.env --invert-paths
git filter-repo --path deploy/backend.env.production --invert-paths
git filter-repo --path deploy/RUNBOOK.sh --invert-paths
git filter-repo --path deploy/go2rtc-complete.yaml --invert-paths
git filter-repo --path deploy/go2rtc-dahua-ready.yaml --invert-paths
git filter-repo --path deploy/go2rtc-hikvision.yaml --invert-paths
```

### 0.3 Actualizar .gitignore

```gitignore
# Agregar a .gitignore
backend/.env
backend/.env.*
deploy/*.env*
deploy/RUNBOOK.sh
deploy/go2rtc-*.yaml
deploy/*.pem
deploy/*.key
```

### 0.4 Eliminar archivo duplicado

```bash
rm "backend/apps/backend-api/src/services/twilio.service 2.ts"
```

---

## FASE 1: SEGURIDAD BACKEND (Dias 2-4)

> **Skills activos:** security-review, backend-patterns, verification-loop
> **Agentes:** security-reviewer, code-reviewer

### 1.1 WebSocket Authentication (CRITICO)

**Archivo:** `backend/apps/backend-api/src/plugins/websocket.ts:27-34`
**Problema:** Conexiones WebSocket no validan JWT
**Accion:** Agregar validacion JWT en el handshake WS

```typescript
// En websocket.ts, dentro del handler de conexion
const token = request.headers['sec-websocket-protocol'] || 
              new URL(request.url, 'http://localhost').searchParams.get('token');
if (!token) { socket.close(4001, 'Authentication required'); return; }
try {
  const decoded = app.jwt.verify(token);
  // Continuar con conexion autenticada
} catch { socket.close(4003, 'Invalid token'); return; }
```

### 1.2 Foreign Keys faltantes en schema (CRITICO)

**Archivo:** `backend/apps/backend-api/src/db/schema/index.ts:146-157`

Agregar FK constraints a:
- `liveViewLayouts.userId` → `profiles.id`
- `streams.deviceId` → `devices.id`
- `playbackRequests.deviceId` → `devices.id`

### 1.3 Indexes faltantes en audit_logs (ALTO)

**Archivo:** `backend/apps/backend-api/src/db/schema/index.ts:68-81`

```sql
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
```

### 1.4 Unique constraint en profiles.email

**Archivo:** `backend/apps/backend-api/src/db/schema/users.ts`
**Accion:** Agregar `UNIQUE` constraint para prevenir registros duplicados

### 1.5 Refactor cameras service query pattern

**Archivo:** `backend/apps/backend-api/src/modules/cameras/service.ts:52-71`
**Problema:** Nested if-chains reconstruyendo queries SQL completas
**Accion:** Usar query builder con condiciones dinamicas

### 1.6 sql.raw() audit (49 instancias)

**Accion:** Revisar cada uso de `sql.raw()` y reemplazar con queries parametrizadas donde sea posible. Cada instancia es un riesgo potencial de SQL injection.

### 1.7 Rate limiting per-endpoint

**Archivo:** `backend/apps/backend-api/src/middleware/rate-limiter.ts`
**Problema:** Rate limit global (200/60s) sin diferenciacion por tipo de operacion
**Accion:** Configurar limites especificos para:
- Auth endpoints: 5/min (ya tiene)
- Write operations: 30/min
- Read operations: 100/min
- File uploads: 10/min

### 1.8 Completar o eliminar modulos stub (~20 modulos)

Los siguientes modulos son solo routes.ts sin service layer real:

| Modulo | Lineas | Decision |
|--------|--------|----------|
| clips | 309 (inline) | Extraer a service.ts |
| cloud-accounts | minimal | Completar o marcar beta |
| device-control | minimal | Completar |
| extensions | 293 (inline) | Extraer a service.ts |
| face-recognition | stub | Completar con servicio real |
| floor-plans | stub | Completar |
| heat-mapping | stub | Completar |
| hikconnect | stub | Completar con hikconnect-cloud.ts |
| imou | stub | Completar con imou-cloud.ts |
| live-view | stub | Completar |
| lpr | minimal | Completar |
| network | stub | Completar |
| playback | stub | Completar |
| provisioning | stub | Completar |
| relay | stub | Completar |
| remote-access | stub | Completar |
| visitor-preregistration | stub | Completar |
| zkteco | stub | Completar con zkteco.ts |

---

## FASE 2: TYPESCRIPT STRICT MODE (Dias 5-7)

> **Skills activos:** coding-standards, tdd-workflow, verification-loop
> **Agente:** build-error-resolver

### 2.1 Habilitar strict mode global

**Archivo:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 2.2 Eliminar 498 instancias de `any`

**Archivos principales afectados:**

| Archivo | Instancias | Prioridad |
|---------|:----------:|:---------:|
| `src/components/alerts/EscalationConfigPanel.tsx` | 8+ | Alta |
| `src/components/intercom/OperatorCallDashboard.tsx` | 4+ | Alta |
| `src/components/liveview/LiveViewOpsPanel.tsx` | 5+ | Alta |
| `src/features/agent/components/AgentView.tsx` | 3+ | Media |
| `src/features/agent/hooks/useAgent.ts` | 2+ | Media |
| `src/components/video/WebRTCPlayer.tsx` | 1+ | Media |
| `src/components/dashboard/ClaveAssistantWidget.tsx` | 3+ | Media |
| `src/contexts/BrandingContext.tsx` | 1+ | Baja |

**Accion:** Crear interfaces TypeScript especificas para cada estructura de datos. Usar el skill `coding-standards` para guiar cada refactor.

### 2.3 Tipar servicios API (Record<string, unknown>)

**Archivos con tipos genericos excesivos:**

| Servicio | Instancias `unknown` |
|----------|:--------------------:|
| `src/services/cross-site-api.ts` | 27 |
| `src/services/alerts-api.ts` | 21 |
| `src/services/whatsapp-api.ts` | 18 |
| `src/services/patrols-api.ts` | 14 |
| `src/services/lpr-api.ts` | 10 |

**Accion:** Definir interfaces de respuesta para cada endpoint en `src/types/`.

---

## FASE 3: FRONTEND UX PROFESIONAL (Dias 8-14)

> **Skills activos:** ui-ux-pro-max, design (SKILL.md), frontend-patterns, obsidian-markdown
> **Agentes:** code-reviewer, architect

### 3.1 ErrorBoundary global (CRITICO)

**Problema:** No hay ErrorBoundary wrapping las rutas. Un error en cualquier pagina crashea toda la app.

**Archivo a crear:** `src/components/shared/AppErrorBoundary.tsx`
**Archivo a modificar:** `src/App.tsx` — envolver `<Routes>` con ErrorBoundary

### 3.2 Error handling en 15 paginas

Las siguientes paginas no manejan errores de API:

1. `src/pages/CameraHealthPage.tsx`
2. `src/pages/CookiePolicyPage.tsx`
3. `src/pages/DatabasePage.tsx`
4. `src/pages/DomoticsPage.tsx`
5. `src/pages/Index.tsx`
6. `src/pages/LandingPage.tsx`
7. `src/pages/NotFound.tsx`
8. `src/pages/OperationalReportsPage.tsx`
9. `src/pages/OperationsPanelPage.tsx`
10. `src/pages/PredictiveCriminologyPage.tsx`
11. `src/pages/PrivacyPolicyPage.tsx`
12. `src/pages/SkillsPage.tsx`
13. `src/pages/TermsPage.tsx`
14. `src/pages/UserManualPage.tsx`
15. `src/pages/WhatsAppPage.tsx`

**Accion:** Agregar patron `isError && <ErrorState onRetry={refetch} />` a cada pagina con data fetching.

### 3.3 Empty states en 50 paginas

**Problema:** 50 paginas no manejan el caso "sin datos".

**Accion:** Crear componente reutilizable `src/components/shared/EmptyState.tsx` con:
- Icono contextual
- Mensaje en espanol
- CTA opcional ("Crear primer registro", "Importar datos")
- Usar en todas las paginas con listas/tablas

### 3.4 i18n en 43 paginas (CRITICO)

**Problema:** 43 paginas tienen texto hardcodeado en espanol sin usar el sistema i18n.

**Paginas sin i18n (las 43):**
AlertsPage, AnalyticsPage, AutomationPage, BiogeneticSearchPage, CommunicationsPage, CookiePolicyPage, DocumentsPage, EmergencyPage, GuardMobilePage, Immersive3DPage, Index, KeysPage, LandingPage, LiveViewPage, MinutaPage, NetworkPage, NotFound, NotesPage, NotificationTemplatesPage, OnboardingWizardPage, OperationalDashboardPage, OperationalReportsPage, OperationsPanelPage, PatrolsPage, PhonePanelPage, PlaybackPage, PredictiveCriminologyPage, PrivacyPolicyPage, RemoteAccessPage, ReportsPage, ResetPasswordPage, ResidentsAdminPage, SLAPage, ScheduledReportsPage, ShiftsPage, SitesPage, SkillsPage, TVDashboardPage, TermsPage, UserManualPage, VisitorsPage, WallPage, WhatsAppPage

**Accion:** Implementar `useI18n()` hook en cada pagina. Extraer strings a `src/i18n/es.ts` y `src/i18n/en.ts`.

### 3.5 Accesibilidad (57 ARIA attrs en 100+ componentes)

**Problema:** Muy pocos atributos ARIA, alt text, keyboard navigation.

**Acciones prioritarias:**
1. Agregar `aria-label` a todos los botones con solo icono
2. Agregar `alt` a todas las imagenes
3. Agregar `role` a elementos interactivos custom
4. Verificar `tabIndex` y keyboard navigation en modals/dropdowns
5. Asegurar contraste 4.5:1 (verificar con skill ui-ux-pro-max S1)

### 3.6 Responsive design en 23 paginas

**Paginas sin breakpoints responsive (sm:/md:/lg:):**
Principalmente paginas estaticas y de configuracion. Agregar responsive layout usando el grid system del design system.

---

## FASE 4: CI/CD ROBUSTO (Dias 15-17)

> **Skills activos:** verification-loop, docker-deploy (si existe), git-workflow
> **Agente:** architect

### 4.1 Fix typecheck en CI (CRITICO)

**Archivo:** `.github/workflows/ci.yml:42`
**Problema:** `pnpm run typecheck || true` — errores de TypeScript no bloquean el build
**Accion:** Cambiar a `pnpm run typecheck` (sin `|| true`)

### 4.2 Agregar tests backend al PR check

**Archivo:** `.github/workflows/pr-check.yml`
**Problema:** Solo corre tests frontend, no backend
**Accion:** Agregar step `pnpm --filter @aion/backend-api test`

### 4.3 Agregar security scanning a CI

**Accion:** Agregar a ci.yml:
```yaml
- name: Security audit
  run: pnpm audit --audit-level=moderate
- name: Check for secrets
  uses: trufflesecurity/trufflehog@main
```

### 4.4 Docker security hardening

**Archivo:** `Dockerfile.frontend`
**Problema:** Container corre como root
**Accion:**
```dockerfile
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -D appuser
USER appuser
```

### 4.5 Docker default credentials

**Archivo:** `docker-compose.yml:150`
**Problema:** `REDIS_PASSWORD:-changeme` como default
**Accion:** Remover defaults inseguros, requerir .env explicito

### 4.6 ESLint improvements

**Archivo:** `eslint.config.js`
**Acciones:**
1. Habilitar `@typescript-eslint/no-unused-vars: "warn"` (actualmente `"off"`)
2. Agregar `eslint-plugin-jsx-a11y` para accesibilidad
3. Agregar `eslint-plugin-security` para deteccion de antipatrones

---

## FASE 5: TEST COVERAGE (Dias 18-25)

> **Skills activos:** tdd-workflow, test-driven-development (superpowers), verification-loop
> **Agentes:** tdd-guide, e2e-runner

### 5.1 Estado actual: ~15-20% coverage

**Tests existentes (30 archivos):**
analytics, api-keys, audit-plugin, auth-schemas, auth, backup-worker, cors, credential-encryption, devices, e2e-flow, env, error-handler, events, evidence, health-check-worker, health-liveness, incidents, integrations, mcp-tools, metrics, notification-templates, plan-limits, redis-cache, reports-worker, require-role-return, secure-proxy, sites

**Modulos SIN tests (50+):**
access-control, alerts, automation, cameras, clips, cloud-accounts, compliance, contracts, data-import, database-records, device-control, domotics, email, emergency, ewelink, extensions, face-recognition, floor-plans, gdpr, heat-mapping, hikconnect, imou, incidents (parcial), internal-agent, knowledge-base, live-view, lpr, mcp-bridge, network, notes, operational-data, operations, operator-assignments, patrols, playback, provisioning, push, reboots, relay, remote-access, roles, scheduled-reports, shifts, sla, streams, tenants, training, twilio, users, visitor-preregistration, visitors, voice, whatsapp, zkteco

### 5.2 Meta: 80% coverage

**Prioridad de tests por impacto:**

| Prioridad | Modulos | Razon |
|-----------|---------|-------|
| P0 | auth, users, tenants, roles | Seguridad critica |
| P0 | devices, cameras, streams | Core del VMS |
| P1 | alerts, incidents, events | Operaciones principales |
| P1 | access-control, visitors | Flujo de personas |
| P2 | automation, scheduled-reports | Automatizacion |
| P2 | mcp-bridge, internal-agent | Integracion AI |
| P3 | domotics, ewelink, relay | IoT |
| P3 | compliance, training, contracts | Administracion |

### 5.3 Tests E2E con Playwright

**Flujos criticos a cubrir:**
1. Login → Dashboard → Logout
2. Crear sitio → Agregar dispositivo → Ver stream
3. Crear alerta → Trigger → Notificacion
4. Crear incidente → Asignar → Resolver
5. Control de acceso → Registrar persona → Verificar
6. Visitor preregistration → Check-in → Check-out

---

## FASE 6: BACKEND COMPLETENESS (Dias 26-35)

> **Skills activos:** backend-patterns, coding-standards, systematic-debugging
> **Agentes:** architect, planner

### 6.1 Completar service layer en modulos stub

Para cada modulo stub (listados en Fase 1.8):
1. Crear `service.ts` con logica de negocio
2. Crear `schemas.ts` con validacion Zod
3. Agregar `requireRole()` en routes
4. Agregar `request.audit()` en mutaciones
5. Agregar rate limiting especifico
6. Escribir tests (siguiendo TDD skill)

### 6.2 Estandarizar paginacion

**Problema:** Algunos endpoints usan cursor-based, otros offset-based
**Accion:** Estandarizar en cursor-based para todas las listas, con fallback a offset para reportes

### 6.3 Circuit breaker para servicios externos

**Servicios que necesitan circuit breaker:**
- OpenAI API calls
- Anthropic API calls
- Twilio SMS/calls
- eWeLink API
- Hikvision ISAPI
- IMOU Cloud
- ElevenLabs TTS

**Accion:** Implementar patron circuit breaker con estados: closed → open → half-open

### 6.4 Error handling en workers

**Archivos:**
- `backend/apps/backend-api/src/workers/automation-engine.ts`
- `backend/apps/backend-api/src/workers/notification-dispatcher.ts`
- `backend/apps/backend-api/src/workers/reports-worker.ts`

**Accion:** Agregar:
- Error metrics collection
- Structured logging
- Graceful degradation
- Retry con backoff exponencial

### 6.5 Audit logging improvements

**Archivo:** `backend/apps/backend-api/src/plugins/audit.ts`
**Acciones:**
1. Capturar `beforeState` ademas de `afterState`
2. Indexar tabla audit_logs (ver Fase 1.3)
3. Agregar audit para lecturas sensibles (credentials, reports)

---

## FASE 7: MONITOREO Y OBSERVABILIDAD (Dias 36-38)

> **Skills activos:** verification-loop, continuous-learning
> **Agente:** architect

### 7.1 OpenTelemetry tracing end-to-end

**Estado:** Prometheus configurado, OTEL referenciado pero no verificado activo
**Accion:** Verificar que traces fluyen desde Fastify → services → database

### 7.2 Alerting rules coverage

**Archivo:** `backend/monitoring/alerts.yml`
**Verificar que cubra:**
- API latency > 2s
- Error rate > 5%
- Database connection pool exhaustion
- Redis connection failures
- Worker failures
- Disk space > 80%
- Memory usage > 90%

### 7.3 Structured logging

**Problema:** Logging no estandarizado en todos los modulos
**Accion:** Usar `request.log` con formato estructurado JSON en todos los services

---

## FASE 8: PERFORMANCE & OPTIMIZATION (Dias 39-42)

> **Skills activos:** frontend-patterns, backend-patterns, strategic-compact

### 8.1 Frontend bundle analysis

**Estado actual (vite.config.ts):** Chunks bien divididos (react, ui, query, hls, 3d, charts, maps)
**Accion:** Verificar tamanios finales y optimizar si alguno > 500KB

### 8.2 Database query optimization

**Problema identificado:** `cameras/service.ts` con queries ineficientes
**Accion:** Audit de queries lentas con `pg_stat_statements`

### 8.3 Redis caching strategy

**Estado:** Redis configurado pero uso de cache no verificado en todos los endpoints
**Accion:** Agregar cache para:
- Listados de sitios/dispositivos (TTL 60s)
- Dashboard metrics (TTL 30s)
- User permissions (TTL 300s)

---

## COMO SE USAN LOS 7 REPOS EN CADA FASE

| Fase | Context7 | Superpowers | UI/UX Pro Max | n8n-MCP | Everything CC | Claude-Mem | Obsidian |
|------|:--------:|:-----------:|:-------------:|:-------:|:-------------:|:----------:|:--------:|
| 0. Seguridad | - | - | - | - | security-review | - | - |
| 1. Backend | Fastify docs | systematic-debugging | - | - | security-reviewer, backend-patterns | Persistir fixes | - |
| 2. TypeScript | TS docs | - | - | - | coding-standards, build-error-resolver | - | - |
| 3. Frontend UX | React/Radix docs | brainstorming | **FOCO**: paletas, UX guidelines, a11y | - | frontend-patterns | - | markdown-docs |
| 4. CI/CD | GitHub Actions docs | - | - | Workflow CI/CD | verification-loop | - | - |
| 5. Testing | Vitest/Playwright docs | **FOCO**: TDD skill | - | - | tdd-guide, e2e-runner | Persistir patterns | - |
| 6. Backend Complete | Drizzle/Fastify docs | writing-plans, executing-plans | - | Verificar workflows | architect, planner | - | - |
| 7. Monitoreo | OTEL/Prom docs | - | - | Alertas n8n | verification-loop | - | json-canvas |
| 8. Performance | - | - | Performance rules S3 | - | - | Persistir benchmarks | - |

---

## METRICAS DE EXITO

| Metrica | Actual | Meta |
|---------|:------:|:----:|
| Score plataforma | 99/100 | 100/100 |
| Secretos en Git | 15+ expuestos | 0 |
| Test coverage backend | ~15% | 80% |
| TypeScript `any` | 498 | 0 |
| Paginas con i18n | 24/67 | 67/67 |
| Paginas con error handling | 52/67 | 67/67 |
| Paginas con empty states | 17/67 | 67/67 |
| ARIA attributes | 57 | 300+ |
| Modulos stub sin service | ~20 | 0 |
| CI typecheck blocking | No | Si |
| Security scanning en CI | No | Si |
| WebSocket autenticado | No | Si |
| DB indexes en audit_logs | 0 | 5 |
| Foreign keys faltantes | 3 | 0 |
| Workers con error metrics | 0 | 8 |

---

## TIMELINE

```
Semana 1 (Dias 1-7):    Fase 0 (Emergencia) + Fase 1 (Seguridad Backend) + Fase 2 (TypeScript)
Semana 2 (Dias 8-14):   Fase 3 (Frontend UX Profesional)
Semana 3 (Dias 15-25):  Fase 4 (CI/CD) + Fase 5 (Test Coverage)
Semana 4 (Dias 26-35):  Fase 6 (Backend Completeness)
Semana 5 (Dias 36-42):  Fase 7 (Monitoreo) + Fase 8 (Performance)
```

---

## ORDEN DE EJECUCION RECOMENDADO

1. **HOY:** Fase 0 completa (rotar secretos, purgar Git, .gitignore)
2. **Manana:** Fase 1.1 (WebSocket auth) + 1.2 (FK constraints) + 1.4 (unique email)
3. **Dia 3-4:** Fase 1.3 (indexes) + 1.5 (cameras queries) + 1.6 (sql.raw audit)
4. **Dia 5-7:** Fase 2 completa (strict mode + eliminar 498 any)
5. **Dia 8+:** Fase 3 en adelante segun timeline
